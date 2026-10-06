import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";

type DashboardProfile={verification_status?:string|null;is_available?:boolean|null;trust_score?:number|null;response_rate?:number|null;completion_rate?:number|null};
type CustomerReputation={trust_score?:number|null;jobs_completed?:number|null};

export default function ProfessionalDashboard(){
 const{user}=useAuth();const[requests,setRequests]=useState<any[]>([]);const[jobs,setJobs]=useState<any[]>([]);const[profile,setProfile]=useState<DashboardProfile|null>(null);const[customerRep,setCustomerRep]=useState<Record<string,CustomerReputation>>({});const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 useEffect(()=>{load()},[user?.id]);
 async function load(){
  if(!user)return;setLoading(true);setError("");
  const results=await Promise.all([
   supabase.from("professional_profiles").select("verification_status,is_available,trust_score,response_rate,completion_rate").eq("user_id",user.id).maybeSingle(),
   supabase.rpc("get_professional_requests"),
   supabase.from("jobs").select("id,request_id,title,status,created_at,customer_id").eq("professional_id",user.id).order("created_at",{ascending:false}).limit(20)
  ]);
  const firstError=results.find(x=>x.error)?.error;if(firstError){setError(firstError.message);Alert.alert("Unable to load dashboard",firstError.message);}
  setProfile(results[0].data);setRequests(results[1].data||[]);setJobs(results[2].data||[]);
  const ids=[...(results[1].data||[]),...(results[2].data||[])].map((x:any)=>x.customer_id).filter(Boolean);
  const reps:Record<string,CustomerReputation>={};for(const id of [...new Set(ids)]){const{data}=await supabase.rpc("get_customer_reputation",{p_customer_id:id});if(data)reps[id]=data;}setCustomerRep(reps);setLoading(false);
 }
 async function acceptRequest(requestId:string){
  const{data:jobId,error}=await supabase.rpc("accept_service_request",{p_request_id:requestId});
  if(error){Alert.alert("Unable to accept job",error.message);return;}
  Alert.alert("Job accepted","The customer contact and job location are now available for this accepted job.");
  load();
  if(jobId)router.push({pathname:"/job-details",params:{jobId}});
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <VasudhaLogo compact/><Text style={s.title}>Professional Dashboard</Text><Text style={s.subtitle}>Manage your VASUDHA CONNECT work</Text>
  <Pressable onPress={()=>router.push("/professional-onboarding")} style={s.profileBtn}><Text style={s.profileText}>Complete / Continue Registration</Text></Pressable><Pressable onPress={()=>router.push("/complaints")} style={s.secondary}><Text>Complaints & Reports</Text></Pressable>
  {loading?<View style={s.state}><ActivityIndicator/><Text style={s.muted}>Loading your dashboard…</Text></View>:error?<View style={s.state}><Text style={s.errorTitle}>Couldn't load your dashboard</Text><Text style={s.muted}>{error}</Text><Pressable onPress={load} style={s.secondary}><Text>Try again</Text></Pressable></View>:<>
   <View style={s.stats}><View style={s.stat}><Text style={s.num}>{Math.round(profile?.trust_score||0)}</Text><Text>Trust</Text></View><View style={s.stat}><Text style={s.num}>{profile?.completion_rate||0}%</Text><Text>Completion</Text></View><View style={s.stat}><Text style={s.num}>{profile?.response_rate||0}%</Text><Text>Response</Text></View></View>
   <View style={s.card}><Text style={s.cardTitle}>Professional status</Text><Text>{profile?.verification_status==="verified"?"✓ Verified":"Verification: "+(profile?.verification_status||"unverified")}</Text><Text>{profile?.is_available?"Available for work":"Currently unavailable"}</Text><Pressable onPress={()=>router.push("/professional-profile")} style={s.secondary}><Text>Edit Professional Profile</Text></Pressable></View>
   <Text style={s.section}>Customer Requests</Text>
   {requests.length===0?<Text style={s.muted}>No customer requests yet.</Text>:requests.map((item:any)=>{const customer=customerRep[item.customer_id];return <View key={item.id} style={s.card}><Text style={s.name}>{item.title}</Text><Text style={s.desc}>{item.description}</Text>{item.preferred_date?<Text style={s.detail}>Preferred: {item.preferred_date}{item.preferred_time?" · "+item.preferred_time:""}</Text>:null}<Text style={s.trust}>Customer Trust: {Math.round(customer?.trust_score||0)}/100 · {customer?.jobs_completed||0} completed jobs</Text>{item.status==="requested"?<Pressable onPress={()=>acceptRequest(item.id)} style={s.primary}><Text style={s.primaryText}>Accept Job</Text></Pressable>:<><Text style={s.status}>Job accepted</Text>{(()=>{const j=jobs.find((job:any)=>job.request_id===item.id);return j?<Pressable onPress={()=>router.push({pathname:"/job-details",params:{jobId:j.id}})} style={s.secondary}><Text>Open Job</Text></Pressable>:null})()}</>}</View>})}
   <Text style={s.section}>My Jobs</Text>
   {jobs.length===0?<Text style={s.muted}>No jobs yet.</Text>:jobs.map((item:any)=><View key={item.id} style={s.card}><Text style={s.name}>{item.title}</Text><Text style={s.status}>{item.status}</Text><Pressable onPress={()=>router.push({pathname:"/job-details",params:{jobId:item.id}})} style={s.secondary}><Text>Open Job</Text></Pressable></View>)}
  </>}
 </ScrollView><AppBottomNav/></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{padding:20,paddingBottom:104},title:{fontSize:28,fontWeight:"800",color:"#13201c"},subtitle:{opacity:.6,marginTop:5},stats:{flexDirection:"row",gap:10,marginTop:20},stat:{flex:1,borderWidth:1,borderColor:"#e2e8e5",borderRadius:14,padding:14,alignItems:"center",minHeight:78},num:{fontSize:22,fontWeight:"800",color:"#087D65"},card:{borderWidth:1,borderColor:"#e2e8e5",borderRadius:16,padding:16,marginTop:12},cardTitle:{fontSize:18,fontWeight:"800"},name:{fontSize:17,fontWeight:"800"},desc:{marginVertical:8,opacity:.75,lineHeight:19},detail:{fontSize:12,color:"#66736e",marginTop:5},status:{fontWeight:"800",marginTop:8,color:"#087D65"},trust:{marginTop:8,fontWeight:"700",lineHeight:18},section:{fontSize:21,fontWeight:"800",marginTop:25,color:"#13201c"},muted:{opacity:.6,marginTop:8,lineHeight:19},primary:{marginTop:12,borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#087D65",minHeight:46,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},profileBtn:{marginTop:14,borderWidth:1,borderColor:"#cfdad6",borderRadius:12,padding:12,alignItems:"center",minHeight:44,justifyContent:"center"},profileText:{fontWeight:"800"},secondary:{marginTop:12,borderWidth:1,borderColor:"#cfdad6",borderRadius:12,padding:12,minHeight:44,alignItems:"center",justifyContent:"center"},state:{alignItems:"center",paddingVertical:40},errorTitle:{fontWeight:"800",fontSize:17,color:"#b42318"}});
