import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { useKamproLanguage } from "../src/i18n/LanguageProvider";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";
import { AppBottomNav } from "../src/components/AppBottomNav";

export function ErrorBoundary({error,retry}:{error:Error;retry:()=>void}){
 return <SafeAreaView style={{flex:1,justifyContent:"center",padding:24,backgroundColor:"#fff"}}><Text style={{fontSize:21,fontWeight:"900",color:"#10233F"}}>Messages could not be opened</Text><Text style={{marginTop:8,color:"#475467"}}>{error?.message||"Unable to open this conversation."}</Text><Pressable onPress={retry} style={{marginTop:16,padding:14,backgroundColor:"#FF4B1F",borderRadius:12,alignItems:"center"}}><Text style={{color:"#fff",fontWeight:"900"}}>Try again</Text></Pressable><Pressable onPress={()=>router.replace("/notifications")} style={{marginTop:10,padding:12,alignItems:"center"}}><Text style={{color:"#FF4B1F",fontWeight:"800"}}>Back to Notifications</Text></Pressable></SafeAreaView>;
}

export default function Chat(){
 const {t}=useKamproLanguage();
 const {width}=useWindowDimensions();
 const routeParams=useLocalSearchParams<{conversationId?:string|string[];otherName?:string|string[];professionalId?:string|string[];serviceId?:string|string[];subServiceId?:string|string[];serviceName?:string|string[];subServiceName?:string|string[]}>();
 const first=(value?:string|string[])=>Array.isArray(value)?value[0]:value;
 const conversationId=first(routeParams.conversationId)?.trim()||"";
 const otherName=first(routeParams.otherName);
 const professionalId=first(routeParams.professionalId);
 const serviceId=first(routeParams.serviceId);
 const subServiceId=first(routeParams.subServiceId);
 const serviceName=first(routeParams.serviceName);
 const subServiceName=first(routeParams.subServiceName);
 const {user,mode}=useAuth();const [messages,setMessages]=useState<any[]>([]);const [body,setBody]=useState("");const [sending,setSending]=useState(false);const [loading,setLoading]=useState(true);const [chatActive,setChatActive]=useState(true);const [chatStatus,setChatStatus]=useState<string|null>(null);
 useEffect(()=>{load();if(!conversationId)return;const ch=supabase.channel("chat-"+conversationId).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},payload=>setMessages(prev=>prev.some(x=>x.id===payload.new.id)?prev:[...prev,payload.new])).subscribe();return()=>{supabase.removeChannel(ch);};},[conversationId]);
 async function load(){
  if(!conversationId){setMessages([]);setChatActive(false);setChatStatus("unavailable");setLoading(false);return;}
  setLoading(true);
  try{
   const[stateRes,msgRes]=await Promise.all([
    supabase.rpc("get_conversation_chat_state",{p_conversation_id:conversationId}),
    supabase.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",conversationId).order("created_at",{ascending:true})
   ]);
   if(stateRes.error){console.warn("KAMPRO chat state unavailable:",stateRes.error.message);setChatActive(true);setChatStatus(null);}
   else{const state=stateRes.data||{};setChatActive(state.active!==false);setChatStatus(state.status||null);}
   if(msgRes.error)throw msgRes.error;
   setMessages(Array.isArray(msgRes.data)?msgRes.data:[]);
  }catch(error:any){
   console.error("KAMPRO notification chat open failed:",error?.message||error);
   setMessages([]);setChatActive(false);setChatStatus("unavailable");
   Alert.alert("Unable to open messages","This conversation could not be loaded. Please return to Notifications and try again.");
  }finally{setLoading(false);}
 }
 async function send(){
  const text=body.trim();if(!text||!conversationId||sending||!chatActive)return;
  setSending(true);
  try{
   const{data,error}=await supabase.rpc("send_message",{p_conversation_id:conversationId,p_body:text});
   if(error)Alert.alert("Message failed",error.message);
   else{setBody("");if(data)setMessages(prev=>prev.some(x=>x.id===data.id)?prev:[...prev,data]);}
  }catch(error:any){Alert.alert("Message failed","Unable to send this message. Please try again.");console.error("KAMPRO send message failed:",error?.message||error);}
  finally{setSending(false);}
 }
 return <SafeAreaView style={s.safe} edges={["top"]}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><View style={s.chatBody}><View style={s.header}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><VasudhaLogo compact/><View style={s.headerText}><Text style={[s.title,{fontSize:width<360?15:width<400?17:20}]} numberOfLines={1} adjustsFontSizeToFit>{otherName||"Ramesh Kumar"}</Text><Text style={s.muted}>Last seen recently</Text></View><LanguageSwitch/></View><ScrollView contentContainerStyle={s.messages} keyboardShouldPersistTaps="handled"><>{loading?<Text style={s.muted}>{t("loadingMessages")}</Text>:messages.length===0?<Text style={s.muted}>{t("startConversation")}</Text>:messages.map(m=><View key={m.id} style={[s.bubble,m.sender_id===user?.id?s.mine:s.theirs]}><Text style={m.sender_id===user?.id?s.mineText:s.theirText}>{m.body}</Text><Text style={[s.time,m.sender_id===user?.id&&s.mineTime]}>{new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</Text></View>)}</></ScrollView>{!chatActive&&<View style={s.closedBanner}><Text style={s.closedTitle}>{t("chatClosedTitle")}</Text><Text style={s.closedText}>{chatStatus==="work_completed"||chatStatus==="customer_confirmed"?t("chatEndedCompleted"):t("messagingUnavailable")}</Text></View>}{mode==="customer"&&chatActive&&<View style={s.jobAction}><Pressable onPress={()=>router.push({pathname:"/service-request",params:{professionalId:professionalId||"",serviceId:serviceId||"",subServiceId:subServiceId||"",serviceName:serviceName||"",subServiceName:subServiceName||""}})} style={s.jobButton}><Text style={s.jobButtonText}>{t("requestJob")}</Text></Pressable><Text style={s.jobHint}>{t("requestJobHint")}</Text></View>}{chatActive&&<View style={[s.composer,{paddingBottom:10}]}><TextInput value={body} onChangeText={setBody} placeholder={t("writeMessage")} multiline returnKeyType="default" style={s.input}/><Pressable onPress={send} disabled={sending||!body.trim()} style={[s.send,(sending||!body.trim())&&s.sendDisabled]}><Text style={s.sendText}>{sending?"...":t("send")}</Text></Pressable></View>}</View></KeyboardAvoidingView><AppBottomNav active="chat"/></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},flex:{flex:1},chatBody:{flex:1,minHeight:0},header:{paddingHorizontal:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:KAMPRO.border,backgroundColor:KAMPRO.surface,flexDirection:"row",alignItems:"center",gap:6,minWidth:0,shadowColor:KAMPRO.navy,shadowOpacity:.05,shadowRadius:8,shadowOffset:{width:0,height:3},elevation:2},back:{width:38,height:38,borderRadius:19,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},backText:{fontSize:28,color:"#10233F"},headerText:{flex:1,minWidth:0},title:{fontSize:20,fontWeight:"900",color:"#10233F"},muted:{color:"#6B7280",marginTop:3},messages:{paddingHorizontal:14,paddingVertical:16,flexGrow:1,justifyContent:"flex-end",alignSelf:"stretch",width:"100%"},bubble:{maxWidth:"82%",padding:12,borderRadius:15,marginBottom:10},mine:{alignSelf:"flex-end",backgroundColor:"#FF4B1F"},theirs:{alignSelf:"flex-start",borderWidth:1,borderColor:"#E7EAF0",backgroundColor:"#fff"},mineText:{color:"#fff"},theirText:{color:"#10233F"},time:{fontSize:10,opacity:.5,marginTop:5},mineTime:{color:"#fff",opacity:.7},jobAction:{paddingHorizontal:14,paddingTop:8,backgroundColor:KAMPRO.background,borderTopWidth:1,borderTopColor:KAMPRO.border},jobButton:{alignSelf:"flex-start",borderRadius:10,backgroundColor:"#FF4B1F",paddingHorizontal:14,paddingVertical:9},jobButtonText:{color:"#fff",fontWeight:"800"},jobHint:{fontSize:11,color:"#6B7280",marginTop:5,marginBottom:5},closedBanner:{marginHorizontal:14,marginBottom:8,padding:12,borderRadius:12,backgroundColor:"#FFF4ED",borderWidth:1,borderColor:"#FFD3C2"},closedTitle:{fontWeight:"900",color:"#B93813"},closedText:{fontSize:12,color:"#6B7280",marginTop:3},composer:{flexDirection:"row",padding:10,paddingHorizontal:12,borderTopWidth:1,borderTopColor:KAMPRO.border,alignItems:"flex-end",backgroundColor:KAMPRO.surface},attach:{width:38,height:38,borderRadius:19,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center",marginRight:7},input:{flex:1,minWidth:0,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,padding:10,maxHeight:96,minHeight:44,color:"#10233F",backgroundColor:"#fff"},send:{marginLeft:6,borderRadius:12,paddingHorizontal:12,paddingVertical:13,backgroundColor:"#FF4B1F"},sendDisabled:{opacity:.45},sendText:{color:"#fff",fontWeight:"800"}});