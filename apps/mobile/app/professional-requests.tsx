import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { KamproPage, KamproHeader } from "../src/components/KamproUI";
import { AppBottomNav } from "../src/components/AppBottomNav";

type RequestRow = {
  id: string;
  customer_id: string;
  title?: string | null;
  service_name?: string | null;
  sub_service_name?: string | null;
  description?: string | null;
  preferred_date?: string | null;
  preferred_time?: string | null;
  location_text?: string | null;
  status: string;
  created_at: string;
  customer_name?: string;
};

export default function ProfessionalRequests() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const selectedId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_professional_requests_with_service");
      if (rpcError) throw rpcError;
      const pending = ((data || []) as RequestRow[])
        .filter((r) => ["requested", "submitted"].includes(String(r.status)))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const customerIds = [...new Set(pending.map((r) => r.customer_id).filter(Boolean))];
      const names: Record<string, string> = {};
      if (customerIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id,display_name,full_name")
          .in("id", customerIds);
        if (profileError) console.warn("KAMPRO request customer names unavailable:", profileError.message);
        (profiles || []).forEach((p: any) => {
          names[p.id] = p.display_name || p.full_name || "Customer";
        });
      }
      setRequests(pending.map((r) => ({ ...r, customer_name: names[r.customer_id] || "Customer" })));
    } catch (e: any) {
      setError(e?.message || "Pending service requests could not be loaded.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void load();
    const channel = user?.id
      ? supabase.channel("professional-pending-requests-" + user.id)
          .on("postgres_changes", { event: "*", schema: "public", table: "service_requests", filter: "professional_id=eq." + user.id }, () => {
            if (active) void load();
          }).subscribe()
      : null;
    const timer = setInterval(() => { if (active) void load(); }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [load, user?.id]));

  async function accept(requestId: string) {
    if (acceptingId) return;
    setAcceptingId(requestId);
    try {
      const { data, error: acceptError } = await supabase.rpc("accept_service_request", { p_request_id: requestId });
      if (acceptError) throw acceptError;
      if (!data) throw new Error("The server did not return the accepted job. Please refresh and try again.");
      router.push({ pathname: "/job-tracking", params: { jobId: String(data) } });
    } catch (e: any) {
      Alert.alert("Unable to accept request", e?.message || "Please try again.");
      await load();
    } finally {
      setAcceptingId(null);
    }
  }

  return <>
    <KamproPage>
      <KamproHeader title="Pending Service Requests" subtitle="Review requests from customers and accept the work." action={
        <Pressable onPress={load} style={s.refresh}><Text style={s.refreshText}>↻</Text></Pressable>
      } />
      {loading ? <View style={s.state}><ActivityIndicator color="#FF4B1F" /><Text style={s.muted}>Loading pending requests…</Text></View> :
        error ? <View style={s.empty}><Text style={s.heading}>Couldn't load requests</Text><Text style={s.muted}>{error}</Text><Pressable onPress={load} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View> :
        requests.length === 0 ? <View style={s.empty}><Text style={s.emptyIcon}>✓</Text><Text style={s.heading}>No pending requests</Text><Text style={s.muted}>New customer service requests will appear here. Pull back to Home or refresh to check again.</Text></View> :
        requests.map((r) => <View key={r.id} style={[s.card, selectedId === r.id && s.selected]}>
          {selectedId === r.id ? <Text style={s.selectedLabel}>Request opened from Home</Text> : null}
          <View style={s.row}><Text style={s.cardTitle}>{r.service_name || r.title || "New service request"}</Text><Text style={s.pending}>PENDING</Text></View>
          <Text style={s.customer}>Customer: {r.customer_name || "Customer"}</Text>
          <Text style={s.body}>Work type: {[r.service_name, r.sub_service_name].filter(Boolean).join(" · ") || "Service details unavailable"}</Text>
          <Text style={s.body}>Customer instructions: {r.description?.trim() || "No additional instructions provided."}</Text>
          {r.preferred_date || r.preferred_time ? <Text style={s.body}>Preferred time: {[r.preferred_date, r.preferred_time].filter(Boolean).join(" · ")}</Text> : null}
          {r.location_text ? <Text style={s.body}>Location: {r.location_text}</Text> : null}
          <Text style={s.muted}>Received: {new Date(r.created_at).toLocaleString()}</Text>
          <Pressable disabled={!!acceptingId} onPress={() => accept(r.id)} style={[s.primary, acceptingId && s.disabled]}>
            <Text style={s.primaryText}>{acceptingId === r.id ? "Accepting…" : "Accept request"}</Text>
          </Pressable>
          <Text style={s.note}>Accepting creates a job and moves it to My Jobs. If you are already working on another job, finish it first.</Text>
        </View>)
      }
    </KamproPage>
    <AppBottomNav active="jobs" />
  </>;
}

const s = StyleSheet.create({
  state: { alignItems: "center", paddingVertical: 48 },
  empty: { marginTop: 22, borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 18, padding: 22, alignItems: "center", backgroundColor: "#F8FAFC" },
  emptyIcon: { fontSize: 28, color: "#15966B", fontWeight: "900" },
  heading: { fontSize: 19, fontWeight: "900", color: "#10233F", marginTop: 10, textAlign: "center" },
  muted: { color: "#667085", marginTop: 8, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: "#E7EAF0", borderRadius: 18, padding: 16, marginTop: 14, backgroundColor: "#fff" },
  selected: { borderColor: "#FF4B1F", borderWidth: 2, backgroundColor: "#FFF8F4" },
  selectedLabel: { color: "#D93812", fontWeight: "900", fontSize: 12, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: "900", color: "#10233F" },
  pending: { color: "#B93815", backgroundColor: "#FFF0EA", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, fontSize: 10, fontWeight: "900" },
  customer: { color: "#10233F", fontWeight: "800", marginTop: 10 },
  body: { color: "#475467", marginTop: 8, lineHeight: 20 },
  primary: { marginTop: 14, borderRadius: 12, padding: 14, alignItems: "center", backgroundColor: "#FF4B1F", minHeight: 48, justifyContent: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
  disabled: { opacity: 0.6 },
  note: { color: "#667085", fontSize: 11, lineHeight: 17, marginTop: 9 },
  refresh: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F7F8FA", alignItems: "center", justifyContent: "center" },
  refreshText: { fontSize: 22, color: "#FF4B1F" }
});
