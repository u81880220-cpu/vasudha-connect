import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>VASUDHA CONNECT</Text>
      <Text style={styles.tagline}>Find Skills Around You</Text>
      <Text style={styles.status}>Project foundation ready</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  brand: { fontSize: 28, fontWeight: "800" },
  tagline: { fontSize: 18, marginTop: 8 },
  status: { marginTop: 24, opacity: 0.65 }
});
