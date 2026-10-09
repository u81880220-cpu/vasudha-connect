import { Pressable, StyleSheet, Text } from "react-native";
import { useKamproLanguage } from "../i18n/LanguageProvider";

export function LanguageSwitch() {
  const { language, setLanguage } = useKamproLanguage();
  const next = language === "en" ? "hi" : "en";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={language === "en" ? "Switch app language to Hindi" : "Switch app language to English"}
      onPress={() => { void setLanguage(next); }}
      style={({ pressed }) => [s.button, pressed && s.pressed]}
    >
      <Text style={[s.option, language === "hi" && s.active]}>{language === "hi" ? "हिन्दी" : "हिन्दी"}</Text>
      <Text style={s.arrow}>↔</Text>
      <Text style={[s.option, language === "en" && s.active]}>EN</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  button: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#DCE1E8",
    backgroundColor: "#FFFFFF",
  },
  option: { color: "#687386", fontSize: 12, fontWeight: "700" },
  active: { color: "#10233F", fontWeight: "900" },
  arrow: { color: "#687386", fontSize: 14 },
  pressed: { opacity: 0.7 },
});
