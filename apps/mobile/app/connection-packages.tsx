import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { createConnectionPayment } from "../src/services/payment";
import { startCashfreeCheckout } from "../src/lib/cashfree-checkout";
import { KAMPRO } from "../src/components/kamproTheme";

type P = {
  code: string;
  name: string;
  connections: number;
  price_inr: number;
  validity_days: number;
};

export default function ConnectionPackages() {
  const [packages, setPackages] = useState<P[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const [{ data: p, error: pe }, { data: b, error: be }] = await Promise.all([
      supabase
        .from("connection_packages")
        .select("code,name,connections,price_inr,validity_days")
        .eq("is_active", true)
        .order("price_inr"),
      supabase.rpc("get_connection_balance"),
    ]);

    if (pe || be) {
      Alert.alert(
        "Unable to load packages",
        pe?.message || be?.message || "Please try again."
      );
    }

    setPackages((p || []) as P[]);
    setBalance(Number(b || 0));
    setLoading(false);
  }

  async function openCashfree(data: any, packageName: string) {
    if (!data?.payment_session_id || !data?.cashfree_order_id) {
      Alert.alert("Payment unavailable", "Cashfree did not return a valid payment session. No payment was taken.");
      return;
    }
    startCashfreeCheckout(data, packageName, () => {
      Alert.alert("Payment submitted", "Connection credits will be added only after Cashfree confirms the payment on the server.");
      void load();
    }, (message: string) => Alert.alert("Payment not completed", message));
  }

  async function startPayment(code: string, packageName: string) {
    setCreating(code);
    const provider = (process.env.EXPO_PUBLIC_PAYMENT_PROVIDER || "test") as "test" | "cashfree";

    try {
      if (provider === "test") {
        const result = await createConnectionPayment(code, "test");
        setCreating(null);
        if (result.status === "paid") {
          Alert.alert("Test payment successful", "Connection credits were added. This is a free QA payment and does not charge money.");
          await load();
        } else {
          Alert.alert("Test payment pending", "The test order was created but was not settled.");
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "create-cashfree-order",
        { body: { package_code: code } }
      );
      setCreating(null);
      if (error) throw error;
      if (Platform.OS === "web") {
        await openCashfree(data, packageName);
        return;
      }
      Alert.alert(
        "Payment gateway ready",
        "The secure Cashfree order was created. Complete checkout in the Cashfree payment screen."
      );
    } catch (e) {
      setCreating(null);
      Alert.alert("Unable to start payment", e instanceof Error ? e.message : "Please try again.");
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Connection Packages</Text>
        <Text style={s.sub}>
          Unlock verified professionals and connect directly.
        </Text>

        <View style={s.balance}>
          <Text>Available connections</Text>
          <Text style={s.balanceValue}>{balance}</Text>
          <Text style={s.balanceHint}>
            Credits are used only when you unlock a professional.
          </Text>
        </View>

        <View style={s.notice}>
          {((process.env.EXPO_PUBLIC_PAYMENT_PROVIDER || "test") === "test") && <Text style={s.testBadge}>TEST MODE · FREE PAYMENT</Text>}
          <Text style={s.noticeTitle}>{(process.env.EXPO_PUBLIC_PAYMENT_PROVIDER || "test") === "test" ? "Free QA payment" : "Secure payment"}</Text>
          <Text style={s.muted}>
            {(process.env.EXPO_PUBLIC_PAYMENT_PROVIDER || "test") === "test" ? "No money is charged in QA mode. Connection credits are added through the protected test-payment flow." : "Payments are processed through the secure gateway. Connection credits are added only after verified payment confirmation."}
          </Text>
        </View>

        {loading ? (
          <Text style={s.muted}>Loading packages...</Text>
        ) : (
          packages.map((p) => (
            <View key={p.code} style={s.card}>
              <View style={s.row}>
                <View>
                  <Text style={s.name}>{p.name}</Text>
                  <Text style={s.muted}>
                    {p.connections} connections • {p.validity_days} days
                  </Text>
                </View>
                <Text style={s.price}>₹{p.price_inr}</Text>
              </View>

              <Text style={s.per}>
                ₹{(p.price_inr / p.connections).toFixed(2)} per connection
              </Text>

              <Pressable
                disabled={creating !== null}
                onPress={() => startPayment(p.code, p.name)}
                style={[s.buy, creating !== null && s.buyDisabled]}
              >
                <Text style={s.buyText}>
                  {creating === p.code
                    ? "Creating secure order..."
                    : "Continue to payment"}
                </Text>
              </Pressable>
            </View>
          ))
        )}

        <Link href="/marketplace" asChild>
          <Pressable style={s.back}>
            <Text style={s.backText}>Back to professionals</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: KAMPRO.background },
  container: { width: "100%", maxWidth: 900, alignSelf: "center", padding: 28, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: "900", color: KAMPRO.navy },
  sub: { marginTop: 5, color: KAMPRO.muted, marginBottom: 18 },
  balance: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 12, backgroundColor: KAMPRO.surface },
  balanceValue: { fontSize: 30, fontWeight: "800", color: KAMPRO.ink, marginTop: 4 },
  balanceHint: { fontSize: 12, color: KAMPRO.muted, marginTop: 4 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 },
  testBadge: { fontSize: 11, fontWeight: "900", color: "#FF4B1F", marginBottom: 6 },
  noticeTitle: { fontWeight: "800", color: KAMPRO.ink, marginBottom: 4 },
  card: { borderWidth: 1, borderColor: KAMPRO.border, borderRadius: 20, padding: 20, marginBottom: 14, backgroundColor: KAMPRO.surface, shadowColor: KAMPRO.navy, shadowOpacity: .04, shadowRadius: 10, shadowOffset: {width:0,height:4}, elevation:1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: { fontSize: 18, fontWeight: "800", color: KAMPRO.ink },
  price: { fontSize: 20, fontWeight: "800", color: KAMPRO.ink },
  muted: { color: KAMPRO.muted, marginTop: 4 },
  per: { fontSize: 12, color: KAMPRO.muted, marginTop: 8 },
  buy: {
    marginTop: 12,
    borderRadius: 10,
    padding: 13,
    alignItems: "center",
    backgroundColor: "#FF4B1F",
  },
  buyDisabled: { opacity: 0.55 },
  buyText: { color: "#fff", fontWeight: "800" },
  back: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  backText: { fontWeight: "800", color: KAMPRO.ink },
});
