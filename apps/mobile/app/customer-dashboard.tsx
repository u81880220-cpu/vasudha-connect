import { useEffect,useState } from "react";
import { Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { AppBottomNav } from "../src/components/AppBottomNav";

export default function CustomerDashboard(){
 const {user}=useAuth();const [connections,setConnections]=useState<any[]>([]);const [requests,setRequests]=useState<any[]>([]);const [jobs,setJobs]=useState<any[]>([]);const [loading,setLoading]=useState(true);
 useEffect(()=>{load();},[user?.id]);
 async function load(){if(!user)return;setLoading(true);const [{data:c},{data:r},{data:j}]=await Promise.all([
  supabase.from("professional_connections").select("id,professional_id,expires_at").eq("customer_id",user.id).gt("expires_at",new Date().toISOString()).order("expires_at",{ascending:true}),
  supabase.from("service_requests").select("id,title,description,status,professional_id,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(20),
  supabase.from("jobs").select("id,title,agreed_amount_inr,status,professional_id,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(20)
 ]);setConnections(c||[]);setRequests(r||[]);setJobs(j||[]);setLoading(false);}
 async function openQuotes(id:string){router.push({pathname:"/quotes",params:{requestId:id}});}
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}><VasudhaLogo/><Text style={s.title}>Customer Dashboard</Text><Text style={s.subtitle}>Everything you're managing in VASUDHA CONNECT</Text>{loading?<Text style={s.muted}>Loading...</Text>:<><View style={s.stats}><View style={s.stat}><Text style={s.num}>{connections.length}</Text><Text>Connections</Text></View><View style={s.stat}><Text style={s.num}>{requests.length}</Text><Text>Requests</Text></View><View style={s.stat}><Text style={s.num}>{jobs.length}</Text><Text>Jobs</Text></View></View><Pressable onPress={()=>router.push("/marketplace")} style={s.primary}><Text style={s.primaryText}>Find Professionals</Text></Pressable><Text style={s.section}>Service Requests</Text>{requests.length===0?<Text style={s.muted}>No service requests yet.</Text>:requests.map(r=><View key={r.id} style={s.card}><Text style={s.name}>{r.title}</Text><Text style={s.status}>{r.status}</Text>{r.status==="requested"?<Pressable onPress={()=>openQuotes(r.id)} style={s.secondary}><Text>View Quotations</Text></Pressable>:null}</View>)}<Text style={s.section}>Active & Past Jobs</Text>{jobs.length===0?<Text style={s.muted}>No jobs yet.</Text>:jobs.map(j=><View key={j.id} style={s.card}><Text style={s.name}>{j.title}</Text><Text>₹{Number(j.agreed_amount_inr).toLocaleString("en-IN")}</Text><Text style={s.status}>{j.status}</Text><Pressable onPress={()=>router.push("/jobs")} style={s.secondary}><Text>Open Tracking</Text></Pressable></View>)}<Text style={s.section}>Connections</Text>{connections.length===0?<Text style={s.muted}>No active connections.</Text>:<Pressable onPress={()=>router.push("/connections")} style={s.secondary}><Text>Open My Connections & Chat</Text></Pressable>}</>}</ScrollView><AppBottomNav/></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800"},subtitle:{opacity:.6,marginTop:5},stats:{flexDirection:"row",gap:10,marginTop:20},stat:{flex:1,borderWidth:1,borderRadius:14,padding:14,alignItems:"center"},num:{fontSize:22,fontWeight:"800"},primary:{marginTop:18,borderRadius:12,padding:14,alignItems:"center",backgroundColor:"#087D65"},primaryText:{color:"#fff",fontWeight:"800"},section:{fontSize:21,fontWeight:"800",marginTop:25},card:{borderWidth:1,borderRadius:16,padding:16,marginTop:12},name:{fontSize:17,fontWeight:"800"},status:{fontWeight:"800",marginTop:8},muted:{opacity:.6,marginTop:8},secondary:{marginTop:10,borderWidth:1,borderRadius:12,padding:12,alignItems:"center"}});
