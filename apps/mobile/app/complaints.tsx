import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";

const labels: Record<string,string> = {
  open:"Submitted", under_review:"Under review", upheld:"Upheld", dismissed:"Dismissed", resolved:"Resolved"
};

function categoryLabel(value:any) {
  return String(value || "Complaint").split("_").join(" ");
}

export default function Complaints() {
  const { user, mode } = useAuth();
  const [items,setItems] = useState<any[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [reported, against] = await Promise.all([
        supabase.from("complaints")
          .select("id,job_id,reporter_id,against_user_id,category,description,status,admin_note,created_at,updated_at")
          .eq("reporter_id", user.id).order("created_at",{ascending:false}).limit(50),
        supabase.from("complaints")
          .select("id,job_id,reporter_id,against_user_id,category,description,status,admin_note,created_at,updated_at")
          .eq("against_user_id", user.id).order("created_at",{ascending:false}).limit(50)
      ]);
      if (reported.error && against.error) throw reported.error;
      const all = [...(reported.data || []), ...(against.data || [])];
      const unique = Array.from(new Map(all.map((x:any)=>[x.id,x])).values())
        .sort((a:any,b:any)=>new Date(b.created_at || 0).getTime()-new Date(a.created_at || 0).getTime());
      setItems(unique);
    } catch (e:any) {
      setItems([]);
      setError(e?.message || "Unable to load complaint history.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.c} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={s.backText}>‹</Text>
          </Pressable>
          <VasudhaLogo compact />
          <Pressable onPress={load} style={s.refresh} accessibilityRole="button" accessibilityLabel="Refresh complaints">
            <Text style={s.refreshText}>↻</Text>
          </Pressable>
        </View>

        <Text style={s.title}>Complaints & Reports</Text>
        <Text style={s.sub}>
          {mode === "professional" ? "Track reports involving your professional account." : "Track complaints you have submitted."}
        </Text>

        {loading ? (
          <View style={s.state}><ActivityIndicator color={KAMPRO.brand}/><Text style={s.muted}>Loading complaint history…</Text></View>
        ) : error ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>Unable to load complaints</Text>
            <Text style={s.muted}>{error}</Text>
            <Pressable onPress={load} style={s.retry}><Text style={s.retryText}>Try again</Text></Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No complaints</Text>
            <Text style={s.muted}>Your complaint history will appear here.</Text>
          </View>
        ) : (
          items.map((x:any) => {
            const mine = x.reporter_id === user?.id;
            return (
              <View key={x.id} style={s.card}>
                <View style={s.head}>
                  <Text style={s.category}>{categoryLabel(x.category)}</Text>
                  <Text style={s.badge}>{labels[x.status] || String(x.status || "Submitted")}</Text>
                </View>
                <Text style={s.role}>{mine ? "You reported this issue" : "This report concerns your account"}</Text>
                <Text style={s.desc}>{x.description || "No description provided."}</Text>
                <Text style={s.time}>
                  {x.created_at ? new Date(x.created_at).toLocaleString() : "Date unavailable"}
                  {x.job_id ? " · Job " + String(x.job_id).slice(0,8) : ""}
                </Text>
                {x.admin_note ? <View style={s.note}><Text style={s.noteTitle}>KAMPRO update</Text><Text style={s.noteText}>{x.admin_note}</Text></View> : null}
              </View>
            );
          })
        )}

        <Pressable style={s.secondary} onPress={() => router.back()}>
          <Text style={s.secondaryText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:KAMPRO.background},
  c:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:60},
  top:{height:48,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  back:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},
  backText:{fontSize:30,color:"#10233F",marginTop:-3},
  refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},
  refreshText:{fontSize:22,color:"#10233F"},
  title:{fontSize:30,fontWeight:"900",color:KAMPRO.navy,marginTop:16},
  sub:{color:"#6B7280",lineHeight:19,marginTop:5},
  card:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:15,marginTop:12,backgroundColor:"#fff"},
  head:{flexDirection:"row",justifyContent:"space-between",gap:10,alignItems:"center"},
  category:{fontWeight:"900",fontSize:16,textTransform:"capitalize",flex:1},
  badge:{backgroundColor:"#eef6f3",color:KAMPRO.brand,fontWeight:"900",fontSize:11,paddingHorizontal:9,paddingVertical:5,borderRadius:10},
  role:{fontSize:11,color:"#6B7280",marginTop:5},
  desc:{marginTop:8,lineHeight:18,color:"#172033"},
  time:{fontSize:11,color:"#6B7280",marginTop:8},
  note:{marginTop:10,padding:10,borderRadius:10,backgroundColor:"#f5f8f7"},
  noteTitle:{fontWeight:"900",fontSize:11,color:KAMPRO.brand},
  noteText:{fontSize:12,lineHeight:17,marginTop:3},
  empty:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:20,marginTop:20,backgroundColor:"#fff"},
  emptyTitle:{fontSize:18,fontWeight:"900",color:KAMPRO.navy},
  muted:{color:"#6B7280",marginTop:5,lineHeight:18},
  state:{alignItems:"center",paddingVertical:40},
  retry:{marginTop:14,borderRadius:12,padding:12,backgroundColor:KAMPRO.brand,alignItems:"center"},
  retryText:{color:"#fff",fontWeight:"900"},
  secondary:{marginTop:18,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#fff"},
  secondaryText:{fontWeight:"800",color:KAMPRO.brand}
});
