import { router } from "expo-router";
import { useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function AuthCallback(){
 const params=useLocalSearchParams<{code?:string;error_description?:string}>();
 useEffect(()=>{let alive=true;(async()=>{
  if(params.error_description){if(alive)router.replace("/auth");return;}
  if(params.code){const{error}=await supabase.auth.exchangeCodeForSession(String(params.code));if(error){console.warn("KAMPRO Google callback exchange failed",error.message);if(alive)router.replace("/auth");return;}}
  const{data,error}=await supabase.auth.getSession();
  if(error)console.warn("KAMPRO callback session check failed",error.message);
  if(alive)router.replace(data.session?"/home":"/auth");
 })();return()=>{alive=false}},[params.code,params.error_description]);
 return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#087D65"/><Text style={s.text}>Signing you in…</Text></View></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},center:{flex:1,alignItems:"center",justifyContent:"center"},text:{marginTop:14,color:"#66736e"}});
