import { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
export default function ProfessionalVerification(){
 const{session}=useAuth();const[headline,setHeadline]=useState(""),[about,setAbout]=useState(""),[years,setYears]=useState(""),[status,setStatus]=useState("unverified"),[completeness,setCompleteness]=useState(0),[docUrl,setDocUrl]=useState(""),[docType,setDocType]=useState("Identity / Skill document"),[busy,setBusy]=useState(false);
 useEffect(()=>{load();},[]);
 async function load(){if(!session)return;const{data}=await supabase.from("professional_profiles").select("headline,about,years_experience,verification_status").eq("user_id",session.user.id).maybeSingle();if(data){setHeadline(data.headline||"");setAbout(data.about||"");setYears(String(data.years_experience||0));setStatus(data.verification_status);setCompleteness(Math.min(100,Math.round(([data.headline,data.about,Number(data.years_experience)>0].filter(Boolean).length/3)*70)));}}
 async function submit(){if(!session||!docUrl.trim())return Alert.alert("Document required","Enter the secure document URL for now. File upload storage will be connected in the next step.");setBusy(true);try{const{error}=await supabase.from("verification_documents").insert({professional_id:session.user.id,document_type:docType.trim(),document_url:docUrl.trim()});if(error)throw error;const{error:e}=await supabase.from("professional_profiles").update({verification_status:"pending"}).eq("user_id",session.user.id);if(e)throw e;setStatus("pending");Alert.alert("Submitted","Your verification request has been submitted for admin review.");}catch(e){Alert.alert("Submission failed",e instanceof Error?e.message:"Please try again.");}finally{setBusy(false);}}
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}><Text style={s.title}>Professional Verification</Text><Text style={s.sub}>Build trust before customers connect with you.</Text>
 <View style={s.score}><Text style={s.scoreTitle}>Profile completeness</Text><Text style={s.scoreValue}>{completeness}%</Text><Text style={s.muted}>Complete your professional details and submit verification.</Text></View>
 <Text style={s.label}>Headline</Text><TextInput style={s.input} value={headline} onChangeText={setHeadline} placeholder="Experienced electrician"/>
 <Text style={s.label}>About</Text><TextInput style={[s.input,s.multi]} value={about} onChangeText={setAbout} placeholder="Experience, services and strengths" multiline/>
 <Text style={s.label}>Experience</Text><TextInput style={s.input} value={years} onChangeText={setYears} keyboardType="number-pad"/>
 <View style={s.status}><Text style={s.label}>Verification status</Text><Text style={s.badge}>{status.toUpperCase()}</Text></View>
 <Text style={s.label}>Verification document type</Text><TextInput style={s.input} value={docType} onChangeText={setDocType}/>
 <Text style={s.label}>Document reference</Text><TextInput style={s.input} value={docUrl} onChangeText={setDocUrl} placeholder="Secure uploaded document reference"/>
 <Pressable disabled={busy} onPress={submit} style={s.primary}><Text style={s.button}>{busy?"Submitting...":"Submit for verification"}</Text></Pressable>
 <Text style={s.note}>Admin approval is required before your profile appears in nearby customer search.</Text>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:27,fontWeight:"800"},sub:{marginTop:5,opacity:.65,marginBottom:18},score:{borderWidth:1,borderRadius:16,padding:16},scoreTitle:{fontWeight:"800"},scoreValue:{fontSize:30,fontWeight:"800",marginTop:4},muted:{opacity:.6,fontSize:12,marginTop:4},label:{fontWeight:"700",marginTop:14,marginBottom:8},input:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:13},multi:{minHeight:90,textAlignVertical:"top"},status:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},badge:{borderWidth:1,borderRadius:10,paddingHorizontal:10,paddingVertical:6,fontWeight:"800"},primary:{marginTop:18,borderWidth:1,borderRadius:12,padding:15,alignItems:"center"},button:{fontWeight:"800"},note:{marginTop:18,opacity:.6,fontSize:12}});
