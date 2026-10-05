import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { supabase } from "../src/lib/supabase";

type P={code:string;name:string;connections:number;price_inr:number;validity_days:number};

export default function ConnectionPackages(){
 const [packages,setPackages]=useState<P[]>([]),[balance,setBalance]=useState(0),[loading,setLoading]=useState(true),[creating,setCreating]=useState<string|null>(null);
 useEffect(()=>{load();},[]);
 async function load(){
  setLoading(true);
  const [{data:p,error:pe},{data:b,error:be}]=await Promise.all([
   supabase.from("connection_packages").select("code,name,connections,price_inr,validity_days").eq("is_active",true).order("price_inr"),
   supabase.rpc("get_connection_balance")
  ]);
  if(pe||be) Alert.alert("Unable to load packages",pe?.message||be?.message||"Please try again.");
  setPackages(p||[]); setBalance(Number(b||0)); setLoading(false);
 }
 async function startPayment(code:string){
  setCreating(code);
  const {data,error}=await supabase.rpc("create_connection_payment_order",{p_package:code});
  setCreating(null);
  if(error){Alert.alert("Unable to start payment",error.message);return;}
  Alert.alert("Payment gateway not connected","Order "+(data?.id||"")+" was created for ₹"+Number(data?.amount_inr||0).toLocaleString("en-IN")+". No connection credits were added. The secure checkout will be enabled when the gateway is connected.");
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Text style={s.title}>Connection Packages</Text><Text style={s.sub}>Unlock verified professionals and connect directly.</Text>
  <View style={s.balance}><Text>Available connections</Text><Text style={s.balanceValue}>{balance}</Text><Text style={s.balanceHint}>Credits are used only when you unlock a professional.</Text></View>
  <View style={s.notice}><Text style={s.noticeTitle}>Secure payment coming next</Text><Text style={s.muted}>Packages are ready. Payment orders are separated from wallet credits, so credits can only be added after a verified gateway payment.</Text></View>
  {loading?<Text style={s.muted}>Loading packages...</Text>:packages.map(p=><View key={p.code} style={s.card}>
   <View style={s.row}><View><Text style={s.name}>{p.name}</Text><Text style={s.muted}>{p.connections} connections • {p.validity_days} days</Text></View><Text style={s.price}>₹{p.price_inr}</Text></View>
   <Text style={s.per}>₹{(p.price_inr/p.connections).toFixed(2)} per connection</Text>
   <Pressable disabled={creating!==null} onPress={()=>startPayment(p.code)} style={[s.buy,creating!==null&&s.buyDisabled]}><Text style={s.buyText}>{creating===p.code?"Creating secure order...":"Continue to payment"}</Text></Pressable>
  </View>)}
  <Link href="/marketplace" asChild><Pressable style={s.back}><Text style={s.backText}>Back to professionals</Text></Pressable></Link>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800"},sub:{marginTop:5,opacity:.65,marginBottom:18},balance:{borderWidth:1,borderRadius:16,padding:16,marginBottom:12},balanceValue:{fontSize:30,fontWeight:"800",marginTop:4},balanceHint:{fontSize:12,opacity:.6,marginTop:4},notice:{borderWidth:1,borderRadius:14,padding:14,marginBottom:16},noticeTitle:{fontWeight:"800",marginBottom:4},card:{borderWidth:1,borderRadius:16,padding:16,marginBottom:12},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},name:{fontSize:18,fontWeight:"800"},price:{fontSize:20,fontWeight:"800"},muted:{opacity:.6,marginTop:4},per:{fontSize:12,opacity:.65,marginTop:8},buy:{marginTop:12,borderRadius:10,padding:13,alignItems:"center",backgroundColor:"#111"},buyDisabled:{opacity:.55},buyText:{color:"#fff",fontWeight:"800"},back:{borderWidth:1,borderRadius:12,padding:14,alignItems:"center",marginTop:8},backText:{fontWeight:"800"}});