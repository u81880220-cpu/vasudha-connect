import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/context/AuthProvider";

export default function Connections(){
 const {mode,user}=useAuth(); const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{load();},[mode,user?.id]);
 async function load(){
  if(!user)return; setLoading(true);
  const {data,error}=await supabase.from("professional_connections").select("id,customer_id,professional_id,expires_at,last_accessed_at").or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`).order("last_accessed_at",{ascending:false});
  if(error){Alert.alert("Unable to load connections",error.message);setLoading(false);return;}
  const rows=await Promise.all((data||[]).map(async c=>{
   const otherId= c.customer_id===user.id ? c.professional_id : c.customer_id;
   const [{data:p},{data:pp}]=await Promise.all([
    supabase.from("profiles").select("display_name,full_name,avatar_url").eq("id",otherId).maybeSingle(),
    supabase.from("professional_profiles").select("headline,trust_score").eq("user_id",c.professional_id).maybeSingle()
   ]);
   return {...c,otherId,profile:p,professional:pp};
  }));
  setItems(rows); setLoading(false);
 }
 async function open(item:any){
  if(mode==="customer"){
   const {data,error}=await supabase.rpc("get_or_create_conversation",{p_professional_id:item.professional_id});
   if(error){Alert.alert("Chat unavailable",error.message);return;}
   router.push({pathname:"/chat",params:{conversationId:data,otherName:item.profile?.display_name||"Professional"}});
  }else{
   const {data,error}=await supabase.from("conversations").select("id").eq("customer_id",item.customer_id).eq("professional_id",user?.id).maybeSingle();
   if(error||!data){Alert.alert("No chat yet","The customer has not started a chat.");return;}
   router.push({pathname:"/chat",params:{conversationId:data.id,otherName:item.profile?.display_name||"Customer"}});
  }
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Text style={s.title}>My Connections</Text><Text style={s.muted}>{mode==="customer"?"Professionals you have unlocked":"Customers connected with you"}</Text>
  {loading?<Text style={s.muted}>Loading...</Text>:items.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No active connections</Text><Text style={s.muted}>{mode==="customer"?"Unlock a verified professional to start a connection.":"When a customer unlocks you, the connection will appear here."}</Text></View>:
   items.map(x=><View key={x.id} style={s.card}><Text style={s.name}>{x.profile?.display_name||x.profile?.full_name||"User"}</Text>{x.professional?.headline?<Text style={s.muted}>{x.professional.headline}</Text>:null}{x.professional?.trust_score!=null?<Text style={s.score}>Trust {Math.round(x.professional.trust_score)}/100</Text>:null}<Text style={s.expiry}>Access until {new Date(x.expires_at).toLocaleDateString()}</Text><Pressable style={s.primary} onPress={()=>open(x)}><Text style={s.primaryText}>Open Chat</Text></Pressable></View>)
  }
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800"},muted:{opacity:.65,marginTop:5},card:{borderWidth:1,borderRadius:16,padding:16,marginTop:14},name:{fontSize:19,fontWeight:"800"},score:{fontWeight:"800",marginTop:8},expiry:{fontSize:12,opacity:.6,marginTop:8},primary:{marginTop:12,borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#087D65"},primaryText:{color:"#fff",fontWeight:"800"},empty:{borderWidth:1,borderRadius:16,padding:20,marginTop:20},emptyTitle:{fontSize:18,fontWeight:"800"}});