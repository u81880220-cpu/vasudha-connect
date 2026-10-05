import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";

export default function ProfessionalVerification(){
 const{session}=useAuth();
 const[headline,setHeadline]=useState(""),[about,setAbout]=useState(""),[years,setYears]=useState(""),[status,setStatus]=useState("unverified"),[completeness,setCompleteness]=useState(0);
 const[docType,setDocType]=useState("Identity / Skill document"),[docName,setDocName]=useState(""),[busy,setBusy]=useState(false),[docs,setDocs]=useState<any[]>([]);
 useEffect(()=>{load();},[session]);
 async function load(){if(!session)return;const[{data},{data:documents}]=await Promise.all([supabase.from("professional_profiles").select("headline,about,years_experience,verification_status").eq("user_id",session.user.id).maybeSingle(),supabase.from("verification_documents").select("id,document_type,status,reviewer_note,submitted_at").eq("professional_id",session.user.id).order("submitted_at",{ascending:false})]);setDocs(documents||[]);if(data){setHeadline(data.headline||"");setAbout(data.about||"");setYears(String(data.years_experience||0));setStatus(data.verification_status);setCompleteness(Math.min(100,Math.round(([data.headline,data.about,Number(data.years_experience)>0].filter(Boolean).length/3)*70)));}}
 async function pickDocument(){
  const result=await DocumentPicker.getDocumentAsync({type:["image/jpeg","image/png","application/pdf"],copyToCacheDirectory:true});
  if(result.canceled||!result.assets?.[0])return;
  const file=result.assets[0]; if((file.size||0)>10*1024*1024)return Alert.alert("File too large","Please select a file up to 10 MB.");
  setDocName(file.name);setBusy(true);
  try{
   if(!session)throw new Error("You are not signed in.");
   const ext=(file.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
   const path=`${session.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
   const response=await fetch(file.uri);const body=await response.arrayBuffer();
   const{error:uploadError}=await supabase.storage.from("verification-documents").upload(path,body,{contentType:file.mimeType||"application/octet-stream",upsert:false});
   if(uploadError)throw uploadError;
   const{error:insertError}=await supabase.from("verification_documents").insert({professional_id:session.user.id,document_type:docType.trim()||"Identity / Skill document",document_url:path});
   if(insertError){await supabase.storage.from("verification-documents").remove([path]);throw insertError;}
   const{error:profileError}=await supabase.from("professional_profiles").update({verification_status:"pending"}).eq("user_id",session.user.id);
   if(profileError)throw profileError; setStatus("pending");
   Alert.alert("Submitted","Your document was uploaded securely and your verification request was sent for admin review.");
  }catch(e){setDocName("");Alert.alert("Upload failed",e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Text style={s.title}>Professional Verification</Text><Text style={s.sub}>Build trust before customers connect with you.</Text>
  <View style={s.score}><Text style={s.scoreTitle}>Profile completeness</Text><Text style={s.scoreValue}>{completeness}%</Text><Text style={s.muted}>Complete your professional details and submit verification.</Text></View>
  <Text style={s.label}>Headline</Text><TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="Experienced electrician"/>
  <Text style={s.label}>About</Text><TextInput style={[s.input,s.multi]} value={about} onChangeText={setAbout} placeholder="Experience, services and strengths" multiline/>
  <Text style={s.label}>Experience</Text><TextInput style={s.input} value={years} onChangeText={setYears} keyboardType="number-pad"/>
  <View style={s.status}><Text style={s.label}>Verification status</Text><Text style={s.badge}>{status.toUpperCase()}</Text></View>
  {docs.length>0?<View style={s.docs}><Text style={s.label}>Submission history</Text>{docs.map(d=><View key={d.id} style={s.doc}><Text style={s.docTitle}>{d.document_type} · {String(d.status).toUpperCase()}</Text>{d.reviewer_note?<Text style={s.muted}>{d.reviewer_note}</Text>:null}</View>)}</View>:null}<Text style={s.label}>Verification document type</Text><TextInput style={s.input} value={docType} onChangeText={setDocType}/>
  <Pressable disabled={busy} onPress={pickDocument} style={s.primary}><Text style={s.button}>{busy?"Uploading...":"Choose & upload document"}</Text></Pressable>
  {docName?<Text style={s.file}>Selected: {docName}</Text>:null}
  <Text style={s.note}>Accepted: JPG, PNG or PDF • Maximum 10 MB. Documents are stored privately and are not public marketplace files.</Text>
  <Text style={s.note}>Admin approval is required before your profile appears in nearby customer search.</Text>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:27,fontWeight:"800"},sub:{marginTop:5,opacity:.65,marginBottom:18},score:{borderWidth:1,borderRadius:16,padding:16},scoreTitle:{fontWeight:"800"},scoreValue:{fontSize:30,fontWeight:"800",marginTop:4},muted:{opacity:.6,fontSize:12,marginTop:4},label:{fontWeight:"700",marginTop:14,marginBottom:8},input:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:13},multi:{minHeight:90,textAlignVertical:"top"},status:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},badge:{borderWidth:1,borderRadius:10,paddingHorizontal:10,paddingVertical:6,fontWeight:"800"},primary:{marginTop:18,borderWidth:1,borderRadius:12,padding:15,alignItems:"center"},button:{fontWeight:"800"},file:{marginTop:10,fontWeight:"600"},note:{marginTop:12,opacity:.6,fontSize:12},docs:{marginTop:4},doc:{borderWidth:1,borderRadius:10,padding:10,marginTop:7},docTitle:{fontWeight:"700"}});
