import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { KamproPage, KamproHeader, KamproCard, KamproPrimary, KamproSecondary, KamproSection } from "../src/components/KamproUI";

type DashboardProfile={verification_status?:string|null;is_available?:boolean|null;trust_score?:number|null;completion_rate?:number|null};

export default function ProfessionalDashboard(){
 const{user}=useAuth();const[requests,setRequests]=useState<any[]>([]);const[activeJob,setActiveJob]=useState<any>(null);const[profile,setProfile]=useState<DashboardProfile|null>(null);const[connections,setConnections]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 useEffect(()=>{load()},[user?.id]);
 async function acceptRequest(id:string){const{data,error}=await supabase.rpc("accept_service_request",{p_request_id:id});if(error){Alert.alert("Unable to accept job",error.message);return;}if(data)router.push({pathname:"/job-tracking",params:{jobId:data}});else await load()}
 async function load(){
  if(!user)return;setLoading(true);setError("");
  const results=await Promise.all([
   supabase.from("professional_profiles").select("verification_status,is_available,trust_score,completion_rate").eq("user_id",user.id).maybeSingle(),
   supabase.from("professional_connections").select("id,customer_id,expires_at,last_accessed_at").eq("professional_id",user.id).gt("expires_at",new Date().toISOString()).order("last_accessed_at",{ascending:false}).limit(20),
   supabase.from("jobs").select("id,title,status").eq("professional_id",user.id).in("status",["worker_accepted","on_the_way","arrived","work_started"]).order("updated_at",{ascending:false}).limit(1),
   supabase.rpc("get_professional_requests")
  ]);
  const firstError=results.find(x=>x.error)?.error;if(firstError){setError(firstError.message);Alert.alert("Unable to load dashboard",firstError.message);}
  setProfile(results[0].data);setConnections(results[1].data||[]);setActiveJob(results[2].data?.[0]||null);setRequests((results[3].data||[]).filter((x:any)=>x.status==="requested"));setLoading(false);
 }
 return <KamproPage><KamproHeader title="Professional Dashboard" subtitle="Manage your KAMPRO profile and customer connections"/>
  <Pressable onPress={()=>router.push("/professional-onboarding")} style={s.profileBtn}><Text style={s.profileText}>Complete / Continue Registration</Text></Pressable>
  <Pressable onPress={()=>router.push("/professional-subscription")} style={s.primary}><Text style={s.primaryText}>Manage Professional Subscription</Text></Pressable>
  <Pressable onPress={()=>router.push("/connections")} style={s.secondary}><Text>My Customer Connections</Text></Pressable>{activeJob?<Pressable onPress={()=>router.push({pathname:"/job-tracking",params:{jobId:activeJob.id}})} style={s.primary}><Text style={s.primaryText}>Open Current Job · {activeJob.status}</Text></Pressable>:null}
  {loading?<View style={s.state}><ActivityIndicator/><Text style={s.muted}>Loading your dashboard…</Text></View>:error?<View style={s.state}><Text style={s.errorTitle}>Couldn't load your dashboard</Text><Text style={s.muted}>{error}</Text><Pressable onPress={load} style={s.secondary}><Text>Try again</Text></Pressable></View>:<>
   <View style={s.stats}><View style={s.stat}><Text style={s.num}>{Math.round(profile?.trust_score||0)}</Text><Text>Trust</Text></View><View style={s.stat}><Text style={s.num}>{connections.length}</Text><Text>Connections</Text></View><View style={s.stat}><Text style={s.num}>{profile?.completion_rate||0}%</Text><Text>Completion</Text></View></View>
   <View style={s.card}><Text style={s.cardTitle}>Professional status</Text><Text>{profile?.verification_status==="verified"?"✓ Verified":"Verification: "+(profile?.verification_status||"unverified")}</Text><Text>{profile?.is_available?"Available for customers":"Currently unavailable"}</Text><Pressable onPress={()=>router.push("/professional-profile")} style={s.secondary}><Text>Edit Professional Profile</Text></Pressable></View>
   <Text style={s.section}>Job requests</Text>{requests.length===0?<Text style={s.muted}>No pending job requests.</Text>:requests.map((r:any)=><View key={r.id} style={s.card}><Text style={s.cardTitle}>{r.title||"Job request"}</Text><Text style={s.muted}>{r.description||"No description"}</Text><Text style={s.muted}>{r.preferred_date||""} {r.preferred_time||""}</Text><Pressable onPress={()=>acceptRequest(r.id)} style={s.primary}><Text style={s.primaryText}>Accept Job</Text></Pressable></View>)}<Text style={s.section}>How KAMPRO works</Text>
   <View style={s.card}><Text style={s.step}>1. Stay verified and keep your profile active.</Text><Text style={s.step}>2. Customers discover you and unlock a connection.</Text><Text style={s.step}>3. Customer and professional communicate directly by call/chat.</Text><Text style={s.step}>4. Service scope, price, schedule and payment are agreed directly between both parties.</Text></View>
   <Text style={s.section}>Quick actions</Text>
   <View style={s.grid}><Pressable onPress={()=>router.push("/professional-verification")} style={s.action}><Text style={s.actionIcon}>✓</Text><Text>Verification</Text></Pressable><Pressable onPress={()=>router.push("/professional-profile")} style={s.action}><Text style={s.actionIcon}>⌂</Text><Text>Services & area</Text></Pressable></View>
  </>}
 </KamproPage><AppBottomNav/>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{padding:20,paddingBottom:104},title:{fontSize:28,fontWeight:"800",color:"#10233F"},subtitle:{opacity:.6,marginTop:5,lineHeight:19},stats:{flexDirection:"row",gap:10,marginTop:20},stat:{flex:1,borderWidth:1,borderColor:"#E7EAF0",borderRadius:14,padding:14,alignItems:"center",minHeight:78},num:{fontSize:22,fontWeight:"800",color:"#FF4B1F"},card:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,marginTop:12},cardTitle:{fontSize:18,fontWeight:"800"},step:{lineHeight:21,marginTop:7},muted:{opacity:.6,marginTop:8,lineHeight:19},primary:{marginTop:12,borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#FF4B1F",minHeight:46,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},profileBtn:{marginTop:14,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,padding:12,alignItems:"center",minHeight:44,justifyContent:"center"},profileText:{fontWeight:"800"},secondary:{marginTop:10,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,padding:12,minHeight:44,alignItems:"center",justifyContent:"center"},section:{fontSize:21,fontWeight:"800",marginTop:25,color:"#10233F"},grid:{flexDirection:"row",gap:10,marginTop:12},action:{flex:1,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,alignItems:"center"},actionIcon:{fontSize:22,color:"#FF4B1F",fontWeight:"900",marginBottom:5},state:{alignItems:"center",paddingVertical:40},errorTitle:{fontWeight:"800",fontSize:17,color:"#b42318"}});