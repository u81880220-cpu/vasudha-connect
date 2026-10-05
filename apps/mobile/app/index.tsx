import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";

export default function Index(){
  const {session,loading}=useAuth();
  const [splash,setSplash]=useState(true);
  useEffect(()=>{const t=setTimeout(()=>setSplash(false),1300);return()=>clearTimeout(t)},[]);
  if(splash)return <SplashView/>;
  if(loading)return <View style={{flex:1,alignItems:"center",justifyContent:"center"}}><ActivityIndicator color="#087D65"/></View>;
  return <Redirect href={session?"/home":"/onboarding"}/>;
}
function SplashView(){
 return <View style={{flex:1,backgroundColor:"#fff",alignItems:"center",justifyContent:"center"}}>
   <View style={{width:96,height:96,borderRadius:30,backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center",marginBottom:22}}>
    <View style={{width:52,height:62,borderRadius:28,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center"}}>
      <View style={{width:25,height:38,borderRadius:15,backgroundColor:"#fff"}}/>
    </View>
   </View>
   <TextLogo/>
 </View>
}
function TextLogo(){
 return <View style={{alignItems:"center"}}><View><span/></View><View style={{alignItems:"center"}}><View/><></></View></View>
}
