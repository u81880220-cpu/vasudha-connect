import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider } from "../src/auth/AuthProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";

export const unstable_settings = { anchor: "index" };

type Diagnostic = {
  message: string;
  stack: string;
  componentStack?: string;
  capturedAt: string;
  appArea: string;
  fatal?: boolean;
};

const DIAGNOSTIC_KEY = "kampro_last_js_crash";

async function persistDiagnostic(diagnostic: Diagnostic) {
  try {
    await AsyncStorage.setItem(DIAGNOSTIC_KEY, JSON.stringify(diagnostic));
  } catch (storageError) {
    console.error("KAMPRO could not persist crash diagnostic", storageError);
  }
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidMount() {
    // Keep React Native's normal fatal-error behavior, but persist the original
    // JavaScript exception first so the next launch can be diagnosed.
    const errorUtils = (globalThis as any).ErrorUtils;
    if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;
    const previousHandler = errorUtils.getGlobalHandler();
    if ((globalThis as any).__KAMPRO_ERROR_HANDLER_INSTALLED__) return;
    (globalThis as any).__KAMPRO_ERROR_HANDLER_INSTALLED__ = true;
    errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      void persistDiagnostic({
        message: error?.message || String(error || "Unknown JavaScript error"),
        stack: error?.stack || "",
        capturedAt: new Date().toISOString(),
        appArea: "global-js-handler",
        fatal: Boolean(isFatal),
      });
      console.error("KAMPRO_GLOBAL_JS_EXCEPTION", {
        message: error?.message,
        stack: error?.stack,
        fatal: Boolean(isFatal),
      });
      if (typeof previousHandler === "function") previousHandler(error, isFatal);
    });
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const diagnostic: Diagnostic = {
      message: error?.message || "Unknown JavaScript error",
      stack: error?.stack || "",
      componentStack: info?.componentStack || "",
      capturedAt: new Date().toISOString(),
      appArea: "react-render-boundary",
    };
    console.error("KAMPRO_ROOT_RENDER_CRASH", diagnostic);
    void persistDiagnostic(diagnostic);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={s.errorPage}>
          <Text style={s.errorTitle}>KAMPRO encountered an unexpected error</Text>
          <Text style={s.errorText}>The error has been saved on this device. Close and reopen KAMPRO. If it happens again, share the diagnostic details below with support.</Text>
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

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <LanguageProvider>
        <AuthProvider>
          <StatusBar style="dark" hidden={false} />
          <View style={s.webRoot}>
            <Stack screenOptions={{ headerShown: false }} />
          </View>
        </AuthProvider>
      </LanguageProvider>
    </AppErrorBoundary>
  );
}

const s = StyleSheet.create({
  webRoot: { flex: 1, width: "100%", backgroundColor: "#fff" },
  errorPage: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: "#fff" },
  errorTitle: { fontSize: 23, fontWeight: "800", color: "#172b4d", marginBottom: 14 },
  errorText: { fontSize: 16, lineHeight: 24, color: "#475569", marginBottom: 18 },
  errorDetails: { flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12, marginBottom: 18 },
  errorCode: { fontSize: 12, lineHeight: 18, color: "#7f1d1d" },
  retryButton: { backgroundColor: "#f04b23", borderRadius: 12, padding: 16, alignItems: "center" },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
