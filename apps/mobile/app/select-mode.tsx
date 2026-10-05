import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
export default function SelectMode(){
 return <SafeAreaView style={s.safe}><View style={s.container}>
   <Pressable onPress={()=>router.back()}><Text style={s.back}>‹</Text></Pressable>
   <VasudhaLogo/>
   <Text style={s.title}>How do you want to use{"\n"}VASUDHA CONNECT?</Text>
   <Pressable style={s.card} onPress={()=>router.replace({pathname:"/auth",params:{mode:"customer"}})}>
    <View style={s.illustration}><Text style={s.emoji}>🏠</Text></View><Text style={s.cardTitle}>I am a Customer</Text><Text style={s.cardSub}>Find trusted professionals{"\n"}for your property needs</Text><Text style={s.arrow}>›</Text>
   </Pressable>
   <Pressable style={s.card} onPress={()=>router.replace({pathname:"/auth",params:{mode:"professional"}})}>
    <View style={s.illustration}><Text style={s.emoji}>👷</Text></View><Text style={s.cardTitle}>I am a Professional</Text><Text style={s.cardSub}>Grow your business and{"\n"}get more customers</Text><Text style={s.arrow}>›</Text>
   </Pressable>
 </View></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{flex:1,padding:20},back:{fontSize:32,color:"#13201c",marginBottom:8},title:{fontSize:18,fontWeight:"900",textAlign:"center",marginVertical:16,color:"#13201c"},card:{borderWidth:1,borderColor:"#e1e9e6",borderRadius:18,overflow:"hidden",padding:18,marginBottom:16,backgroundColor:"#f8fcfb"},illustration:{height:100,backgroundColor:"#E7F7F2",borderRadius:14,alignItems:"center",justifyContent:"center",marginBottom:12},emoji:{fontSize:62},cardTitle:{fontSize:20,fontWeight:"900",textAlign:"center",color:"#13201c"},cardSub:{textAlign:"center",color:"#66736e",lineHeight:20,marginTop:5},arrow:{position:"absolute",right:18,bottom:20,fontSize:30,color:"#087D65"}});
