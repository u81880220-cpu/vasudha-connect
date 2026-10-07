import { router } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";

export default function SelectMode(){
 return <SafeAreaView style={s.safe}>
  <View style={s.container}>
   <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={()=>router.back()} style={s.backButton}>
    <Text style={s.back}>‹</Text>
   </Pressable>

   <VasudhaLogo/>
   <Text style={s.title}>How do you want to use{"\n"}KAMPRO?</Text>
   <Text style={s.sub}>Choose your role to get started.</Text>

   <Pressable style={s.card} onPress={()=>router.replace({pathname:"/auth",params:{mode:"customer"}})}>
    <View style={[s.iconBox,s.customerBox]}><Text style={s.icon}>⌕</Text></View>
    <View style={s.copy}>
     <Text style={s.cardTitle}>I need a professional</Text>
     <Text style={s.cardSub}>Find trusted skills around you for your work.</Text>
    </View>
    <Text style={s.arrow}>›</Text>
   </Pressable>

   <Pressable style={s.card} onPress={()=>router.replace({pathname:"/auth",params:{mode:"professional"}})}>
    <View style={[s.iconBox,s.proBox]}><Text style={s.icon}>⚒</Text></View>
    <View style={s.copy}>
     <Text style={s.cardTitle}>I am a professional</Text>
     <Text style={s.cardSub}>Show your skills and connect with customers.</Text>
    </View>
    <Text style={s.arrow}>›</Text>
   </Pressable>

   <View style={s.footer}><Text style={s.footerText}>Find skills. Connect. Get things done.</Text></View>
  </View>
 </SafeAreaView>
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#F7FAF8"},
 container:{width:"100%",maxWidth:760,alignSelf:"center",flex:1,padding:28,alignItems:"center"},
 backButton:{alignSelf:"flex-start",width:42,height:42,justifyContent:"center"},
 back:{fontSize:34,lineHeight:38,color:"#13201C"},
 title:{fontSize:23,fontWeight:"900",textAlign:"center",color:"#13201C",marginTop:22,lineHeight:29},
 sub:{fontSize:13,color:"#71807A",marginTop:7,marginBottom:25},
 card:{width:"100%",minHeight:132,borderWidth:1,borderColor:KAMPRO.border,borderRadius:20,backgroundColor:KAMPRO.surface,padding:18,marginBottom:16,flexDirection:"row",alignItems:"center",shadowColor:KAMPRO.navy,shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:2},
 iconBox:{width:70,height:70,borderRadius:18,alignItems:"center",justifyContent:"center"},
 customerBox:{backgroundColor:"#FFF0EA"},proBox:{backgroundColor:"#FFF1E2"},
 icon:{fontSize:34,fontWeight:"900",color:"#FF4B1F"},
 copy:{flex:1,marginLeft:15,paddingRight:8},
 cardTitle:{fontSize:17,fontWeight:"900",color:"#13201C"},
 cardSub:{fontSize:12,color:"#71807A",lineHeight:18,marginTop:5},
 arrow:{fontSize:30,color:"#FF4B1F",fontWeight:"400"},
 footer:{flex:1,justifyContent:"flex-end",paddingBottom:18},
 footerText:{fontSize:11,color:"#8A9691"}
});