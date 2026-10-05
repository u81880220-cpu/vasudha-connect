import { useEffect,useState } from "react";
import { Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
export default function Notifications(){
 const {user}=useAuth();const [items,setItems]=useState<any[]>([]);const [loading,setLoading]=useState(true);
 useEffect(()=>{load();if(!user)return;const ch=supabase.channel("notifications-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:`user_id=eq.${user.id}`},p=>setItems(x=>[p.new,...x])).subscribe();return()=>{supabase.removeChannel(ch)};},[user?.id]);
 async function load(){if(!user)return;const {data,error}=await supabase.from("notifications").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);if(error)Alert.alert("Unable to load notifications",error.message);else setItems(data||[]);setLoading(false);}
 async function read(id:string){await supabase.rpc("mark_notification_read",{p_id:id});setItems(x=>x.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n));}
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}><VasudhaLogo compact/><Text style={s.title}>Notifications</Text>{loading?<Text style={s.muted}>Loading...</Text>:items.length===0?<Text style={s.muted}>You're all caught up.</Text>:items.map(n=><Pressable key={n.id} onPress={()=>read(n.id)} style={[s.card,!n.read_at&&s.unread]}><Text style={s.head}>{n.title}</Text><Text style={s.msg}>{n.message}</Text><Text style={s.time}>{new Date(n.created_at).toLocaleString()}</Text></Pressable>)}</ScrollView></SafeAreaView>}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800"},card:{borderWidth:1,borderRadius:15,padding:15,marginTop:12},unread:{borderWidth:2},head:{fontSize:16,fontWeight:"800"},msg:{marginTop:5},time:{fontSize:11,opacity:.5,marginTop:8},muted:{opacity:.6,marginTop:15}});
