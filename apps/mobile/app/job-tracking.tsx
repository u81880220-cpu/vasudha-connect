import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import JobTrackingLocationMap from "../src/components/JobTrackingLocationMap";
import { KAMPRO } from "../src/components/kamproTheme";

const steps=[["worker_accepted","Professional accepted"],["on_the_way","On the Way"],["arrived","Arrived"],["work_started","Work Started"],["work_completed","Work Completed"],["customer_confirmed","Customer Confirmed"]];

export default function JobTracking(){
 const {jobId}=useLocalSearchParams<{jobId:string}>(); const {user,mode}=useAuth(); const [job,setJob]=useState<any>(null); const [updating,setUpdating]=useState(false); const [privateData,setPrivateData]=useState<any>({}); const [live,setLive]=useState<any>(null); const [route,setRoute]=useState<any>(null); const [routeBusy,setRouteBusy]=useState(false); const [loading,setLoading]=useState(true);
 useEffect(()=>{load()},[jobId]);
 useEffect(()=>{if(!jobId||mode!=="professional")return;let watcher:Location.LocationSubscription|undefined;let active=true;(async()=>{const perm=await Location.requestForegroundPermissionsAsync();if(perm.status!=="granted")return;watcher=await Location.watchPositionAsync({accuracy:Location.Accuracy.Balanced,timeInterval:10000,distanceInterval:20},async pos=>{if(!active)return;await supabase.rpc("update_professional_live_location",{p_job_id:jobId,p_latitude:pos.coords.latitude,p_longitude:pos.coords.longitude,p_accuracy_m:pos.coords.accuracy??null});});})();return()=>{active=false;watcher?.remove()}},[jobId,mode]);
 useEffect(()=>{if(!jobId)return; let active=true; const tick=async()=>{const{data}=await supabase.rpc("get_job_live_location",{p_job_id:jobId});if(active)setLive(data?.[0]||null)}; void tick(); const t=setInterval(tick,10000); return()=>{active=false;clearInterval(t)}},[jobId]);
 async function load(){if(!jobId){setLoading(false);return;}const{data}=await supabase.from("jobs").select("*").eq("id",jobId).maybeSingle();setJob(data);if(data){const{data:pd}=await supabase.rpc("get_job_contact_and_location",{p_job_id:jobId});setPrivateData(pd||{});}setLoading(false);}
 async function openCustomerNavigation(){
  const rawLat=privateData?.service_location?.latitude;
  const rawLng=privateData?.service_location?.longitude;
  const lat=rawLat==null||rawLat===""?NaN:Number(rawLat);
  const lng=rawLng==null||rawLng===""?NaN:Number(rawLng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180||(lat===0&&lng===0)){
   Alert.alert("Location unavailable","The customer's service address has no valid map coordinates yet. Ask the customer to set their service location, then reopen tracking.");
   return;
  }
  const url=`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  try{await Linking.openURL(url)}catch(e:any){Alert.alert("Navigation unavailable",e?.message||"Could not open maps.");}
 }
 async function calculateRoute(){
  const origin={latitude:Number(live?.latitude),longitude:Number(live?.longitude)};
  const destination={latitude:Number(privateData?.service_location?.latitude),longitude:Number(privateData?.service_location?.longitude)};
  if(!Number.isFinite(origin.latitude)||!Number.isFinite(origin.longitude)||!Number.isFinite(destination.latitude)||!Number.isFinite(destination.longitude)){
   Alert.alert("Route unavailable","Live professional location and the service location are both required to calculate an ETA.");return;
  }
  setRouteBusy(true);
  const {data,error}=await supabase.functions.invoke("google-routes",{body:{job_id:jobId}});
  setRouteBusy(false);
  if(error||data?.error){Alert.alert("Unable to calculate route",data?.error||error?.message||"Please try again.");return;}
  setRoute(data);
 }
 async function advanceStatus(){
  if(!job)return;
  const next:Record<string,string>={worker_accepted:"on_the_way",on_the_way:"arrived",arrived:"work_started",work_started:"work_completed"};
  const nextStatus=mode==="professional"?next[job.status]:job.status==="work_completed"?"customer_confirmed":null;
  if(!nextStatus)return;
  setUpdating(true);
  const{data,error}=await supabase.rpc("update_job_status",{p_job_id:job.id,p_status:nextStatus});
  setUpdating(false);
  if(error){Alert.alert("Unable to update job",error.message);return;}
  if(data) setJob(data); else await load();
 }
 const idx=Math.max(0,steps.findIndex(x=>x[0]===job?.status));
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.c}>
   <View style={s.top}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><VasudhaLogo compact/><View style={{width:24}}/></View>
   <Text style={s.title}>Job Tracking</Text><Text style={s.sub}>{job?.title||"Electrical work at home"}</Text>
   {loading?<View style={s.state}><ActivityIndicator color="#FF4B1F"/><Text style={s.muted}>Loading tracking…</Text></View>:<View style={s.card}>
     <Text style={s.jobId}>JOB · {String(job?.id||jobId||"12345").slice(0,8).toUpperCase()}</Text>
     {steps.map((x,i)=><View key={x[0]} style={s.stepRow}><View style={s.track}>{i<steps.length-1&&<View style={[s.line,i<=idx&&s.doneLine]}/>}<View style={[s.dot,i<=idx?s.active:s.inactive]}>{i<=idx&&<Text style={s.check}>✓</Text>}</View></View><View><Text style={[s.step,i<=idx?s.done:s.future]}>{x[1]}</Text>{i===idx?<Text style={s.current}>Current status</Text>:null}</View></View>)}
   </View>}
   <JobTrackingLocationMap serviceLatitude={privateData?.service_location?.latitude} serviceLongitude={privateData?.service_location?.longitude} serviceLabel={privateData?.service_location?.address} liveLatitude={live?.latitude} liveLongitude={live?.longitude}/>
   {mode==="customer"&&job?.status&&["worker_accepted","on_the_way","arrived","work_started"].includes(job.status)?<View style={s.routeCard}>
     <Text style={s.infoTitle}>Google Maps route & ETA</Text>
     <Text style={s.muted}>Calculate the driving distance and traffic-aware ETA from the professional's latest shared location.</Text>
     <Pressable style={s.navigation} disabled={routeBusy||!live} onPress={calculateRoute}><Text style={s.navigationText}>{routeBusy?"Calculating route…":!live?"Waiting for live location":"Calculate distance & ETA"}</Text></Pressable>
     {route?<Text style={s.routeResult}>{route.distance_km} km • about {route.duration_minutes} min by car</Text>:null}
   </View>:null}
   {mode==="professional"&&["worker_accepted","on_the_way","arrived","work_started"].includes(job?.status)?<>
     <Pressable style={s.navigation} onPress={openCustomerNavigation}><Text style={s.navigationText}>📍 Navigate to Customer</Text></Pressable>
     <Pressable style={s.primary} disabled={updating} onPress={advanceStatus}><Text style={s.primaryText}>{updating?"Updating…":({worker_accepted:"Start Journey →",on_the_way:"Mark Arrived →",arrived:"Start Work →",work_started:"Mark Work Completed →"} as any)[job.status]}</Text></Pressable>
   </>:null}
   {mode==="customer"&&job?.status==="work_completed"?<Pressable style={s.confirm} disabled={updating} onPress={advanceStatus}><Text style={s.confirmText}>{updating?"Confirming…":"Confirm Work Completed ✓"}</Text></Pressable>:null}<View style={s.info}><Text style={s.infoTitle}>Shared details</Text><Text style={s.infoLine}>📍 Service location</Text><Text style={s.muted}>{privateData?.service_location?.address||"Location is available after job acceptance."}</Text>{privateData?.customer?.phone?<Text style={s.infoLine}>Customer Contact 1: {privateData.customer.phone}</Text>:null}{privateData?.customer?.phone_2?<Text style={s.infoLine}>Customer Contact 2: {privateData.customer.phone_2}</Text>:null}{privateData?.professional?.phone?<Text style={s.infoLine}>Professional Contact 1: {privateData.professional.phone}</Text>:null}{privateData?.professional?.phone_2?<Text style={s.infoLine}>Professional Contact 2: {privateData.professional.phone_2}</Text>:null}{live?<Text style={s.live}>● Professional live location updated {new Date(live.updated_at).toLocaleTimeString()}</Text>:job?.status&&["worker_accepted","on_the_way","arrived","work_started"].includes(job.status)?<Text style={s.muted}>Waiting for the professional to share live location…</Text>:null}{mode==="customer"&&live&&["worker_accepted","on_the_way","arrived","work_started"].includes(job?.status)?<Text style={s.live}>Live location is updating automatically while the professional is travelling.</Text>:null}</View>
   <Pressable style={s.secondary} onPress={()=>router.back()}><Text style={s.secondaryText}>Back to My Jobs</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:KAMPRO.background},c:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:60},top:{height:46,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},backText:{fontSize:30,color:"#10233F"},more:{fontSize:24,color:"#FF4B1F"},title:{fontSize:28,fontWeight:"900",color:"#10233F",marginTop:18},sub:{color:"#6B7280",marginTop:5},card:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:20,padding:20,marginTop:20,backgroundColor:KAMPRO.surface,shadowColor:KAMPRO.navy,shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},jobId:{fontSize:11,color:"#8B93A1",marginBottom:14},stepRow:{flexDirection:"row",minHeight:52},track:{width:24,alignItems:"center",position:"relative"},line:{position:"absolute",top:16,bottom:0,width:2,backgroundColor:"#E2E5EA"},doneLine:{backgroundColor:"#FF4B1F"},dot:{width:16,height:16,borderRadius:8,borderWidth:1,alignItems:"center",justifyContent:"center",zIndex:2},active:{backgroundColor:"#FF4B1F",borderColor:"#FF4B1F"},inactive:{backgroundColor:"#fff",borderColor:"#CBD0D8"},check:{fontSize:9,color:"#fff",fontWeight:"900"},step:{marginLeft:10,fontSize:14},done:{fontWeight:"800",color:"#10233F"},future:{color:"#8B93A1"},current:{fontSize:11,color:"#FF4B1F",fontWeight:"800",marginLeft:10,marginTop:2},state:{alignItems:"center",paddingVertical:50},muted:{color:"#6B7280",marginTop:5},routeCard:{borderWidth:1,borderColor:"#DCE8F7",borderRadius:16,padding:16,marginTop:14,backgroundColor:"#F4F8FE"},routeResult:{marginTop:12,fontSize:16,fontWeight:"900",color:"#087D65"},info:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,marginTop:14},infoTitle:{fontSize:17,fontWeight:"900",color:"#10233F",marginBottom:12},infoLine:{fontWeight:"800",marginTop:8},secondary:{marginTop:14,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},secondaryText:{color:"#FF4B1F",fontWeight:"900"},navigation:{marginTop:14,borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0EA",borderWidth:1,borderColor:"#FF4B1F"},navigationText:{color:"#FF4B1F",fontWeight:"900"},primary:{marginTop:10,borderRadius:12,minHeight:50,alignItems:"center",justifyContent:"center",backgroundColor:"#10233F"},primaryText:{color:"#fff",fontWeight:"900"},confirm:{marginTop:14,borderRadius:12,minHeight:50,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4B1F"},confirmText:{color:"#fff",fontWeight:"900"},map:{height:200,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},mapText:{backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:7,borderRadius:10,fontWeight:"800"},live:{color:"#FF4B1F",fontWeight:"800",marginTop:10}});

