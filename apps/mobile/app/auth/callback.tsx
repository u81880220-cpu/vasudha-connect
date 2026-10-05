import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../../src/lib/supabase";

export default function AuthCallback(){
 useEffect(()=>{let alive=true;(async()=>{await supabase.auth.getSession();if(alive)router.replace("/home");})();return()=>{alive=false}},[]);
 return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color="#087D65"/><Text style={s.text}>Signing you in…</Text></View></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},center:{flex:1,alignItems:"center",justifyContent:"center"},text:{marginTop:14,color:"#66736e"}});
