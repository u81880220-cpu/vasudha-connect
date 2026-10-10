import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import JobLocationMap from "../src/components/JobLocationMap";
import { KamproPage, KamproHeader, KamproCard } from "../src/components/KamproUI";

export default function JobDetails(){
 const {jobId}=useLocalSearchParams<{jobId:string}>();const{mode}=useAuth();const[job,setJob]=useState<any>(null);const[request,setRequest]=useState<any>(null);const[privateData,setPrivateData]=useState<any>({});const[loading,setLoading]=useState(true);
 useEffect(()=>{if(jobId)load()},[jobId]);
 async function load(){
  setLoading(true);
  const [{data,error}]=await Promise.all([supabase.from("jobs").select("*").eq("id",jobId).maybeSingle()]);
  if(error){Alert.alert("Unable to load job",error.message);setLoading(false);return;}
  setJob(data);
  if(data){
   if(data.request_id){const{data:rq}=await supabase.from("service_requests").select("title,description,preferred_date,preferred_time,location_text,location_latitude,location_longitude").eq("id",data.request_id).maybeSingle();setRequest(rq||null);}else setRequest(null);
   const{data:pd}=await supabase.rpc("get_job_contact_details",{p_job_id:jobId});setPrivateData(pd||{});
  }
  setLoading(false);
 }
 async function openChat(){if(!job)return;if(mode==="customer"){const{data:conversationId,error}=await supabase.rpc("get_or_create_conversation",{p_professional_id:job.professional_id});if(error||!conversationId){Alert.alert("Chat unavailable",error?.message||"Unable to open chat.");return;}router.push({pathname:"/chat",params:{conversationId,otherName:privateData?.professional_name||"Professional"}});}else{const{data,error}=await supabase.from("conversations").select("id").eq("customer_id",job.customer_id).eq("professional_id",job.professional_id).maybeSingle();if(error||!data){Alert.alert("Chat unavailable","No conversation is available yet.");return;}router.push({pathname:"/chat",params:{conversationId:data.id,otherName:privateData?.customer_name||"Customer"}});}}
 async function call(){
  const phone=privateData?.customer_phone||privateData?.professional_phone;
  if(phone)await Linking.openURL(`tel:${phone}`);else Alert.alert("Phone unavailable","Contact details are not available yet.");
 }
 async function navigate(){
  const lat=privateData?.latitude,lon=privateData?.longitude;
  if(lat==null||lon==null){Alert.alert("Navigation unavailable","The accepted work does not have a mapped service location yet.");return;}
  const url=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lon}`)}`;
  try{await Linking.openURL(url);}catch{Alert.alert("Navigation unavailable","Unable to open your maps application.");}
 }
 async function cancelJob(){
  Alert.alert("Cancel this job?","Cancellation is allowed before work starts. If work has already started, use Report a Problem instead.",[{text:"Keep Job",style:"cancel"},{text:"Cancel Job",style:"destructive",onPress:async()=>{const{error}=await supabase.rpc("cancel_job",{p_job_id:job.id,p_reason:"Cancelled by participant"});if(error)Alert.alert("Unable to cancel",error.message);else{Alert.alert("Job cancelled","The other participant has been notified.",[{text:"OK",onPress:load}]);}}}]);
 }
 return <KamproPage>
   <KamproHeader title="Job Details" back onBack={()=>router.back()}/>
   {loading?<View style={s.state}><ActivityIndicator color="#FF4B1F"/><Text style={s.muted}>Loading job…</Text></View>:!job?<Text style={s.muted}>Job not found.</Text>:<>
    <View style={s.card}><Text style={s.name}>{request?.title||job.title||"Service job"}</Text><Text style={[s.badge,job.status==="cancelled"&&s.cancelledBadge]}>{String(job.status||"In Progress").replaceAll("_"," ")}</Text><Text style={s.label}>{mode==="professional"?"Customer":"Professional"}</Text><Text style={s.value}>{privateData?.customer_name||privateData?.professional_name||"Connected participant"}</Text>
     {request?.description?<><Text style={s.label}>Work description</Text><Text style={s.value}>{request.description}</Text></>:null}
     {request?.preferred_date||request?.preferred_time?<><Text style={s.label}>Preferred schedule</Text><Text style={s.value}>{[request?.preferred_date,request?.preferred_time].filter(Boolean).join(" · ")}</Text></>:null}
     <Text style={s.label}>Job location</Text><Text style={s.value}>{privateData?.location_text||request?.location_text||(job.status==="cancelled"?"Location details are retained with the request, if provided.":"Location will be available after the job is accepted.")}</Text>
     {job.status==="cancelled"?<View style={s.cancelNote}><Text style={s.cancelNoteTitle}>This job was cancelled</Text><Text style={s.cancelNoteText}>{job.cancellation_reason||"Cancelled by a participant."}</Text></View>:null}
    </View>
    {job.status!=="cancelled"?<JobLocationMap latitude={privateData?.latitude??request?.location_latitude} longitude={privateData?.longitude??request?.location_longitude} label={privateData?.location_text||request?.location_text}/>:null}
    {job.status!=="cancelled"?<><View style={s.actions}><Pressable style={s.secondary} onPress={call}><Text style={s.secondaryText}>Call</Text></Pressable><Pressable style={s.primary} onPress={openChat}><Text style={s.primaryText}>Message</Text></Pressable></View>{mode==="professional"?<Pressable style={s.navigate} onPress={navigate}><Text style={s.navigateText}>Navigate to Customer →</Text></Pressable>:null}</>:null}
    {["worker_accepted","on_the_way","arrived"].includes(job.status)?<Pressable style={s.cancel} onPress={cancelJob}><Text style={s.cancelText}>Cancel Job</Text></Pressable>:null}
    {job.status!=="cancelled"?<Pressable style={s.track} onPress={()=>router.push({pathname:"/job-tracking",params:{jobId}})}><Text style={s.trackText}>Track Job →</Text></Pressable>:null}
   </>}
 </KamproPage>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},c:{padding:20,paddingBottom:40},top:{height:46,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},backText:{fontSize:30},more:{fontSize:24,color:"#FF4B1F"},title:{fontSize:28,fontWeight:"900",color:"#10233F",marginTop:18},card:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:18,padding:16,marginTop:18},name:{fontSize:18,fontWeight:"900",color:"#10233F"},badge:{alignSelf:"flex-start",backgroundColor:"#FFF0EA",color:"#FF4B1F",paddingHorizontal:10,paddingVertical:5,borderRadius:12,fontWeight:"800",marginTop:8},label:{fontSize:11,color:"#6B7280",marginTop:16},value:{fontWeight:"800",marginTop:3},map:{height:180,borderRadius:18,marginTop:14,backgroundColor:"#e9f3ef",overflow:"hidden",alignItems:"center",justifyContent:"center"},route:{width:"70%",height:3,backgroundColor:"#FF4B1F",transform:[{rotate:"-18deg"}]},mapText:{position:"absolute",bottom:12,backgroundColor:"#fff",paddingHorizontal:10,paddingVertical:6,borderRadius:10,fontWeight:"800"},actions:{flexDirection:"row",gap:10,marginTop:12},secondary:{flex:1,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},secondaryText:{color:"#FF4B1F",fontWeight:"900"},primary:{flex:1,backgroundColor:"#FF4B1F",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"},navigate:{marginTop:12,borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:"#10233F"},navigateText:{color:"#fff",fontWeight:"900"},track:{marginTop:12,borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0EA"},cancel:{marginTop:12,borderWidth:1,borderColor:"#d8b7b3",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},cancelText:{color:"#8b5b57",fontWeight:"900"},cancelNote:{marginTop:12,padding:12,borderRadius:12,backgroundColor:"#f7eceb"},cancelNoteTitle:{fontWeight:"900",color:"#8b5b57"},cancelledBadge:{backgroundColor:"#f7eceb",color:"#8b5b57"},cancelNoteText:{marginTop:4,color:"#6b4a47"},trackText:{color:"#FF4B1F",fontWeight:"900"},state:{alignItems:"center",paddingVertical:50},muted:{color:"#6B7280",marginTop:4}});

