import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider } from "../src/auth/AuthProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";

export const unstable_settings = { anchor: "index" };

type BoundaryState = { error: Error | null };
class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const diagnostic = {
      message: error?.message || "Unknown JavaScript error",
      stack: error?.stack || "",
      componentStack: info?.componentStack || "",
      capturedAt: new Date().toISOString(),
      appArea: "root-render",
    };
    console.error("KAMPRO_ROOT_RENDER_CRASH", diagnostic);
    AsyncStorage.setItem("kampro_last_js_crash", JSON.stringify(diagnostic)).catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <View style={s.errorPage}>
          <Text style={s.errorTitle}>KAMPRO encountered an unexpected error</Text>
          <Text style={s.errorText}>Your login may already be saved. Close and reopen the app. If this screen returns, share the diagnostic details below with KAMPRO support.</Text>
          <ScrollView style={s.errorDetails}>
            <Text selectable style={s.errorCode}>{this.state.error.message}\n\n{this.state.error.stack || "No JavaScript stack was provided."}</Text>
          </ScrollView>
          <Pressable style={s.retryButton} onPress={() => this.setState({ error: null })}>
            <Text style={s.retryText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout(){
  return (
    <LanguageProvider>
      <AuthProvider>
        <StatusBar style="dark" hidden={false} />
        <View style={s.webRoot}>
          <AppErrorBoundary>
            <Stack screenOptions={{headerShown:false}} />
          </AppErrorBoundary>
        </View>
      </AuthProvider>
    </LanguageProvider>
  );
}

const s=StyleSheet.create({
  webRoot:{ flex:1, width:"100%", backgroundColor:"#fff" },
  errorPage:{ flex:1, padding:24, paddingTop:60, backgroundColor:"#fff" },
  errorTitle:{ fontSize:23, fontWeight:"800", color:"#172b4d", marginBottom:14 },
  errorText:{ fontSize:16, lineHeight:24, color:"#475569", marginBottom:18 },
  errorDetails:{ flex:1, borderWidth:1, borderColor:"#cbd5e1", borderRadius:10, padding:12, marginBottom:18 },
  errorCode:{ fontSize:12, lineHeight:18, color:"#7f1d1d" },
  retryButton:{ backgroundColor:"#f04b23", borderRadius:12, padding:16, alignItems:"center" },
  retryText:{ color:"#fff", fontWeight:"700", fontSize:16 },
});
