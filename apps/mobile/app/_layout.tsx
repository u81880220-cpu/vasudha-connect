import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, Text, Pressable, ScrollView, AppState } from "react-native";
import { useEffect } from "react";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider } from "../src/auth/AuthProvider";
import { LanguageProvider } from "../src/i18n/LanguageProvider";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";

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

function ProfessionalLiveLocationSync(){
  const {session,mode}=useAuth();
  useEffect(()=>{
    const userId=session?.user?.id;
    if(!userId)return;
    let active=true,updating=false,permissionRequested=false;
    async function refresh(){
      if(!active||updating||AppState.currentState!=="active")return;
      updating=true;
      try{
        const {data:profile,error:profileError}=await supabase
          .from("professional_profiles")
          .select("is_available")
          .eq("user_id",userId)
          .maybeSingle();
        if(profileError||!profile?.is_available)return;
        const permission=permissionRequested
          ? await Location.getForegroundPermissionsAsync()
          : await Location.requestForegroundPermissionsAsync();
        permissionRequested=true;
        if(permission.status!=="granted")return;
        if(!(await Location.hasServicesEnabledAsync()))return;
        const position=await Promise.race([
          Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced}),
          new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error("GPS timeout")),12000))
        ]);
        if(!active)return;
        const {error}=await supabase.rpc("update_professional_marketplace_location",{
          p_latitude:position.coords.latitude,
          p_longitude:position.coords.longitude
        });
        if(error)throw error;
      }catch(error){
        console.warn("KAMPRO professional live-location refresh skipped; registered service location remains fallback.",error);
      }finally{updating=false;}
    }
    void refresh();
    const interval=setInterval(()=>{void refresh();},120000);
    const subscription=AppState.addEventListener("change",state=>{if(state==="active")void refresh();});
    return()=>{active=false;clearInterval(interval);subscription.remove();};
  },[session?.user?.id,mode]);
  return null;
}

export default function RootLayout(){
  return (
    <LanguageProvider>
      <AuthProvider>
        <StatusBar style="dark" hidden={false} />
        <ProfessionalLiveLocationSync />
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
