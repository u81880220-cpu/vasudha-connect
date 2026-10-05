import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import { VasudhaLogo } from "../src/components/VasudhaLogo";

export default function Index(){
 const {session,loading}=useAuth();
 const [splash,setSplash]=useState(true);
 useEffect(()=>{
  const t=setTimeout(()=>setSplash(false),1800);
  return()=>clearTimeout(t);
 },[]);
 if(splash)return <SplashView/>;
 if(loading)return <View style={s.center}><View style={s.loaderDot}/></View>;
 return <Redirect href={session?"/home":"/onboarding"}/>;
}

function SplashView(){
 const fade=useRef(new Animated.Value(0)).current;
 const scale=useRef(new Animated.Value(.88)).current;
 const line=useRef(new Animated.Value(0)).current;

 useEffect(()=>{
  Animated.parallel([
   Animated.timing(fade,{toValue:1,duration:650,useNativeDriver:true}),
   Animated.spring(scale,{toValue:1,useNativeDriver:true,bounciness:7}),
   Animated.timing(line,{toValue:1,duration:900,delay:250,useNativeDriver:false}),
  ]).start();
 },[]);

 return <SafeAreaView style={s.safe}>
  <View style={s.backgroundGlow}/>
  <View style={s.center}>
   <Animated.View style={{opacity:fade,transform:[{scale}]}}>
    <View style={s.logoCard}>
     <VasudhaLogo/>
    </View>
   </Animated.View>

   <Animated.View style={[s.connecting,{opacity:fade}]}>
    <View style={s.personLeft}/>
    <View style={s.skillLine}/>
    <View style={s.personRight}/>
   </Animated.View>

   <Animated.Text style={[s.tagline,{opacity:fade}]}>
    Find Skills Around You
   </Animated.Text>

   <Animated.View style={s.progressTrack}>
    <Animated.View style={[s.progress,{width:line.interpolate({inputRange:[0,1],outputRange:["0%","100%"]})}]}/>
   </Animated.View>
  </View>

  <View style={s.footer}>
   <Text style={s.footerText}>Connect • Discover • Grow</Text>
  </View>
 </SafeAreaView>;
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#F8FBF9"},
 center:{flex:1,alignItems:"center",justifyContent:"center",paddingHorizontal:28},
 backgroundGlow:{position:"absolute",width:330,height:330,borderRadius:165,backgroundColor:"#E7F7F2",opacity:.72,top:"28%",alignSelf:"center"},
 logoCard:{minWidth:250,minHeight:105,paddingHorizontal:28,paddingVertical:18,borderRadius:28,backgroundColor:"#FFFFFF",alignItems:"center",justifyContent:"center",shadowColor:"#087D65",shadowOpacity:.10,shadowRadius:22,shadowOffset:{width:0,height:10},elevation:6},
 connecting:{height:24,flexDirection:"row",alignItems:"center",justifyContent:"center",marginTop:26},
 personLeft:{width:9,height:9,borderRadius:5,backgroundColor:"#087D65"},
 skillLine:{width:82,height:2,backgroundColor:"#E18A2D",marginHorizontal:8},
 personRight:{width:9,height:9,borderRadius:5,backgroundColor:"#E18A2D"},
 tagline:{fontSize:20,fontWeight:"800",letterSpacing:.2,color:"#13201C",marginTop:22},
 progressTrack:{width:150,height:4,borderRadius:2,backgroundColor:"#DCE8E3",overflow:"hidden",marginTop:28},
 progress:{height:"100%",borderRadius:2,backgroundColor:"#087D65"},
 footer:{alignItems:"center",paddingBottom:34},
 footerText:{fontSize:12,fontWeight:"700",letterSpacing:1.2,color:"#71807A"},
 centerLoader:{flex:1,alignItems:"center",justifyContent:"center"},
 loaderDot:{width:12,height:12,borderRadius:6,backgroundColor:"#087D65"}
});
