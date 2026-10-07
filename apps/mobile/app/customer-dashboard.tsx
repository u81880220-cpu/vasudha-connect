import { useEffect,useState } from "react";
import { ActivityIndicator,Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { useAuth } from "../src/auth/AuthProvider";
import { KamproPage, KamproHeader, KamproCard, KamproPrimary, KamproSecondary, KamproSection } from "../src/components/KamproUI";

export default function CustomerDashboard(){
 const{user}=useAuth();const[activeJob,setActiveJob]=useState<any>(null);const[balance,setBalance]=useState(0);const[connections,setConnections]=useState<any[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 useEffect(()=>{load()},[user?.id]);
 async function load(){
  if(!user)return;setLoading(true);setError("");
  const results=await Promise.all([
   supabase.from("professional_connections").select("id,professional_id,expires_at,last_accessed_at").eq("customer_id",user.id).gt("expires_at",new Date().toISOString()).order("last_accessed_at",{ascending:false}).limit(20),
   supabase.rpc("get_connection_balance"),
   supabase.from("jobs").select("id,title,status").eq("customer_id",user.id).in("status",["worker_accepted","on_the_way","arrived","work_started"]).order("updated_at",{ascending:false}).limit(1)
  ]);
  const firstError=results.find(x=>x.error)?.error;if(firstError){setError(firstError.message);Alert.alert("Unable to load connections",firstError.message);}
  setConnections(results[0].data||[]);setBalance(Number(results[1].data||0));setActiveJob(results[2].data?.[0]||null);setLoading(false);
 }
 return <><KamproPage><KamproHeader title="My Connections" subtitle="Your unlocked professionals and communication access"/>
  {loading?<View style={s.state}><ActivityIndicator/><Text style={s.muted}>Loading…</Text></View>:error?<View style={s.state}><Text style={s.errorTitle}>Couldn't load your connections</Text><Text style={s.muted}>{error}</Text><Pressable onPress={load} style={s.secondary}><Text>Try again</Text></Pressable></View>:<>
   <View style={s.stats}><View style={s.stat}><Text style={s.num}>{connections.length}</Text><Text>Active connections</Text></View><View style={s.stat}><Text style={s.num}>{balance}</Text><Text>Unlocks left</Text></View></View>
   <Pressable onPress={()=>router.push("/marketplace")} style={s.primary}><Text style={s.primaryText}>Find Professionals</Text></Pressable>
   <Pressable onPress={()=>router.push("/connection-packages")} style={s.secondary}><Text>Buy Connection Package</Text></Pressable>{activeJob?<Pressable onPress={()=>router.push({pathname:"/job-tracking",params:{jobId:activeJob.id}})} style={s.primary}><Text style={s.primaryText}>Track Professional Live · {activeJob.status}</Text></Pressable>:null}
   <View style={s.info}><Text style={s.infoTitle}>What happens after you connect?</Text><Text style={s.muted}>Unlock a verified professional, then call or chat directly. Service scope, price, scheduling and payment are arranged directly between you and the professional.</Text></View>
   <Text style={s.section}>Connections</Text>
   {connections.length===0?<Text style={s.muted}>You have no active connections yet.</Text>:connections.map(x=><View key={x.id} style={s.card}><Text style={s.name}>Professional connection</Text><Text style={s.muted}>Access until {new Date(x.expires_at).toLocaleDateString()}</Text><Pressable onPress={()=>router.push("/connections")} style={s.secondary}><Text>Open My Connections & Chat</Text></Pressable></View>)}
  </>}
 </KamproPage><AppBottomNav/></>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{padding:20,paddingBottom:104},title:{fontSize:28,fontWeight:"800",color:"#10233F"},subtitle:{opacity:.6,marginTop:5,lineHeight:19},stats:{flexDirection:"row",gap:10,marginTop:20},stat:{flex:1,borderWidth:1,borderColor:"#E7EAF0",borderRadius:14,padding:14,alignItems:"center",minHeight:78},num:{fontSize:22,fontWeight:"800",color:"#FF4B1F"},primary:{marginTop:18,borderRadius:12,padding:14,alignItems:"center",backgroundColor:"#FF4B1F",minHeight:48,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},secondary:{marginTop:10,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,padding:12,alignItems:"center",minHeight:44,justifyContent:"center"},info:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,marginTop:16,backgroundColor:"#fbfdfc"},infoTitle:{fontSize:17,fontWeight:"800"},section:{fontSize:21,fontWeight:"800",marginTop:25,color:"#10233F"},card:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,marginTop:12},name:{fontSize:17,fontWeight:"800"},muted:{opacity:.6,marginTop:7,lineHeight:19},state:{alignItems:"center",paddingVertical:40},errorTitle:{fontWeight:"800",fontSize:17,color:"#b42318"}});
