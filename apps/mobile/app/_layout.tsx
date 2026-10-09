import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { AuthProvider } from "../src/auth/AuthProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";

export const unstable_settings = { anchor: "index" };

export default function RootLayout(){
  return (
    <LanguageProvider>
      <AuthProvider>
        <StatusBar style="dark" hidden={false} />
        <View style={s.webRoot}>
          <Stack screenOptions={{headerShown:false}} />
        </View>
      </AuthProvider>
    </LanguageProvider>
  );
}

const s=StyleSheet.create({
  webRoot:{
    flex:1,
    minHeight:"100vh",
    width:"100%",
    backgroundColor:"#fff",
  },
});
