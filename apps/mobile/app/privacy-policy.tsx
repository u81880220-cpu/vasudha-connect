import { Pressable, ScrollView, StyleSheet, Text, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { router } from "expo-router";

export default function PrivacyPolicy({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = true;
  const email = "ashishgaur381@gmail.com";
  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.c}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable>
          <VasudhaLogo compact />
          <View style={s.spacer} />
        </View>
        <Text style={s.t}>{privacy ? "Privacy Policy" : "Terms of Service"}</Text>
        <Text style={s.date}>KAMPRO · Last updated 27 October 2026</Text>
        <View style={s.notice}><Text style={s.noticeText}>Publisher review required: before using this policy for Google Play submission, confirm it matches the production app, backend, and every enabled third-party service.</Text></View>
        <Text style={s.h}>Who we are</Text>
        <Text style={s.p}>KAMPRO helps customers discover local service professionals and send service requests. For privacy questions or data requests, contact the publisher at {email}.</Text>
        <Text style={s.h}>Information we process</Text>
        <Text style={s.p}>Depending on features used, KAMPRO may process account information such as mobile number, name and profile details; professional skills, service area, availability and verification status; location when permission is granted to find nearby professionals; service requests, job status, reviews, ratings and messages; photos or documents submitted for profiles or identity verification; transaction and payment-status details for connection packages or professional subscriptions; and technical, diagnostic, device or notification-token information collected by the app or its service providers.</Text>
        <Text style={s.h}>How information is used</Text>
        <Text style={s.p}>Information may be used to create and secure accounts, display nearby professionals, support verification, connect customers and professionals, manage requests and jobs, deliver notifications, process transactions, prevent abuse, respond to support requests, and maintain and improve KAMPRO.</Text>
        <Text style={s.h}>Location</Text>
        <Text style={s.p}>When you grant location permission, KAMPRO uses location for nearby-professional discovery and related location features. You can manage permissions in Android settings; disabling location may limit location-based features. The publisher must verify whether location is collected only while the app is in use or also in the background, and how it is retained.</Text>
        <Text style={s.h}>Sharing with others</Text>
        <Text style={s.p}>Information may be shared with the customer or professional involved in a connection and with service providers that support hosting/database operations, authentication or OTP, maps and routing, notifications, payments, and verification where enabled. Information may also be disclosed where required by law or necessary to protect users and the service. The publisher must verify the actual providers, transfers, and any analytics or advertising use before publication.</Text>
        <Text style={s.h}>Identity documents and profile content</Text>
        <Text style={s.p}>Documents or photos you submit may be processed to support professional profile setup or identity verification. Access should be restricted to authorised review and operational purposes. Do not upload documents belonging to another person without permission.</Text>
        <Text style={s.h}>Retention</Text>
        <Text style={s.p}>Information should be retained only as long as needed for the purposes described in this policy, legal obligations, dispute resolution, and security. Actual retention periods for accounts, jobs, messages, location, uploaded documents, and transaction records must be confirmed by the publisher before submission.</Text>
        <Text style={s.h}>Account and data deletion</Text>
        <Text style={s.p}>To request account deletion or deletion of personal information, email {email} from your registered email address, or include the mobile number associated with your account so the request can be verified. Do not email passwords or identity documents. The publisher must verify and fulfil requests and explain any lawful retention exceptions. If account deletion is available in the app, users may also use that feature. The publisher must test that deletion works before Play Store submission.</Text>
        <Text style={s.h}>Security</Text>
        <Text style={s.p}>The publisher should apply appropriate technical and organisational safeguards and restrict access to authorised personnel. No system can guarantee absolute security.</Text>
        <Text style={s.h}>Children</Text>
        <Text style={s.p}>KAMPRO is a local-services marketplace and is not intended to be directed at children. The publisher must confirm the intended age group and complete Google Play target-audience and Families declarations accurately.</Text>
        <Text style={s.h}>Your choices and rights</Text>
        <Text style={s.p}>You can manage device permissions in Android settings and contact the publisher to request access, correction, or deletion of personal information, subject to applicable law and verification.</Text>
        <Text style={s.h}>Changes</Text>
        <Text style={s.p}>This policy may be updated when KAMPRO or its data practices change. The current version should be available at a public HTTPS URL before the app is submitted to Google Play.</Text>
        <Pressable onPress={() => Linking.openURL("mailto:" + email)} style={s.emailButton}><Text style={s.emailText}>Contact privacy support: {email}</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  c: { padding: 22, paddingBottom: 50, maxWidth: 900, width: "100%", alignSelf: "center" },
  top: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F7F8FA", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 30, color: "#10233F", marginTop: -3 },
  spacer: { width: 40 },
  t: { fontSize: 28, fontWeight: "800", marginTop: 10, color: "#10233F" },
  date: { fontSize: 12, color: "#596575", marginTop: 6 },
  notice: { backgroundColor: "#FFF2CC", padding: 13, borderRadius: 10, marginTop: 16 },
  noticeText: { color: "#624A00", fontSize: 13, lineHeight: 20 },
  h: { fontSize: 18, fontWeight: "800", marginTop: 24, color: "#10233F" },
  p: { fontSize: 15, lineHeight: 23, color: "#10233F", marginTop: 7 },
  emailButton: { marginTop: 26, padding: 14, borderRadius: 10, backgroundColor: "#E8F5EE" },
  emailText: { color: "#075B3A", fontWeight: "700" },
});