import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";

export default function BasicProfile() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const [{ data: p }, { data: c }] = await Promise.all([
        supabase.from("profiles").select("full_name,display_name").eq("id", uid).maybeSingle(),
        supabase.from("user_contact_details").select("phone").eq("user_id", uid).maybeSingle(),
      ]);
      setName(p?.full_name || p?.display_name || "");
      setPhone(c?.phone || "");
    })();
  }, [uid]);

  async function save() {
    if (!uid) return;
    if (name.trim().length < 2) {
      Alert.alert("Add your name", "Please enter your name to continue.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: name.trim(),
        display_name: name.trim(),
      }).eq("id", uid);
      if (error) throw error;

      const { error: phoneError } = await supabase.from("user_contact_details").upsert({
        user_id: uid,
        phone: phone.trim() || null,
        updated_at: new Date().toISOString(),
      });
      if (phoneError) throw phoneError;

      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Could not save profile", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.c}>
        <VasudhaLogo />
        <Text style={s.title}>Let's get you started</Text>
        <Text style={s.sub}>Just the basics. You can complete the rest of your profile later.</Text>

        <Text style={s.label}>Your name *</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Full name" style={s.input} autoCapitalize="words" />

        <Text style={s.label}>Mobile number</Text>
        <TextInput value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" style={s.input} keyboardType="phone-pad" />
        <Text style={s.hint}>Your number is kept private and is shared only when the job flow permits it.</Text>

        <Pressable disabled={busy} onPress={save} style={s.primary}>
          <Text style={s.primaryText}>{busy ? "Saving…" : "Continue to KAMPRO"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:KAMPRO.background},
  c:{width:"100%",maxWidth:700,alignSelf:"center",flex:1,padding:28,justifyContent:"center"},
  title:{fontSize:28,fontWeight:"900",color:"#10233F",marginTop:28},
  sub:{color:"#6B7280",lineHeight:20,marginTop:7,marginBottom:20},
  label:{fontWeight:"800",color:"#46534f",marginTop:14,marginBottom:7},
  input:{height:54,borderWidth:1,borderColor:KAMPRO.border,borderRadius:14,paddingHorizontal:14,fontSize:16,color:"#10233F"},
  hint:{fontSize:12,color:"#6B7280",lineHeight:17,marginTop:7},
  primary:{height:52,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:26},
  primaryText:{color:"#fff",fontWeight:"900",fontSize:16},
});
