import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";

const skills=[
 {icon:"⚡",label:"Electrical",tone:"#E8F7F2"},
 {icon:"🔧",label:"Plumbing",tone:"#FFF2E3"},
 {icon:"🪚",label:"Carpentry",tone:"#E8F7F2"},
 {icon:"🎨",label:"Painting",tone:"#FFF2E3"},
];

export default function Onboarding(){
 const fade=useRef(new Animated.Value(0)).current;
 const rise=useRef(new Animated.Value(18)).current;
 useEffect(()=>{
  Animated.parallel([
   Animated.timing(fade,{toValue:1,duration:700,useNativeDriver:true}),
   Animated.spring(rise,{toValue:0,useNativeDriver:true,bounciness:5}),
  ]).start();
 },[]);

 return <SafeAreaView style={s.safe}>
  <Animated.View style={[s.container,{opacity:fade,transform:[{translateY:rise}]}]}>
   <View style={s.brandRow}><VasudhaLogo/></View>

   <Text style={s.title}>Find Skills Around You</Text>
   <Text style={s.sub}>Skilled. Verified. Reliable.</Text>
   <Text style={s.sub2}>Connect with trusted professionals near you.</Text>

   <View style={s.hero}>
    <View style={s.heroGlow}/>
    <View style={s.orbitLeft}/>
    <View style={s.orbitRight}/>

    <View style={s.person personLeft}>
      <View style={s.head}/><View style={[s.body,{backgroundColor:"#087D65"}]}/><Text style={s.tool}>⚡</Text>
    </View>
    <View style={s.person personMid}>
      <View style={s.head}/><View style={[s.body,{backgroundColor:"#E18A2D"}]}/><Text style={s.tool}>🔧</Text>
    </View>
    <View style={s.skillV}><View style={s.vLeft}/><View style={s.vRight}/><View style={s.vDot}/></View>

    <View style={s.skillRow}>
     {skills.map(x=><View key={x.label} style={[s.skillBubble,{backgroundColor:x.tone}]}>
       <Text style={s.skillIcon}>{x.icon}</Text>
       <Text style={s.skillLabel}>{x.label}</Text>
     </View>)}
    </View>
   </View>

   <View style={s.trustRow}>
    <Trust icon="✓" text="Verified Professionals"/>
    <Trust icon="✓" text="Safe & Secure"/>
    <Trust icon="✓" text="Transparent Process"/>
   </View>

   <View style={s.dots}><View style={s.dotOn}/><View style={s.dot}/><View style={s.dot}/><View style={s.dot}/></View>

   <Pressable style={s.button} onPress={()=>router.replace("/select-mode")}>
    <Text style={s.buttonText}>Get Started</Text><Text style={s.arrow}>→</Text>
   </Pressable>
  </Animated.View>
 </SafeAreaView>
}

function Trust({icon,text}:{icon:string;text:string}){
 return <View style={s.trust}><View style={s.check}><Text style={s.checkText}>{icon}</Text></View><Text style={s.trustText}>{text}</Text></View>
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#F8FBF9"},
 container:{flex:1,paddingHorizontal:22,paddingTop:26,paddingBottom:18,alignItems:"center"},
 brandRow:{marginBottom:22},
 title:{fontSize:29,fontWeight:"900",letterSpacing:-.6,color:"#13201C",textAlign:"center"},
 sub:{fontSize:15,fontWeight:"800",color:"#087D65",marginTop:7,textAlign:"center"},
 sub2:{fontSize:13,color:"#71807A",marginTop:4,textAlign:"center"},

 hero:{width:"100%",height:335,borderRadius:30,backgroundColor:"#EAF8F4",marginTop:20,overflow:"hidden",alignItems:"center",justifyContent:"center"},
 heroGlow:{position:"absolute",width:230,height:230,borderRadius:115,backgroundColor:"#FFFFFF",opacity:.75},
 orbitLeft:{position:"absolute",width:170,height:170,borderRadius:85,borderWidth:1,borderColor:"#A9DCCD",left:-68,top:44},
 orbitRight:{position:"absolute",width:170,height:170,borderRadius:85,borderWidth:1,borderColor:"#F1C58D",right:-68,top:44},

 person:{position:"absolute",top:43,alignItems:"center"},
 personLeft:{left:"27%"},
 personMid:{right:"27%"},
 head:{width:43,height:43,borderRadius:22,backgroundColor:"#F2B27A",borderWidth:3,borderColor:"#fff"},
 body:{width:54,height:74,borderRadius:20,marginTop:-2,borderWidth:3,borderColor:"#fff"},
 tool:{position:"absolute",right:-17,bottom:3,fontSize:22},

 skillV:{position:"absolute",top:84,width:118,height:160,alignItems:"center"},
 vLeft:{position:"absolute",height:135,width:15,borderRadius:8,backgroundColor:"#087D65",transform:[{rotate:"-30deg"}],left:27,top:8},
 vRight:{position:"absolute",height:135,width:15,borderRadius:8,backgroundColor:"#E18A2D",transform:[{rotate:"30deg"}],right:27,top:8},
 vDot:{position:"absolute",width:16,height:16,borderRadius:8,backgroundColor:"#FFFFFF",bottom:7},

 skillRow:{position:"absolute",bottom:17,left:13,right:13,flexDirection:"row",justifyContent:"space-between"},
 skillBubble:{width:70,height:72,borderRadius:20,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#FFFFFF"},
 skillIcon:{fontSize:22},
 skillLabel:{fontSize:9,fontWeight:"800",color:"#34433E",marginTop:4},

 trustRow:{width:"100%",marginTop:17,flexDirection:"row",justifyContent:"space-between"},
 trust:{flexDirection:"row",alignItems:"center",maxWidth:"32%"},
 check:{width:22,height:22,borderRadius:11,backgroundColor:"#DDF4EC",alignItems:"center",justifyContent:"center"},
 checkText:{color:"#087D65",fontWeight:"900",fontSize:13},
 trustText:{fontSize:10,fontWeight:"700",color:"#52615C",marginLeft:5,flexShrink:1},

 dots:{flexDirection:"row",gap:5,marginTop:16},
 dotOn:{width:22,height:5,borderRadius:3,backgroundColor:"#087D65"},
 dot:{width:6,height:5,borderRadius:3,backgroundColor:"#C9D7D2"},

 button:{width:"100%",height:54,borderRadius:15,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center",marginTop:15,flexDirection:"row"},
 buttonText:{color:"#FFFFFF",fontWeight:"900",fontSize:16},
 arrow:{color:"#FFFFFF",fontSize:20,fontWeight:"700",marginLeft:10},
});