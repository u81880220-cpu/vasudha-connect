import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { ServiceIcon } from "../src/components/ServiceIcon";

const services=["Electrician","Plumber","Carpenter","Painter"];

export default function Onboarding(){
 return <SafeAreaView style={s.safe}>
  <View style={s.container}>
   <VasudhaLogo/>
   <Text style={s.title}>Find Skills Around You</Text>
   <Text style={s.subtitle}>Skilled. Verified. Reliable.</Text>
   <Text style={s.description}>Connect with trusted professionals near you.</Text>

   <View style={s.card}>
    <Text style={s.cardTitle}>What do you need?</Text>
    <Text style={s.cardSub}>Find the right professional for the job.</Text>
    <View style={s.serviceRow}>
     {services.map(name=><View key={name} style={s.service}>
       <ServiceIcon name={name} size={44}/>
       <Text style={s.serviceText}>{name}</Text>
     </View>)}
    </View>
   </View>

   <View style={s.trust}>
    <Trust text="Verified Professionals"/>
    <Trust text="Safe & Secure"/>
    <Trust text="Transparent Process"/>
   </View>

   <View style={s.dots}>
    <View style={s.activeDot}/><View style={s.dot}/><View style={s.dot}/>
   </View>

   <Pressable style={s.button} onPress={()=>router.replace("/select-mode")}>
    <Text style={s.buttonText}>Get Started</Text>
   </Pressable>

   <Text style={s.bottom}>Connect with skills. Get work done.</Text>
  </View>
 </SafeAreaView>
}

function Trust({text}:{text:string}){
 return <View style={s.trustItem}>
  <Text style={s.check}>✓</Text>
  <Text style={s.trustText}>{text}</Text>
 </View>
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#F7FAF8"},
 container:{flex:1,paddingHorizontal:24,paddingTop:28,paddingBottom:18,alignItems:"center",justifyContent:"center"},
 title:{fontSize:28,fontWeight:"900",color:"#13201C",textAlign:"center",marginTop:24,letterSpacing:-.5},
 subtitle:{fontSize:15,fontWeight:"800",color:"#FF4B1F",marginTop:7},
 description:{fontSize:13,color:"#71807A",marginTop:4,textAlign:"center"},
 card:{width:"100%",backgroundColor:"#EAF8F4",borderRadius:22,padding:20,marginTop:24,borderWidth:1,borderColor:"#D7EEE7"},
 cardTitle:{fontSize:18,fontWeight:"900",color:"#13201C"},
 cardSub:{fontSize:12,color:"#687771",marginTop:4},
 serviceRow:{flexDirection:"row",justifyContent:"space-between",marginTop:18},
 service:{width:"23%",alignItems:"center"},
 serviceText:{fontSize:9,fontWeight:"800",color:"#34433E",textAlign:"center",marginTop:7},
 trust:{width:"100%",flexDirection:"row",justifyContent:"space-between",marginTop:18},
 trustItem:{flexDirection:"row",alignItems:"center",width:"31%"},
 check:{width:22,height:22,borderRadius:11,backgroundColor:"#DDF4EC",color:"#FF4B1F",textAlign:"center",paddingTop:2,fontWeight:"900"},
 trustText:{fontSize:9,fontWeight:"700",color:"#52615C",marginLeft:5,flexShrink:1},
 dots:{flexDirection:"row",gap:5,marginTop:18},
 activeDot:{width:22,height:5,borderRadius:3,backgroundColor:"#FF4B1F"},
 dot:{width:6,height:5,borderRadius:3,backgroundColor:"#C9D7D2"},
 button:{width:"100%",height:54,borderRadius:14,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:15},
 buttonText:{color:"#fff",fontWeight:"900",fontSize:16},
 bottom:{fontSize:11,color:"#8A9691",marginTop:13}
});