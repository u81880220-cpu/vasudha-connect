import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";

export default function Connections(){
 const {mode,user}=useAuth(); const [items,setItems]=useState<any[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
 useEffect(()=>{load();},[mode,user?.id]);
 async function load(){
  if(!user)return; setLoading(true);setError("");
  const {data,error}=await supabase.from("professional_connections").select("id,customer_id,professional_id,expires_at,last_accessed_at").or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`).order("last_accessed_at",{ascending:false});
  if(error){setError(error.message);Alert.alert("Unable to load connections",error.message);setLoading(false);return;}
  const rows=await Promise.all((data||[]).map(async c=>{
   const otherId= c.customer_id===user.id ? c.professional_id : c.customer_id;
   const [{data:p},{data:pp},{data:conversation}]=await Promise.all([
    supabase.from("profiles").select("display_name,full_name,avatar_url").eq("id",otherId).maybeSingle(),
    supabase.from("professional_profiles").select("headline,trust_score").eq("user_id",c.professional_id).maybeSingle(),
    supabase.from("conversations").select("id").eq("customer_id",c.customer_id).eq("professional_id",c.professional_id).maybeSingle()
   ]);
   let chatState=null;
   if(conversation?.id){
    const {data:state}=await supabase.rpc("get_conversation_chat_state",{p_conversation_id:conversation.id});
    chatState=state||null;
   }
   return {...c,otherId,profile:p,professional:pp,conversationId:conversation?.id||null,chatState};
  }));
  setItems(rows); setLoading(false);
 }
 async function open(item:any){
  if(mode==="customer"){
   const {data,error}=await supabase.rpc("get_or_create_conversation",{p_professional_id:item.professional_id});
   if(error){Alert.alert("Chat unavailable",error.message);return;}
   router.push({pathname:"/chat",params:{conversationId:data,otherName:item.profile?.display_name||"Professional",professionalId:item.professional_id}});
  }else{
   const {data,error}=await supabase.from("conversations").select("id").eq("customer_id",item.customer_id).eq("professional_id",user?.id).maybeSingle();
   if(error||!data){Alert.alert("No chat yet","The customer has not started a chat.");return;}
   router.push({pathname:"/chat",params:{conversationId:data.id,otherName:item.profile?.display_name||"Customer",professionalId:item.professional_id}});
  }
 }
 return <SafeAreaView style={s.safe}><View style={s.page}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <VasudhaLogo/><Text style={s.title}>My Chats</Text><Text style={s.muted}>{mode==="customer"?"Professionals you can message":"Customers you can message"}</Text>
  {loading?<View style={s.state}><ActivityIndicator/><Text style={s.muted}>Loading connections…</Text></View>:error?<View style={s.state}><Text style={s.errorTitle}>Couldn't load connections</Text><Pressable onPress={load} style={s.primary}><Text style={s.primaryText}>Try again</Text></Pressable></View>:items.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No chats yet</Text><Text style={s.muted}>{mode==="customer"?"Connect with a professional to start a chat.":"When a customer connects with you, the chat will appear here."}</Text></View>:
   items.map(x=><View key={x.id} style={s.card}><Text style={s.name}>{x.profile?.display_name||x.profile?.full_name||"User"}</Text>{x.professional?.headline?<Text style={s.muted}>{x.professional.headline}</Text>:null}{x.professional?.trust_score!=null?<Text style={s.score}>Trust {Math.round(x.professional.trust_score)}/100</Text>:null}{mode==="professional"&&x.customerReputation?<Text style={s.score}>Customer trust {Math.round(x.customerReputation.trust_score||0)}/100</Text>:null}<Text style={[s.expiry,x.chatState?.active===false&&s.closedExpiry]}>{!x.conversationId?"Chat not started":x.chatState?.active===false?"Chat closed":"Chat active"}</Text><Pressable style={[s.primary,x.chatState?.active===false&&s.closedButton]} onPress={()=>open(x)}><Text style={s.primaryText}>{x.conversationId&&x.chatState?.active===false?"View Chat":"Open Chat"}</Text></Pressable></View>)
  }
 </ScrollView><AppBottomNav/></View></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#F7F8FA"},page:{flex:1,alignItems:"center"},container:{width:"100%",maxWidth:1180,alignSelf:"center",paddingHorizontal:16,paddingTop:14,paddingBottom:110},title:{fontSize:30,fontWeight:"900",color:"#10233F",marginTop:8},muted:{color:"#6B7280",marginTop:5,lineHeight:19},card:{width:"100%",borderWidth:1,borderColor:"#E7EAF0",borderRadius:18,padding:16,marginTop:14,backgroundColor:"#FFFFFF",shadowColor:"#10233F",shadowOpacity:.05,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2},name:{fontSize:19,fontWeight:"900",color:"#10233F"},score:{fontWeight:"800",marginTop:8,color:"#FF4B1F"},expiry:{fontSize:12,color:"#6B7280",marginTop:8},closedExpiry:{color:"#B93813",fontWeight:"800",opacity:1},primary:{marginTop:12,borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#FF4B1F",minHeight:46,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"800"},closedButton:{backgroundColor:"#6B7280"},empty:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:20,marginTop:20},emptyTitle:{fontSize:18,fontWeight:"800",color:"#10233F"},state:{alignItems:"center",paddingVertical:40},errorTitle:{fontWeight:"800",color:"#b42318"}});