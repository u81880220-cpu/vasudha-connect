import { useEffect,useState } from "react";
import { ActivityIndicator,Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { router } from "expo-router";
import { KAMPRO } from "../src/components/kamproTheme";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Notifications(){
 const {session,mode}=useAuth();
 const [tab,setTab]=useState("All");const [items,setItems]=useState<any[]>([]);const [loading,setLoading]=useState(true);const user=session?.user;
 useEffect(()=>{load();if(!user)return;const ch=supabase.channel("notifications-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${user.id}`},p=>setItems(x=>[p.new,...x])).subscribe();return()=>{supabase.removeChannel(ch)};},[user?.id]);
 async function load(){if(!user){setLoading(false);return;}setLoading(true);const {data,error}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);if(error)Alert.alert("Unable to load notifications",error.message);else setItems(data||[]);setLoading(false);}
 async function read(id:string){const{error}=await supabase.rpc("mark_notification_read",{p_id:id});if(error){Alert.alert("Unable to mark notification",error.message);return;}setItems(x=>x.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));}
 async function openNotification(n:any){
  await read(n.id);
  const d=n.data||{};
  if(d.conversation_id){router.push({pathname:"/chat",params:{conversationId:d.conversation_id}});return;}
  if(d.complaint_id){router.push({pathname:"/complaints",params:{complaintId:d.complaint_id}});return;}
  if(d.job_id){router.push({pathname:"/job-details",params:{jobId:d.job_id}});return;}
  if(d.request_id){router.push(mode==="professional"?"/professional-dashboard":"/customer-dashboard");return;}
 }
 const shown=tab==="All"?items:tab==="Unread"?items.filter(n=>!n.read_at):tab==="Messages"?items.filter(n=>n.type==="message"):items.filter(n=>n.type==="job");
 return <SafeAreaView style={s.safe} edges={["top"]}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled"><View style={s.top}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><VasudhaLogo compact/><View style={s.spacer}/></View><Text style={s.title}>Notifications</Text><View style={s.tabs}>{["All","Unread","Messages","Jobs"].map(x=><Pressable key={x} onPress={()=>setTab(x)} style={[s.tab,tab===x&&s.tabOn]}><Text style={tab===x?s.tabOnText:s.tabText}>{x}</Text></Pressable>)}</View>{loading?<View style={s.state}><ActivityIndicator color="#FF4B1F"/><Text style={s.muted}>Loading notifications…</Text></View>:shown.length===0?<View style={s.empty}><Text style={s.emptyTitle}>You're all caught up</Text><Text style={s.muted}>New connection, message and job updates will appear here.</Text></View>:shown.map(n=><Pressable key={n.id} onPress={()=>openNotification(n)} style={[s.card,!n.read_at&&s.unread]}><Text style={s.head}>{n.title}</Text><Text style={s.msg}>{n.message}</Text><Text style={s.time}>{new Date(n.created_at).toLocaleString()}</Text></Pressable>)}</ScrollView><AppBottomNav/></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:KAMPRO.background},container:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:110},top:{height:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},backText:{fontSize:30,color:"#10233F",marginTop:-3},spacer:{width:40},title:{fontSize:30,fontWeight:"900",color:"#10233F"},tabs:{flexDirection:"row",gap:7,marginTop:14},tab:{paddingHorizontal:12,paddingVertical:8,borderRadius:16,backgroundColor:"#F7F8FA"},tabOn:{backgroundColor:"#FF4B1F"},tabText:{fontSize:12,fontWeight:"700",color:"#10233F"},tabOnText:{fontSize:12,fontWeight:"800",color:"#fff"},card:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:18,padding:18,marginTop:14,backgroundColor:KAMPRO.surface,shadowColor:KAMPRO.navy,shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:1},unread:{borderWidth:2,borderColor:"#FF4B1F",backgroundColor:"#FFF8F4"},head:{fontSize:16,fontWeight:"800",color:"#10233F"},msg:{marginTop:5,lineHeight:19,color:"#10233F"},time:{fontSize:11,color:"#6B7280",marginTop:8},muted:{color:"#6B7280",marginTop:7,lineHeight:19},empty:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:20,marginTop:20,backgroundColor:"#fff"},emptyTitle:{fontSize:18,fontWeight:"800",color:"#10233F"},state:{alignItems:"center",paddingVertical:40}});