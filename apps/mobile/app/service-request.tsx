import { useState } from "react";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";

export default function ServiceRequest(){
 const {professionalId}=useLocalSearchParams<{professionalId:string}>(); const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [date,setDate]=useState(""); const [budget,setBudget]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(){if(!professionalId||title.trim().length<3||description.trim().length<3){Alert.alert("Complete request","Add a title and describe the work.");return;}setBusy(true);
 const {data:{user}}=await supabase.auth.getUser(); if(!user){setBusy(false);return;}
 const [min,max]=budget.split("-").map(x=>Number(x.trim())).filter(x=>!Number.isNaN(x));
 const {error}=await supabase.from("service_requests").insert({customer_id:user.id,professional_id:professionalId,title:title.trim(),description:description.trim(),preferred_date:date||null,budget_min_inr:Number.isFinite(min)?min:null,budget_max_inr:Number.isFinite(max)?max:null});
 setBusy(false); if(error)Alert.alert("Request failed",error.message);else{Alert.alert("Request sent","The professional can now review your job and submit a quotation.");router.back();}
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}><Text style={s.title}>Request a Quotation</Text><Text style={s.muted}>Describe what you need. You can discuss details in chat.</Text><Text style={s.label}>Job title</Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Fix kitchen plumbing" style={s.input}/><Text style={s.label}>Work description</Text><TextInput value={description} onChangeText={setDescription} placeholder="Describe the work required..." multiline style={[s.input,s.large]}/><Text style={s.label}>Preferred date (optional)</Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={s.input}/><Text style={s.label}>Budget range (optional)</Text><TextInput value={budget} onChangeText={setBudget} placeholder="e.g. 500-1500" keyboardType="numeric" style={s.input}/><Pressable onPress={submit} disabled={busy} style={s.primary}><Text style={s.primaryText}>{busy?"Sending...":"Send Request"}</Text></Pressable></ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800"},muted:{opacity:.65,marginTop:6},label:{fontWeight:"800",marginTop:20,marginBottom:7},input:{borderWidth:1,borderRadius:12,padding:12},large:{height:140,textAlignVertical:"top"},primary:{marginTop:24,borderRadius:12,padding:15,alignItems:"center",backgroundColor:"#111"},primaryText:{color:"#fff",fontWeight:"800"}});
