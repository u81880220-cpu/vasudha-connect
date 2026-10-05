import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";

export default function ProfessionalPublic(){
 const{professionalId}=useLocalSearchParams<{professionalId:string}>();
 const[data,setData]=useState<any>(null),[balance,setBalance]=useState(0),[busy,setBusy]=useState(false);
 useEffect(()=>{load();},[professionalId]);
 async function load(){
  if(!professionalId)return;
  const[{data:p,error:e},{data:b}]=await Promise.all([
   supabase.rpc("get_professional_public_profile",{p_professional_id:professionalId}),
   supabase.rpc("get_connection_balance")
  ]);
  if(e)Alert.alert("Profile unavailable",e.message); else setData(p);
  setBalance(b||0);
 }
 async function unlock(){
  if(!professionalId)return;
  if(balance<1){router.push("/connection-packages");return;}
  setBusy(true);
  const{error}=await supabase.rpc("unlock_professional",{p_professional_id:professionalId});
  setBusy(false);
  if(error)Alert.alert("Unable to connect",error.message);else{Alert.alert("Connected","This professional is now unlocked for 30 days.");load();}
 }
 if(!data)return <SafeAreaView style={s.safe}><View style={s.container}><Text style={s.title}>Professional</Text><Text style={s.muted}>Loading profile...</Text></View></SafeAreaView>;
 return <SafeAreaView style={s.safe}>
  <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
    <View style={s.topbar}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><VasudhaLogo compact/><Text style={s.topbarAction}>♡</Text></View>
    <View style={s.hero}>
      <View style={s.avatar}><Text style={s.avatarText}>{(data.profile?.display_name||"P").slice(0,1).toUpperCase()}</Text></View>
      <View style={s.heroInfo}><Text style={s.title}>{data.profile?.display_name||"Professional"}</Text><Text style={s.headline}>{data.professional?.headline||"Verified professional"}</Text><View style={s.verifiedRow}><Text style={s.verified}>✓ Verified</Text><Text style={s.available}>{data.professional?.is_available?"● Available now":"● Currently unavailable"}</Text></View></View>
    </View>
    <View style={s.stats}><View><Text style={s.statValue}>{Math.round(data.professional?.trust_score||0)}/100</Text><Text style={s.statLabel}>Trust score</Text></View><View><Text style={s.statValue}>{data.professional?.years_experience||0}+</Text><Text style={s.statLabel}>Years experience</Text></View><View><Text style={s.statValue}>{data.profile?.city||"Nearby"}</Text><Text style={s.statLabel}>Service area</Text></View></View>
    <View style={s.actions}><Pressable style={s.secondary}><Text style={s.secondaryText}>Message</Text></Pressable><Pressable onPress={unlock} disabled={busy} style={s.primary}><Text style={s.primaryText}>{busy?"Connecting…":data.profile?.connected?"Connected":"Connect"}</Text></Pressable></View>
    <View style={s.tabs}><Text style={s.tabActive}>About</Text><Text style={s.tab}>Reviews</Text><Text style={s.tab}>Work Photos</Text></View>
    <Text style={s.label}>Skills</Text><View style={s.wrap}>{(data.skills||[]).map((x:any)=><Text key={x.id} style={s.chip}>{x.name}</Text>)}</View>
    <Text style={s.label}>About</Text><Text style={s.body}>{data.professional?.about||"Experienced and verified professional. Connect to unlock full profile details."}</Text>
    <Text style={s.label}>Portfolio</Text>{(data.portfolio||[]).length===0?<Text style={s.muted}>No approved work photos yet.</Text>:(data.portfolio||[]).map((x:any)=><View key={x.id} style={s.portfolio}><Text style={s.portfolioTitle}>{x.title}</Text>{x.description?<Text style={s.body}>{x.description}</Text>:null}</View>)}
    <View style={s.connectBox}><Text style={s.connectTitle}>{data.profile?.connected?"Profile unlocked":"Unlock this professional"}</Text><Text style={s.muted}>{data.profile?.connected?"You can now request a quotation and chat directly.":"One connection unlocks direct access for 30 days."}</Text><Text style={s.balance}>Connections available: {balance}</Text><Pressable onPress={()=>data.profile?.connected?router.push({pathname:"/service-request",params:{professionalId}}):unlock()} disabled={busy} style={s.primary}><Text style={s.primaryText}>{data.profile?.connected?"Request a quotation":balance>0?"Use 1 connection":"Get connections"}</Text></Pressable></View>
  </ScrollView><AppBottomNav active="map"/>
 </SafeAreaView>;
}
const s=StyleSheet.create({
safe:{flex:1,backgroundColor:"#fff"},container:{padding:18,paddingBottom:90},
topbar:{height:46,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#f2f7f5",alignItems:"center",justifyContent:"center"},backText:{fontSize:30,color:"#13201c",marginTop:-3},topbarAction:{fontSize:28,color:"#087D65"},
hero:{flexDirection:"row",alignItems:"center",marginTop:10},avatar:{width:82,height:82,borderRadius:41,backgroundColor:"#e7f7f2",alignItems:"center",justifyContent:"center"},avatarText:{fontSize:30,fontWeight:"900",color:"#087D65"},heroInfo:{flex:1,marginLeft:14},title:{fontSize:25,fontWeight:"900",color:"#13201c"},headline:{fontSize:14,color:"#66736e",marginTop:4},verifiedRow:{flexDirection:"row",gap:10,marginTop:9,flexWrap:"wrap"},verified:{color:"#087D65",fontWeight:"800"},available:{color:"#087D65",fontSize:12,fontWeight:"700"},
stats:{flexDirection:"row",justifyContent:"space-between",marginTop:20,padding:16,borderRadius:16,backgroundColor:"#f2f8f6",borderWidth:1,borderColor:"#e0e8e5"},statValue:{fontWeight:"900",fontSize:16,color:"#13201c"},statLabel:{fontSize:11,color:"#66736e",marginTop:4},actions:{flexDirection:"row",gap:10,marginTop:14},primary:{flex:1,backgroundColor:"#087D65",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"},secondary:{flex:1,borderWidth:1,borderColor:"#087D65",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},secondaryText:{color:"#087D65",fontWeight:"900"},tabs:{flexDirection:"row",gap:24,borderBottomWidth:1,borderColor:"#e2e8e5",marginTop:22,paddingBottom:10},tabActive:{color:"#087D65",fontWeight:"900"},tab:{color:"#66736e",fontWeight:"700"},label:{fontWeight:"900",fontSize:17,color:"#13201c",marginTop:20,marginBottom:9},body:{color:"#46534f",lineHeight:21},wrap:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:18,paddingHorizontal:11,paddingVertical:7,color:"#13201c",backgroundColor:"#fff"},portfolio:{borderWidth:1,borderColor:"#e0e8e5",borderRadius:14,padding:13,marginTop:8,backgroundColor:"#fbfdfc"},portfolioTitle:{fontWeight:"900",color:"#13201c"},connectBox:{borderWidth:1,borderColor:"#bcd9d0",borderRadius:16,padding:16,marginTop:24,backgroundColor:"#f2f8f6"},connectTitle:{fontSize:18,fontWeight:"900",color:"#13201c"},balance:{fontWeight:"800",marginTop:10,color:"#13201c"},muted:{color:"#66736e",marginTop:6},disabled:{opacity:.45}
});