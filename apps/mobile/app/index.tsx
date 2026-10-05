import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";

export default function Index(){
 const {session,loading}=useAuth();
 const [splash,setSplash]=useState(true);
 useEffect(()=>{const t=setTimeout(()=>setSplash(false),1300);return()=>clearTimeout(t)},[]);
 if(splash)return <SplashView/>;
 if(loading)return <View style={s.center}><ActivityIndicator color="#087D65" size="large"/></View>;
 return <Redirect href={session?"/home":"/onboarding"}/>;
}
function SplashView(){
 return <SafeAreaView style={s.safe}><View style={s.center}>
  <View style={s.mark}><Text style={s.markText}>V</Text></View>
  <Text style={s.logo}>VASUDHA</Text><Text style={s.connect}>CONNECT</Text>
  <Text style={s.tagline}>Find Skills Around You</Text>
 </View></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},center:{flex:1,alignItems:"center",justifyContent:"center"},mark:{width:94,height:94,borderRadius:30,backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center",marginBottom:18},markText:{fontSize:60,fontWeight:"900",color:"#087D65"},logo:{fontSize:28,fontWeight:"900",letterSpacing:1,color:"#087D65"},connect:{fontSize:17,fontWeight:"900",letterSpacing:2,color:"#087D65",marginTop:-3},tagline:{fontSize:14,color:"#66736e",marginTop:14}});
