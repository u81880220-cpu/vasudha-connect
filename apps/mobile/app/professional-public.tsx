import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";

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
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Text style={s.title}>{data.profile?.display_name||"Professional"}</Text>
  <Text style={s.headline}>{data.professional?.headline||"Verified professional"}</Text>
  <View style={s.badge}><Text>✓ VERIFIED</Text></View>
  <Text style={s.label}>Trust Score</Text><Text style={s.score}>{Math.round(data.professional?.trust_score||0)}/100</Text>
  <Text style={s.label}>About</Text><Text>{data.professional?.about||"Connect to unlock full professional details."}</Text>
  <Text style={s.label}>Experience</Text><Text>{data.professional?.years_experience||0} years</Text>
  <Text style={s.label}>Skills</Text><View style={s.wrap}>{(data.skills||[]).map((x:any)=><Text key={x.id} style={s.chip}>{x.name}</Text>)}</View>
  <Text style={s.label}>Connection status</Text><Text style={s.muted}>{data.profile?.connected?"✓ Full profile unlocked":"Preview mode — connect to unlock full details and portfolio"}</Text><Text style={s.label}>Portfolio</Text>{(data.portfolio||[]).length===0?<Text style={s.muted}>No portfolio items yet.</Text>:(data.portfolio||[]).map((x:any)=><View key={x.id} style={s.portfolio}><Text style={{fontWeight:"800"}}>{x.title}</Text>{x.description?<Text>{x.description}</Text>:null}</View>)}
  <View style={s.connectBox}><Text style={s.connectTitle}>Connect with this professional</Text><Text style={s.muted}>One connection unlocks direct access for 30 days.</Text><Text style={s.balance}>Your connections: {balance}</Text><Pressable disabled={busy} onPress={unlock} style={s.primary}><Text style={s.primaryText}>{busy?"Connecting...":balance>0?"Use 1 connection":"Get connections"}</Text></Pressable>\n  <Pressable onPress={()=>router.push({pathname:"/service-request",params:{professionalId}})} style={[s.secondary,!data.profile?.connected&&s.disabled]} disabled={!data.profile?.connected}><Text style={s.secondaryText}>{data.profile?.connected?"Request a quotation":"Unlock profile to request quotation"}</Text></Pressable></View>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800"},headline:{fontSize:17,opacity:.7,marginTop:4},badge:{alignSelf:"flex-start",borderWidth:1,borderRadius:12,paddingHorizontal:10,paddingVertical:6,marginTop:12},label:{fontWeight:"800",marginTop:20,marginBottom:7},score:{fontSize:24,fontWeight:"800"},wrap:{flexDirection:"row",flexWrap:"wrap",gap:7},chip:{borderWidth:1,borderRadius:14,paddingHorizontal:10,paddingVertical:6},portfolio:{borderWidth:1,borderRadius:12,padding:12,marginTop:8},connectBox:{borderWidth:1,borderRadius:16,padding:16,marginTop:24},connectTitle:{fontSize:18,fontWeight:"800"},balance:{fontWeight:"800",marginTop:12},primary:{marginTop:12,borderRadius:12,padding:14,alignItems:"center",backgroundColor:"#087D65"},primaryText:{color:"#fff",fontWeight:"800"},muted:{opacity:.6},disabled:{opacity:.45}});