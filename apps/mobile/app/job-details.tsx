import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";

export default function JobDetails(){
 const {jobId}=useLocalSearchParams<{jobId:string}>();const{mode}=useAuth();const[job,setJob]=useState<any>(null);const[privateData,setPrivateData]=useState<any>({});const[loading,setLoading]=useState(true);
 useEffect(()=>{if(jobId)load()},[jobId]);
 async function load(){
  setLoading(true);
  const [{data,error}]=await Promise.all([supabase.from("jobs").select("*").eq("id",jobId).maybeSingle()]);
  if(error){Alert.alert("Unable to load job",error.message);setLoading(false);return;}
  setJob(data);
  if(data){const{data:pd}=await supabase.rpc("get_job_contact_details",{p_job_id:jobId});setPrivateData(pd||{});}
  setLoading(false);
 }
 async function openChat(){if(!job)return;if(mode==="customer"){const{data:conversationId,error}=await supabase.rpc("get_or_create_conversation",{p_professional_id:job.professional_id});if(error||!conversationId){Alert.alert("Chat unavailable",error?.message||"Unable to open chat.");return;}router.push({pathname:"/chat",params:{conversationId,otherName:privateData?.professional_name||"Professional"}});}else{const{data,error}=await supabase.from("conversations").select("id").eq("customer_id",job.customer_id).eq("professional_id",job.professional_id).maybeSingle();if(error||!data){Alert.alert("Chat unavailable","No conversation is available yet.");return;}router.push({pathname:"/chat",params:{conversationId:data.id,otherName:privateData?.customer_name||"Customer"}});}}
 async function call(){
  const phone=privateData?.customer_phone||privateData?.professional_phone;
  if(phone)await Linking.openURL(`tel:${phone}`);else Alert.alert("Phone unavailable","Contact details are not available yet.");
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.c}>
   <View style={s.top}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><VasudhaLogo compact/><View style={{width:24}}/></View>
   <Text style={s.title}>Job Details</Text>
   {loading?<View style={s.state}><ActivityIndicator color="#087D65"/><Text style={s.muted}>Loading job…</Text></View>:!job?<Text style={s.muted}>Job not found.</Text>:<>
    <View style={s.card}><Text style={s.name}>{job.title||"Service job"}</Text><Text style={s.badge}>{job.status||"In Progress"}</Text><Text style={s.label}>{mode==="professional"?"Customer":"Professional"}</Text><Text style={s.value}>{privateData?.customer_name||privateData?.professional_name||"Connected participant"}</Text><Text style={s.label}>Job location</Text><Text style={s.value}>{privateData?.location_text||"Location will be available after the job is accepted."}</Text></View>
    <JobLocationMap latitude={privateData?.latitude} longitude={privateData?.longitude} label={privateData?.location_text}/>
    <View style={s.actions}><Pressable style={s.secondary} onPress={call}><Text style={s.secondaryText}>Call</Text></Pressable><Pressable style={s.primary} onPress={openChat}><Text style={s.primaryText}>Message</Text></Pressable></View>
    <Pressable style={s.track} onPress={()=>router.push({pathname:"/job-tracking",params:{jobId}})}><Text style={s.trackText}>Track Job →</Text></Pressable>
   </>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},c:{padding:20,paddingBottom:40},top:{height:46,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#f2f7f5",alignItems:"center",justifyContent:"center"},backText:{fontSize:30},more:{fontSize:24,color:"#087D65"},title:{fontSize:28,fontWeight:"900",color:"#13201c",marginTop:18},card:{borderWidth:1,borderColor:"#e0e8e5",borderRadius:18,padding:16,marginTop:18},name:{fontSize:18,fontWeight:"900",color:"#13201c"},badge:{alignSelf:"flex-start",backgroundColor:"#e7f7f2",color:"#087D65",paddingHorizontal:10,paddingVertical:5,borderRadius:12,fontWeight:"800",marginTop:8},label:{fontSize:11,color:"#66736e",marginTop:16},value:{fontWeight:"800",marginTop:3},map:{height:180,borderRadius:18,marginTop:14,backgroundColor:"#e9f3ef",overflow:"hidden",alignItems:"center",justifyContent:"center"},route:{width:"70%",height:3,backgroundColor:"#087D65",transform:[{rotate:"-18deg"}]},mapText:{position:"absolute",bottom:12,backgroundColor:"#fff",paddingHorizontal:10,paddingVertical:6,borderRadius:10,fontWeight:"800"},actions:{flexDirection:"row",gap:10,marginTop:12},secondary:{flex:1,borderWidth:1,borderColor:"#087D65",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},secondaryText:{color:"#087D65",fontWeight:"900"},primary:{flex:1,backgroundColor:"#087D65",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"},track:{marginTop:12,borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:"#e7f7f2"},trackText:{color:"#087D65",fontWeight:"900"},state:{alignItems:"center",paddingVertical:50},muted:{color:"#66736e",marginTop:4}});

function JobLocationMap({latitude,longitude,label}:{latitude?:number|null;longitude?:number|null;label?:string|null}){if(latitude==null||longitude==null)return <View style={s.map}><View style={s.route}/><Text style={s.mapText}>{label||"Service location"}</Text></View>;if(Platform.OS==="web")return <View style={s.map}><View style={s.route}/><Text style={s.mapText}>📍 {label||"Service location"} · {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</Text></View>;const Maps=require("react-native-maps");const MapView=Maps.default||Maps;const Marker=Maps.Marker;return <View style={s.map}><MapView style={{flex:1}} initialRegion={{latitude:Number(latitude),longitude:Number(longitude),latitudeDelta:0.01,longitudeDelta:0.01}}><Marker coordinate={{latitude:Number(latitude),longitude:Number(longitude)}} title="Service location" description={label||undefined}/></MapView></View>}
