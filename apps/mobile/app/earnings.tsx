import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";

export default function Earnings(){
 const{user}=useAuth();const[data,setData]=useState<any>(null);const[loading,setLoading]=useState(true);
 useEffect(()=>{if(user?.id)load()},[user?.id]);
 async function load(){const{data}=await supabase.from("professional_profiles").select("trust_score,response_rate,completion_rate,cancellation_rate,verification_status,is_available").eq("user_id",user?.id).maybeSingle();setData(data||{});setLoading(false)}
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.c} showsVerticalScrollIndicator={false}><VasudhaLogo compact/><Text style={s.title}>My Performance</Text><Text style={s.sub}>Your VASUDHA CONNECT reputation and work performance.</Text>{loading?<View style={s.state}><ActivityIndicator color="#087D65"/><Text style={s.sub}>Loading performance…</Text></View>:<><View style={s.hero}><Text style={s.heroLabel}>Professional Trust</Text><Text style={s.heroValue}>{Math.round(data?.trust_score||0)}/100</Text><Text style={s.heroMeta}>{data?.verification_status==="verified"?"✓ Verified":"Verification pending"} · {data?.is_available?"Available":"Unavailable"}</Text></View><View style={s.stats}><Stat n={data?.completion_rate||0} l="Completion %"/><Stat n={data?.response_rate||0} l="Response %"/><Stat n={data?.cancellation_rate||0} l="Cancellation %"/></View><View style={s.note}><Text style={s.noteTitle}>Direct customer payment</Text><Text style={s.sub}>VASUDHA CONNECT does not collect or display your service earnings. Customers pay professionals directly outside the platform.</Text></View></>}</ScrollView><AppBottomNav active="profile"/></SafeAreaView>;
}
function Stat({n,l}:{n:any;l:string}){return <View style={s.stat}><Text style={s.num}>{n}%</Text><Text style={s.label}>{l}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},c:{padding:20,paddingBottom:100},title:{fontSize:28,fontWeight:"900",color:"#13201c"},sub:{color:"#66736e",marginTop:5,lineHeight:19},hero:{marginTop:18,borderRadius:18,backgroundColor:"#087D65",padding:20},heroLabel:{color:"#dff8f1",fontWeight:"800"},heroValue:{color:"#fff",fontSize:34,fontWeight:"900",marginTop:5},heroMeta:{color:"#dff8f1",marginTop:2},stats:{flexDirection:"row",gap:10,marginTop:12},stat:{flex:1,borderWidth:1,borderColor:"#e2e8e5",borderRadius:15,padding:14},num:{fontSize:19,fontWeight:"900",color:"#087D65"},label:{fontSize:11,color:"#66736e",marginTop:4},note:{borderWidth:1,borderColor:"#bcd9d0",borderRadius:16,padding:16,marginTop:20,backgroundColor:"#f2f8f6"},noteTitle:{fontSize:17,fontWeight:"900",color:"#13201c"},state:{alignItems:"center",paddingVertical:40}});
