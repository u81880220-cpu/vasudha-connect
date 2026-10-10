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
  const [docType, setDocType] = useState("Identity / Skill document");
  const [docName, setDocName] = useState("");
  const [busy, setBusy] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);

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

  async function pickDocument() {
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
    setDocName(file.name);
    setBusy(true);
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
        document_type: docType.trim() || "Identity / Skill document",
        document_url: path,
      });
      if (insertError) {
        await supabase.storage.from("verification-documents").remove([path]);
        throw insertError;
      }
      setStatus("pending");
      Alert.alert("Submitted", "Your document was uploaded securely and your verification request was sent for admin review.");
    } catch (e) {
      setDocName("");
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
    <View style={s.top}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.topTitle}>KAMPRO</Text><View style={s.topSpacer}/></View>
    <Text style={s.title}>Professional Verification</Text>
    <Text style={s.sub}>Build trust before customers connect with you.</Text>
    <View style={s.score}><Text style={s.scoreTitle}>Profile completeness</Text><Text style={s.scoreValue}>{completeness}%</Text><Text style={s.muted}>Complete your professional details and submit verification.</Text></View>
    <Text style={s.label}>Headline</Text><TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="Experienced electrician" placeholderTextColor="#6B7280" selectionColor="#FF4B1F"/>
    <Text style={s.label}>About</Text><TextInput style={[s.input, s.multi]} value={about} onChangeText={setAbout} placeholder="Experience, services and strengths" placeholderTextColor="#6B7280" selectionColor="#FF4B1F" multiline/>
    <Text style={s.label}>Experience</Text><TextInput style={s.input} value={years} onChangeText={setYears} keyboardType="number-pad" placeholderTextColor="#6B7280" selectionColor="#FF4B1F"/>
    <Pressable onPress={saveProfile} style={s.save}><Text style={s.saveText}>Save professional details</Text></Pressable>
    <View style={s.status}><Text style={s.label}>Verification status</Text><Text style={s.badge}>{status.toUpperCase()}</Text></View>
    {docs.length > 0 ? <View style={s.docs}><Text style={s.label}>Submission history</Text>{docs.map(d => <View key={d.id} style={s.doc}><Text style={s.docTitle}>{d.document_type} · {String(d.status).toUpperCase()}</Text>{d.reviewer_note ? <Text style={s.muted}>{d.reviewer_note}</Text> : null}</View>)}</View> : null}
    <Text style={s.label}>Verification document type</Text><TextInput style={s.input} value={docType} onChangeText={setDocType} placeholderTextColor="#6B7280" selectionColor="#FF4B1F"/>
    <Pressable disabled={busy} onPress={pickDocument} style={s.primary}><Text style={s.button}>{busy ? "Uploading..." : "Choose & upload document"}</Text></Pressable>
    {docName ? <Text style={s.file}>Selected: {docName}</Text> : null}
    <Text style={s.note}>Accepted: JPG, PNG or PDF • Maximum 10 MB. Documents are stored privately and are not public marketplace files.</Text>
    <Text style={s.note}>Admin approval is required before your profile appears in nearby customer search.</Text>
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