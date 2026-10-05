import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";

export default function Onboarding(){
 return <SafeAreaView style={s.safe}><View style={s.container}>
   <VasudhaLogo/>
   <Text style={s.title}>Find Trusted Professionals</Text>
   <Text style={s.sub}>Skilled. Verified. Reliable.{"\n"}For Your Home & Property.</Text>
   <View style={s.hero}><View style={s.people}><Text style={s.person}>👷</Text><Text style={s.person}>🧑‍🔧</Text><Text style={s.person}>👩‍🔧</Text><Text style={s.person}>👨‍🔧</Text></View></View>
   <View style={s.points}>
    {["Verified Professionals","Safe & Secure","Transparent Process","Quality Service"].map(x=><View key={x} style={s.point}><Text style={s.tick}>✓</Text><Text>{x}</Text></View>)}
   </View>
   <View style={s.dots}><View style={s.dotOn}/><View style={s.dot}/><View style={s.dot}/><View style={s.dot}/></View>
   <Pressable style={s.button} onPress={()=>router.replace("/auth")}><Text style={s.buttonText}>Get Started</Text></Pressable>
 </View></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{flex:1,padding:24,alignItems:"center",justifyContent:"center"},title:{fontSize:24,fontWeight:"900",color:"#13201c",textAlign:"center",marginTop:18},sub:{fontSize:15,color:"#66736e",textAlign:"center",marginTop:8,lineHeight:22},hero:{width:"100%",height:230,marginTop:18,borderRadius:24,backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center"},people:{flexDirection:"row",alignItems:"flex-end",gap:8},person:{fontSize:58},points:{width:"100%",marginTop:18,gap:10},point:{flexDirection:"row",alignItems:"center",gap:10},tick:{width:24,height:24,borderRadius:12,backgroundColor:"#E7F7F2",color:"#087D65",textAlign:"center",paddingTop:2,fontWeight:"900"},dots:{flexDirection:"row",gap:5,marginTop:18},dotOn:{width:20,height:5,borderRadius:3,backgroundColor:"#087D65"},dot:{width:6,height:5,borderRadius:3,backgroundColor:"#cfdad6"},button:{width:"100%",height:52,borderRadius:12,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center",marginTop:18},buttonText:{color:"#fff",fontWeight:"900",fontSize:16}});
