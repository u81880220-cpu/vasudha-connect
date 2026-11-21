import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import { usePathname, router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { KamproPage, KamproHeader } from "../src/components/KamproUI";
import { AppBottomNav } from "../src/components/AppBottomNav";

const categories = [{key:"bug",label:"App issue"},{key:"login",label:"Login"},{key:"payment",label:"Payment"},{key:"suggestion",label:"Suggestion"},{key:"other",label:"Other"}] as const;

export default function FeedbackScreen() {
 const {user,mode}=useAuth(); const pathname=usePathname();
 const [category,setCategory]=useState<string>("bug"),[description,setDescription]=useState(""),[attachment,setAttachment]=useState<any>(null),[sending,setSending]=useState(false);
 async function chooseAttachment(){
  const result=await DocumentPicker.getDocumentAsync({type:["image/jpeg","image/png","image/webp"],copyToCacheDirectory:true,multiple:false});
  if(result.canceled||!result.assets?.[0])return;
  const file=result.assets[0];
  if(file.size&&file.size>10*1024*1024){Alert.alert("Image too large","Please choose an image smaller than 10 MB.");return;}
  setAttachment(file);
 }
 async function submit(){
  if(!user){Alert.alert("Sign in required","Please sign in again to send feedback.");return;}
  const clean=description.trim(); if(clean.length<10){Alert.alert("Add more detail","Please describe the issue in at least 10 characters.");return;}
  setSending(true); const id=Date.now()+"-"+Math.random().toString(36).slice(2,8); let attachmentPath:string|null=null;
  try{
   if(attachment?.uri){
    const response=await fetch(attachment.uri); const body=await response.arrayBuffer();
    const ext=(attachment.name?.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    attachmentPath=user.id+"/"+id+"/attachment."+ext;
    const{error:uploadError}=await supabase.storage.from("user-feedback").upload(attachmentPath,body,{contentType:attachment.mimeType||"image/jpeg",upsert:false});
    if(uploadError)throw uploadError;
   }
   const{error}=await supabase.from("user_feedback").insert({user_id:user.id,user_mode:mode==="professional"?"professional":"customer",category,description:clean,attachment_path:attachmentPath,app_version:Constants.expoConfig?.version||"unknown",platform:Platform.OS+(Platform.Version?" "+String(Platform.Version):""),screen_path:pathname||"unknown"});
   if(error)throw error;
   Alert.alert("Feedback sent","Thank you. Your report has been received by the KAMPRO team.",[{text:"Done",onPress:()=>router.back()}]);
   setDescription("");setAttachment(null);
  }catch(error:any){
   if(attachmentPath)await supabase.storage.from("user-feedback").remove([attachmentPath]);
   Alert.alert("Could not send feedback",error?.message||"Please try again.");
  }finally{setSending(false);}
 }
 return <><KamproPage><KamproHeader title="Help & Feedback" subtitle="Tell us what went wrong or how we can improve KAMPRO."/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
  <Text style={s.label}>What is this about?</Text><View style={s.categories}>{categories.map(item=><Pressable key={item.key} onPress={()=>setCategory(item.key)} style={[s.chip,category===item.key&&s.chipActive]}><Text style={[s.chipText,category===item.key&&s.chipTextActive]}>{item.label}</Text></Pressable>)}</View>
  <Text style={s.label}>Describe the issue or idea</Text><TextInput value={description} onChangeText={setDescription} placeholder="What happened? What did you expect to happen?" multiline textAlignVertical="top" maxLength={5000} style={s.textarea}/><Text style={s.hint}>{description.trim().length}/5000 characters (minimum 10)</Text>
  <Text style={s.label}>Attach a screenshot (optional)</Text><Pressable style={s.attach} onPress={chooseAttachment}><Text style={s.attachText}>{attachment?.name||"Choose image from your device"}</Text></Pressable>{attachment&&<Pressable onPress={()=>setAttachment(null)}><Text style={s.remove}>Remove attachment</Text></Pressable>}
  <View style={s.meta}><Text style={s.metaText}>Account: {mode==="professional"?"Professional":"Customer"}</Text><Text style={s.metaText}>App version: {Constants.expoConfig?.version||"unknown"} • {Platform.OS}</Text><Text style={s.metaText}>Current screen: {pathname||"unknown"}</Text></View>
  <Pressable disabled={sending} style={[s.submit,sending&&{opacity:0.65}]} onPress={submit}>{sending?<ActivityIndicator color="#fff"/>:<Text style={s.submitText}>Send feedback</Text>}</Pressable>
  <Text style={s.privacy}>Your report is visible to the KAMPRO admin team and linked to your account so we can investigate.</Text><Pressable accessibilityRole="link" onPress={()=>Linking.openURL("mailto:kampro.pro1@gmail.com")}><Text style={[s.privacy,{color:"#075B3A",fontWeight:"800"}]}>For direct support, email kampro.pro1@gmail.com</Text></Pressable>
 </ScrollView></KamproPage><AppBottomNav active="profile"/></>;
}
const s=StyleSheet.create({content:{padding:18,paddingBottom:110},label:{color:"#10233F",fontSize:15,fontWeight:"800",marginTop:18,marginBottom:9},categories:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderColor:"#DDE3E0",borderRadius:20,paddingVertical:9,paddingHorizontal:13,backgroundColor:"#fff"},chipActive:{borderColor:"#FF4B1F",backgroundColor:"#FFF1EC"},chipText:{color:"#344054",fontWeight:"700",fontSize:13},chipTextActive:{color:"#D83B16"},textarea:{minHeight:150,borderWidth:1,borderColor:"#DDE3E0",borderRadius:12,padding:13,backgroundColor:"#fff",color:"#10233F"},hint:{color:"#667085",fontSize:12,marginTop:5,textAlign:"right"},attach:{borderWidth:1,borderStyle:"dashed",borderColor:"#C8D0D9",borderRadius:12,padding:15,backgroundColor:"#FAFBFC"},attachText:{color:"#344054",fontWeight:"700"},remove:{color:"#B42318",marginTop:8,fontWeight:"700"},meta:{marginTop:20,padding:13,borderRadius:12,backgroundColor:"#F7F8FA",gap:5},metaText:{color:"#667085",fontSize:12},submit:{marginTop:20,minHeight:50,backgroundColor:"#FF4B1F",borderRadius:12,alignItems:"center",justifyContent:"center"},submitText:{color:"#fff",fontWeight:"900",fontSize:15},privacy:{color:"#667085",fontSize:12,lineHeight:18,marginTop:12,textAlign:"center"}});
