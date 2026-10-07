import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";

export default function CustomerProfile() {
  const { session } = useAuth();
  const [f, setF] = useState<any>({
    full_name: "", display_name: "", bio: "", city: "", state: "", country: "India"
  });
  const [rep, setRep] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const editableFields = ["full_name","display_name","bio","city","state"];

  useEffect(() => {
    if (session?.user.id) load();
  }, [session?.user.id]);

  async function load() {
    if (!session?.user.id) return;
    setLoading(true);
    const { data, error } = await supabase.from("profiles")
      .select("full_name,display_name,bio,city,state,country,customer_trust_score")
      .eq("id", session.user.id).maybeSingle();
    if (error) Alert.alert("Error", error.message);
    else if (data) setF(data);

    const { data:ct } = await supabase.from("user_contact_details").select("phone").eq("user_id",session.user.id).maybeSingle(); if(ct) setPhone(ct.phone||"");
    const { data: rp } = await supabase.rpc("get_customer_reputation", {
      p_customer_id: session.user.id
    });
    if (rp) setRep(rp);
    setLoading(false);
  }

  async function save() {
    if (!session?.user.id) return;
    const { error } = await supabase.from("profiles").update(f).eq("id", session.user.id);
    if (error) Alert.alert("Save failed", error.message);
    else { const {error:phoneError}=await supabase.from("user_contact_details").upsert({user_id:session.user.id,phone:phone.trim()||null,updated_at:new Date().toISOString()}); if(phoneError){Alert.alert("Phone save failed",phoneError.message);return;}
      Alert.alert("Saved", "Profile updated.");
      router.back();
    }
  }

  const score = Math.min(100, Math.max(0, Number(rep?.trust_score ?? f.customer_trust_score ?? 0)));

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.c} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.back} accessibilityLabel="Go back">
            <Text style={s.backText}>‹</Text>
          </Pressable>
          <VasudhaLogo compact />
          <View style={{width:40}}/>
        </View>

        <Text style={s.t}>My Customer Profile</Text>
        <Text style={s.sub}>Your profile helps professionals understand who they are working with.</Text>
        {loading ? <Text style={s.muted}>Loading profile…</Text> : null}

        <View style={s.trust}>
          <View style={s.trustHead}>
            <View>
              <Text style={s.trustTitle}>Customer Trust</Text>
              <Text style={s.trustCaption}>Your reputation on KAMPRO</Text>
            </View>
            <Text style={s.score}>{Math.round(score)}</Text>
          </View>
          <View style={s.trustBar}>
            <View style={[s.trustFill, { width: `${score}%` }]} />
          </View>
          <Text style={s.trustMeta}>
            {rep?.jobs_completed || 0} completed jobs · {rep?.reviews_received || 0} reviews · {rep?.would_work_again || 0}% would work again
          </Text>
        </View>

        <Text style={s.section}>Personal details</Text><Text style={s.l}>Contact phone</Text><TextInput style={s.i} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210"/><Text style={s.muted}>Your phone is shared with a professional only after you accept their job.</Text>
        {editableFields.map((k) => (
          <View key={k}>
            <Text style={s.l}>{k.replaceAll("_", " ")}</Text>
            <TextInput
              style={[s.i, k === "bio" && s.bio]}
              value={f[k] || ""}
              onChangeText={(v) => setF({ ...f, [k]: v })}
              multiline={k === "bio"}
              placeholder={`Enter ${k.replaceAll("_", " ")}`}
            />
          </View>
        ))}

        <Pressable style={s.p} onPress={save}>
          <Text style={s.pt}>Save changes</Text>
        </Pressable>
      </ScrollView>
      <AppBottomNav active="profile" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  c: { padding: 18, paddingBottom: 96 },
  top: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F7F8FA", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: "#10233F", marginTop: -3 },
  more: { fontSize: 26, color: "#FF4B1F" },
  t: { fontSize: 28, fontWeight: "900", color: "#10233F", marginTop: 18 },
  sub: { color: "#6B7280", lineHeight: 20, marginTop: 6 },
  muted: { color: "#6B7280", marginTop: 10 },
  trust: { marginTop: 18, borderWidth: 1, borderColor: "#FFD2C6", borderRadius: 16, padding: 16, backgroundColor: "#FFF8F5" },
  trustHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trustTitle: { fontWeight: "900", fontSize: 17, color: "#10233F" },
  trustCaption: { fontSize: 12, color: "#6B7280", marginTop: 3 },
  score: { fontSize: 30, fontWeight: "900", color: "#FF4B1F" },
  trustBar: { height: 7, borderRadius: 4, backgroundColor: "#E7EAF0", overflow: "hidden", marginTop: 14 },
  trustFill: { height: 7, borderRadius: 4, backgroundColor: "#FF4B1F" },
  trustMeta: { fontSize: 12, color: "#6B7280", marginTop: 10 },
  section: { fontSize: 18, fontWeight: "900", color: "#10233F", marginTop: 24, marginBottom: 2 },
  l: { fontWeight: "800", color: "#46534f", marginTop: 14, textTransform: "capitalize" },
  i: { borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 12, padding: 12, marginTop: 6, minHeight: 48, backgroundColor: "#fff", color: "#10233F" },
  bio: { minHeight: 100, textAlignVertical: "top" },
  p: { marginTop: 24, backgroundColor: "#FF4B1F", padding: 15, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 50 },
  pt: { color: "#fff", fontWeight: "900" }
});
