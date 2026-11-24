import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { router } from "expo-router";
import { KAMPRO } from "../src/components/kamproTheme";

export default function ProfessionalVerification() {
  const { session, loading, mode } = useAuth();
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [years, setYears] = useState("");
  const [status, setStatus] = useState("unverified");
  const [completeness, setCompleteness] = useState(0);
  const [identityDocType, setIdentityDocType] = useState("Aadhaar");
  const [skillDocType, setSkillDocType] = useState("ITI / Diploma / Skill certificate");
  const [busyType, setBusyType] = useState<"identity" | "skill" | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const identityStatus = docs.find(d => !String(d.document_type).toLowerCase().startsWith("skill:"))?.status || status;
  const skillStatus = docs.find(d => String(d.document_type).toLowerCase().startsWith("skill:"))?.status || "unverified";

  useEffect(() => {
    if (!loading && session && mode !== "professional") router.replace("/home");
    if (session && mode === "professional") load();
  }, [session, loading, mode]);

  async function load() {
    if (!session || mode !== "professional") return;
    const [{ data }, { data: documents }] = await Promise.all([
      supabase.from("professional_profiles").select("headline,about,years_experience,verification_status").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("verification_documents").select("id,document_type,status,reviewer_note,submitted_at").eq("professional_id", session.user.id).order("submitted_at", { ascending: false }),
    ]);
    setDocs(documents || []);
    if (data) {
      setHeadline(data.headline || "");
      setAbout(data.about || "");
      setYears(String(data.years_experience || 0));
      setStatus(data.verification_status);
      setCompleteness(Math.min(100, Math.round(([data.headline, data.about, Number(data.years_experience) > 0].filter(Boolean).length / 3) * 100)));
    }
  }

  async function saveProfile() {
    if (!session) return;
    const { error } = await supabase.rpc("update_professional_profile", {
      p_headline: headline.trim() || null,
      p_about: about.trim() || null,
      p_years_experience: Number(years) || 0,
    });
    if (error) Alert.alert("Save failed", error.message);
    else Alert.alert("Saved", "Professional details updated.");
  }

  async function pickDocument(kind: "identity" | "skill") {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/png", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const file = result.assets[0];
    if ((file.size || 0) > 10 * 1024 * 1024) {
      Alert.alert("File too large", "Please select a file up to 10 MB.");
      return;
    }
    setBusyType(kind);
    try {
      if (!session) throw new Error("You are not signed in.");
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = session.user.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      const response = await fetch(file.uri);
      const body = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from("verification-documents").upload(path, body, {
        contentType: file.mimeType || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("verification_documents").insert({
        professional_id: session.user.id,
        document_type: kind === "skill" ? "Skill: " + skillDocType.trim() : "Identity: " + identityDocType.trim(),
        document_url: path,
      });
      if (insertError) {
        await supabase.storage.from("verification-documents").remove([path]);
        throw insertError;
      }
      await load();
      Alert.alert("Submitted", kind === "identity" ? "Your identity document was submitted for mandatory verification." : "Your skill document was submitted for optional skill verification.");
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusyType(null);
    }
  }

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
    <View style={s.top}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.topTitle}>KAMPRO</Text><View style={s.topSpacer}/></View>
    <Text style={s.title}>Professional Verification</Text>
    <Text style={s.sub}>Upload an identity document to complete required registration. Admin approval is still required before customers can discover your profile.</Text>
    <View style={s.score}><Text style={s.scoreTitle}>Profile completeness</Text><Text style={s.scoreValue}>{completeness}%</Text><Text style={s.muted}>Complete your professional details and submit verification.</Text></View>
    <Text style={s.label}>Headline</Text><TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="Experienced electrician" placeholderTextColor="#6B7280" selectionColor="#FF4B1F" placeholderTextColor="#6B7280" selectionColor="#FF4B1F"/>
    <Text style={s.label}>About</Text><TextInput style={[s.input, s.multi]} value={about} onChangeText={setAbout} placeholder="Experience, services and strengths" placeholderTextColor="#6B7280" selectionColor="#FF4B1F" multiline/>
    <Text style={s.label}>Experience</Text><TextInput style={s.input} value={years} onChangeText={setYears} keyboardType="number-pad" placeholderTextColor="#6B7280" selectionColor="#FF4B1F" placeholderTextColor="#6B7280" selectionColor="#FF4B1F"/>
    <Pressable onPress={saveProfile} style={s.save}><Text style={s.saveText}>Save professional details</Text></Pressable>
    <Text style={s.sectionTitle}>1. Identity verification · Mandatory</Text>
    <View style={s.verifyCard}><View style={s.status}><Text style={s.label}>Identity status</Text><Text style={s.badge}>{String(identityStatus).toUpperCase()}</Text></View>
      <Text style={s.note}>Government-issued identity proof is required. Admin approval is required before your profile appears in customer search.</Text>
      <Text style={s.label}>Document type</Text><View style={s.choiceRow}>{["Aadhaar","PAN","Voter ID","Driving Licence"].map(x=><Pressable key={x} onPress={()=>setIdentityDocType(x)} style={[s.choice,identityDocType===x&&s.choiceActive]}><Text style={[s.choiceText,identityDocType===x&&s.choiceTextActive]}>{x}</Text></Pressable>)}</View>
      <Pressable disabled={!!busyType} onPress={()=>pickDocument("identity")} style={s.primary}><Text style={s.button}>{busyType==="identity"?"Uploading...":"Upload identity document *"}</Text></Pressable>
    </View>
    <Text style={s.sectionTitle}>2. Skill verification · Optional</Text>
    <View style={s.verifyCard}><View style={s.status}><Text style={s.label}>Skill status</Text><Text style={s.badge}>{String(skillStatus).toUpperCase()}</Text></View>
      <Text style={s.note}>Optional proof: ITI, diploma, government skill certificate or previous employer experience proof. Not uploading it will not block registration.</Text>
      <TextInput style={s.input} value={skillDocType} onChangeText={setSkillDocType} placeholder="Document type" placeholderTextColor="#6B7280" selectionColor="#FF4B1F"/>
      <Pressable disabled={!!busyType} onPress={()=>pickDocument("skill")} style={s.secondary}><Text style={s.secondaryText}>{busyType==="skill"?"Uploading...":"Upload skill document (optional)"}</Text></Pressable>
    </View>
    {docs.length > 0 ? <View style={s.docs}><Text style={s.label}>Submission history</Text>{docs.map(d => <View key={d.id} style={s.doc}><Text style={s.docTitle}>{d.document_type} · {String(d.status).toUpperCase()}</Text>{d.reviewer_note ? <Text style={s.muted}>{d.reviewer_note}</Text> : null}</View>)}</View> : null}
    <Text style={s.note}>Accepted: JPG, PNG or PDF · Maximum 10 MB. Documents are stored privately and never shown to customers.</Text>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: KAMPRO.background },
  container: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 20, paddingBottom: 60 },
  top: { height: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 32, lineHeight: 32, color: "#10233F" },
  topTitle: { fontSize: 12, fontWeight: "800", color: "#FF4B1F", letterSpacing: 1 },
  topSpacer: { width: 36 },
  title: { fontSize: 27, fontWeight: "900", color: "#10233F", marginTop: 18 },
  sub: { marginTop: 5, color: "#4B5563", marginBottom: 18, lineHeight: 20 },
  score: { borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 16, padding: 16, backgroundColor: "#FFFFFF" },
  scoreTitle: { fontWeight: "800", color: "#10233F" },
  scoreValue: { fontSize: 30, fontWeight: "800", marginTop: 4, color: "#10233F" },
  muted: { color: "#4B5563", fontSize: 12, marginTop: 4, lineHeight: 18 },
  label: { fontWeight: "800", color: "#10233F", marginTop: 14, marginBottom: 8 },
  sectionTitle: { fontSize: 19, fontWeight: "900", color: "#10233F", marginTop: 22, marginBottom: 8 }, verifyCard: { borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 16, padding: 14, backgroundColor: "#FFFFFF", marginTop: 6 }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, choice: { borderWidth: 1, borderColor: "#CBD0D8", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 }, choiceActive: { borderColor: "#FF4B1F", backgroundColor: "#FFF0EA" }, choiceText: { color: "#10233F", fontSize: 12, fontWeight: "700" }, choiceTextActive: { color: "#D93812" }, secondary: { marginTop: 16, borderWidth: 1, borderColor: "#FF4B1F", borderRadius: 12, padding: 14, alignItems: "center" }, secondaryText: { color: "#D93812", fontWeight: "800" },
  input: { borderWidth: 1, borderColor: "#CBD0D8", borderRadius: 12, padding: 13, minHeight: 48, backgroundColor: "#FFFFFF", color: "#10233F" },
  multi: { minHeight: 90, textAlignVertical: "top" },
  status: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { borderWidth: 1, borderColor: "#FFD2C6", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontWeight: "800", color: "#D93812", backgroundColor: "#FFF0EA" },
  save: { marginTop: 16, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#FF4B1F" },
  saveText: { color: "#fff", fontWeight: "800" },
  primary: { marginTop: 18, borderWidth: 1, borderColor: "#FF4B1F", borderRadius: 12, padding: 15, alignItems: "center", backgroundColor: "#FF4B1F" },
  button: { fontWeight: "800", color: "#FFFFFF" },
  file: { marginTop: 10, fontWeight: "600", color: "#10233F" },
  note: { marginTop: 12, color: "#4B5563", fontSize: 12, lineHeight: 18 },
  docs: { marginTop: 4 },
  doc: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 7 },
  docTitle: { fontWeight: "700", color: "#10233F" },
});