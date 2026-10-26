import { useEffect, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "react-native";
import * as Location from "expo-location";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";
import JobTrackingLocationMap from "../src/components/JobTrackingLocationMap";

const steps=[["worker_accepted","Professional accepted"],["on_the_way","On the Way"],["arrived","Arrived"],["work_started","Work Started"],["work_completed","Work Completed"],["customer_confirmed","Customer Confirmed"]];

export function ErrorBoundary({error,retry}:{error:Error;retry:()=>void}) {
 return <SafeAreaView style={s.safe}><View style={{flex:1,justifyContent:"center",padding:24}}><Text style={s.title}>Job tracking couldn't open</Text><Text style={s.muted}>The tracking screen encountered an error. Your job request is still saved. Please retry, or return to My Jobs.</Text><Text style={[s.muted,{marginTop:12}]}>{error?.message||"Unexpected tracking error"}</Text><Pressable style={s.primary} onPress={retry}><Text style={s.primaryText}>Try again</Text></Pressable><Pressable style={s.secondary} onPress={()=>router.replace("/jobs")}><Text style={s.secondaryText}>Back to My Jobs</Text></Pressable></View></SafeAreaView>;
}

export default function JobTracking(){
 const routeParams=useLocalSearchParams<{jobId?:string|string[]}>(); const jobId=Array.isArray(routeParams.jobId)?routeParams.jobId[0]:routeParams.jobId; const {user,mode}=useAuth(); const [job,setJob]=useState<any>(null); const [updating,setUpdating]=useState(false); const [privateData,setPrivateData]=useState<any>({}); const [live,setLive]=useState<any>(null); const [route,setRoute]=useState<any>(null); const [routeBusy,setRouteBusy]=useState(false); const [loading,setLoading]=useState(true); const [photoCount,setPhotoCount]=useState(0); const [photoBusy,setPhotoBusy]=useState(false);
 useEffect(()=>{load()},[jobId]);
 // Keep the tracking screen current after acceptance and subsequent status changes.
 useEffect(()=>{
  if(!jobId||!user?.id)return;
  let active=true;
  const refresh=()=>{if(active)void load()};
  const channel=supabase.channel("job-tracking-status-"+String(jobId))
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"jobs",filter:"id=eq."+String(jobId)},refresh)
   .subscribe();
  const interval=setInterval(refresh,15000);
  return()=>{active=false;clearInterval(interval);void supabase.removeChannel(channel)};
 },[jobId,user?.id,mode]);
 useEffect(()=>{if(!jobId||mode!=="professional"||!job||!["worker_accepted","on_the_way","arrived","work_started"].includes(job.status))return;let watcher:Location.LocationSubscription|undefined;let active=true;(async()=>{try{const perm=await Location.requestForegroundPermissionsAsync();if(!active)return;if(perm.status!=="granted"){console.warn("KAMPRO live tracking: location permission not granted");return;}watcher=await Location.watchPositionAsync({accuracy:Location.Accuracy.Balanced,timeInterval:10000,distanceInterval:10},async pos=>{if(!active)return;const{error}=await supabase.rpc("update_professional_live_location",{p_job_id:jobId,p_latitude:pos.coords.latitude,p_longitude:pos.coords.longitude,p_accuracy_m:pos.coords.accuracy??null});if(error)console.error("KAMPRO live location update failed:",error.message);});}catch(e){console.error("KAMPRO live tracking could not start:",e);}})();return()=>{active=false;watcher?.remove()}},[jobId,mode,job?.status]);
 useEffect(()=>{if(!jobId)return; let active=true; const tick=async()=>{try{const{data,error}=await supabase.rpc("get_job_live_location",{p_job_id:String(jobId)});if(error)console.warn("KAMPRO live location lookup failed:",error.message);if(active)setLive(Array.isArray(data)?data[0]||null:data||null);}catch(e){console.warn("KAMPRO live location polling failed:",e);}}; void tick(); const t=setInterval(()=>{void tick()},15000); return()=>{active=false;clearInterval(t)}},[jobId]);
 async function load(){
  if(!jobId){setJob(null);setPrivateData({});setLoading(false);return;}
  if(!job)setLoading(true);
  try{
   const{data,error}=await supabase.from("jobs").select("*").eq("id",String(jobId)).maybeSingle();
   if(error)throw error;
   setJob(data||null);
   // Render the persisted job status immediately; contact/location RPCs must not
   // keep the entire tracking screen stuck on a loading spinner.
   setLoading(false);
   if(!data){setPrivateData({});return;}
   const{data:pd,error:privateError}=await supabase.rpc("get_job_contact_and_location",{p_job_id:String(jobId)});
   if(privateError)console.warn("KAMPRO job details unavailable:",privateError.message);
   let resolvedPrivateData=pd||{};
   const existingLocation=resolvedPrivateData?.service_location||{};
   const hasServiceCoordinates=existingLocation.latitude!=null&&existingLocation.longitude!=null;
   if(data.request_id&&!hasServiceCoordinates){
    // Recover service coordinates from the participant-scoped request row if
    // the private-details RPC is delayed or returns incomplete location data.
    const{data:requestData,error:requestError}=await supabase.from("service_requests")
     .select("location_text,location_latitude,location_longitude")
     .eq("id",String(data.request_id)).maybeSingle();
    if(requestError)console.warn("KAMPRO service location fallback unavailable:",requestError.message);
    if(requestData)resolvedPrivateData={...resolvedPrivateData,service_location:{...existingLocation,address:existingLocation.address||requestData.location_text,latitude:existingLocation.latitude??requestData.location_latitude,longitude:existingLocation.longitude??requestData.location_longitude}};
   }
   setPrivateData(resolvedPrivateData);
   if(mode==="professional"&&user?.id){
    const{count,error:countError}=await supabase.from("portfolio_items").select("id",{count:"exact",head:true}).eq("job_id",String(jobId)).eq("professional_id",user.id);
    if(countError)console.warn("KAMPRO work-photo count unavailable:",countError.message);
    setPhotoCount(count||0);
   }
  }catch(e:any){
   console.error("KAMPRO job tracking load failed:",e?.message||e);
   // Keep the already-loaded job/status visible if a secondary tracking lookup fails.
   if(!job)setJob(null);
   setPrivateData(current=>Object.keys(current||{}).length?current:{});
   Alert.alert("Unable to open job","Some job details could not be refreshed. Your saved job status remains available; please retry tracking.");
  }finally{setLoading(false);}
 }
 async function uploadCompletedWorkPhotos(){
  if(!job||!user?.id||mode!=="professional"||job.status!=="work_completed")return;
  const remaining=Math.max(0,2-photoCount);
  if(!remaining){Alert.alert("Photo limit reached","You can upload a maximum of two photos for this completed job.");return;}
  const result=await DocumentPicker.getDocumentAsync({type:"image/*",copyToCacheDirectory:true,multiple:true});
  if(result.canceled||!result.assets?.length)return;
  const selected=result.assets.slice(0,remaining);
  if(result.assets.length>remaining)Alert.alert("Photo limit","Only the first "+remaining+" photo(s) will be uploaded for this job.");
  setPhotoBusy(true);
  try{
   let added=0;
   for(const file of selected){
    if(!file.uri)continue;
    if((file.size||0)>8*1024*1024)throw new Error("Each photo must be 8 MB or smaller.");
    const ext=(file.name?.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path=user.id+"/"+job.id+"/"+Date.now()+"-"+Math.random().toString(36).slice(2,8)+"."+ext;
    const body=await fetch(file.uri).then(r=>r.arrayBuffer());
    const{error:uploadError}=await supabase.storage.from("professional-work-photos").upload(path,body,{contentType:file.mimeType||"image/jpeg",upsert:false});
    if(uploadError)throw uploadError;
    const{data:publicUrl}=supabase.storage.from("professional-work-photos").getPublicUrl(path);
    const{error:insertError}=await supabase.from("portfolio_items").insert({professional_id:user.id,job_id:job.id,title:"Completed work",description:"Work completed through KAMPRO",media_url:publicUrl.publicUrl,moderation_status:"pending"});
    if(insertError){await supabase.storage.from("professional-work-photos").remove([path]);throw insertError;}
    added++;
   }
   setPhotoCount(n=>Math.min(2,n+added));
   Alert.alert("Photos submitted",added+" photo(s) submitted for review. Approved photos will appear on your public professional profile.");
  }catch(e:any){Alert.alert("Photo upload failed",e?.message||"Please try again.");}
  finally{setPhotoBusy(false);}
 }
 async function openCustomerNavigation(){
  const location=privateData?.service_location||{};
  const rawLat=location.latitude??location.lat??location.coordinates?.latitude;
  const rawLng=location.longitude??location.lng??location.lon??location.coordinates?.longitude;
  const lat=rawLat==null||rawLat===""?NaN:Number(rawLat);
  const lng=rawLng==null||rawLng===""?NaN:Number(rawLng);
  const hasCoordinates=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(lat===0&&lng===0);
  const address=String(location.address||location.full_address||location.formatted_address||"").trim();
  if(!hasCoordinates&&!address){
   Alert.alert("Customer location unavailable","No map coordinates or service address were returned for this job. Ask the customer to update their service location, then refresh tracking.");
   return;
  }
  // Prefer exact coordinates; fall back to the saved address when older jobs
  // have an address but no geocoded coordinates.
  const destination=hasCoordinates?String(lat)+","+String(lng):address;
  const url=hasCoordinates
   ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
   : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
  try{
   await Linking.openURL(url);
  }catch(e:any){
   Alert.alert("Navigation unavailable",e?.message||"Could not open Google Maps. Please try again.");
  }
 }
 async function calculateRoute(){
  const origin={latitude:Number(live?.latitude),longitude:Number(live?.longitude)};
  const destination={latitude:Number(privateData?.service_location?.latitude),longitude:Number(privateData?.service_location?.longitude)};
  if(!Number.isFinite(origin.latitude)||!Number.isFinite(origin.longitude)||!Number.isFinite(destination.latitude)||!Number.isFinite(destination.longitude)){
   Alert.alert("Route unavailable","Live professional location and the service location are both required to calculate an ETA.");return;
  }
  setRouteBusy(true);
  try{
   const {data,error}=await supabase.functions.invoke("google-routes",{body:{job_id:String(jobId)}});
   if(error||data?.error){Alert.alert("Unable to calculate route",data?.error||error?.message||"Please try again.");return;}
   setRoute(data);
  }catch(e:any){Alert.alert("Unable to calculate route",e?.message||"Please try again.");}
  finally{setRouteBusy(false);}
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
   {mode==="customer"&&job?.status&&["worker_accepted","on_the_way","arrived","work_started"].includes(job.status)?<View style={s.routeCard}>
     <Text style={s.infoTitle}>Live professional tracking</Text>
     <Text style={s.muted}>The map shows the service location and the latest shared GPS location.</Text>
     <JobTrackingLocationMap serviceLatitude={privateData?.service_location?.latitude??privateData?.service_location?.lat??privateData?.service_location?.coordinates?.latitude} serviceLongitude={privateData?.service_location?.longitude??privateData?.service_location?.lng??privateData?.service_location?.coordinates?.longitude} serviceLabel={privateData?.service_location?.address||"Service location"} liveLatitude={live?.latitude} liveLongitude={live?.longitude}/>
     <Pressable style={s.navigation} disabled={routeBusy||!live} onPress={calculateRoute}><Text style={s.navigationText}>{routeBusy?"Calculating route…":!live?"Waiting for live location":"Calculate distance & ETA"}</Text></Pressable>
     {route?<Text style={s.routeResult}>{route.distance_km} km • about {route.duration_minutes} min by car</Text>:null}
   </View>:null}
   {mode==="professional"&&["worker_accepted","on_the_way","arrived","work_started"].includes(job?.status)?<>
     <Pressable style={s.navigation} onPress={openCustomerNavigation}><Text style={s.navigationText}>📍 Navigate to Customer</Text></Pressable>
     <Pressable style={s.primary} disabled={updating} onPress={advanceStatus}><Text style={s.primaryText}>{updating?"Updating…":({worker_accepted:"Start Journey →",on_the_way:"Mark Arrived →",arrived:"Start Work →",work_started:"Mark Work Completed →"} as any)[job.status]}</Text></Pressable>
   </>:null}
   {mode==="professional"&&job?.status==="work_completed"?<View style={s.photoCard}><Text style={s.infoTitle}>Completed-work photos</Text><Text style={s.muted}>Upload up to two photos of this job. After review, approved photos appear on your public profile. {photoCount}/2 uploaded.</Text>{photoCount<2?<Pressable style={s.primary} disabled={photoBusy} onPress={uploadCompletedWorkPhotos}><Text style={s.primaryText}>{photoBusy?"Uploading photos…":"Upload work photos ("+(2-photoCount)+" remaining)"}</Text></Pressable>:<Text style={s.photoDone}>Photo limit reached · 2/2</Text>}</View>:null}
   {mode==="customer"&&job?.status==="work_completed"?<Pressable style={s.confirm} disabled={updating} onPress={advanceStatus}><Text style={s.confirmText}>{updating?"Confirming…":"Confirm Work Completed ✓"}</Text></Pressable>:null}<View style={s.info}><Text style={s.infoTitle}>Shared details</Text><Text style={s.infoLine}>📍 Service location</Text><Text style={s.muted}>{privateData?.service_location?.address||"Location is available after job acceptance."}</Text>{privateData?.customer?.phone?<Text style={s.infoLine}>Customer Contact 1: {privateData.customer.phone}</Text>:null}{privateData?.customer?.phone_2?<Text style={s.infoLine}>Customer Contact 2: {privateData.customer.phone_2}</Text>:null}{privateData?.professional?.phone?<Text style={s.infoLine}>Professional Contact 1: {privateData.professional.phone}</Text>:null}{privateData?.professional?.phone_2?<Text style={s.infoLine}>Professional Contact 2: {privateData.professional.phone_2}</Text>:null}{live?<Text style={s.live}>● Professional live location updated {new Date(live.updated_at).toLocaleTimeString()}</Text>:job?.status&&["worker_accepted","on_the_way","arrived","work_started"].includes(job.status)?<Text style={s.muted}>Waiting for the professional to share live location…</Text>:null}{mode==="customer"&&live&&["worker_accepted","on_the_way","arrived","work_started"].includes(job?.status)?<Text style={s.live}>Live location is updating automatically while the professional is travelling.</Text>:null}</View>
   <Pressable style={s.secondary} onPress={()=>router.back()}><Text style={s.secondaryText}>Back to My Jobs</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:KAMPRO.background},c:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:60},top:{height:46,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},backText:{fontSize:30,color:"#10233F"},more:{fontSize:24,color:"#FF4B1F"},title:{fontSize:28,fontWeight:"900",color:"#10233F",marginTop:18},sub:{color:"#6B7280",marginTop:5},card:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:20,padding:20,marginTop:20,backgroundColor:KAMPRO.surface,shadowColor:KAMPRO.navy,shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},jobId:{fontSize:11,color:"#8B93A1",marginBottom:14},stepRow:{flexDirection:"row",minHeight:52},track:{width:24,alignItems:"center",position:"relative"},line:{position:"absolute",top:16,bottom:0,width:2,backgroundColor:"#E2E5EA"},doneLine:{backgroundColor:"#FF4B1F"},dot:{width:16,height:16,borderRadius:8,borderWidth:1,alignItems:"center",justifyContent:"center",zIndex:2},active:{backgroundColor:"#FF4B1F",borderColor:"#FF4B1F"},inactive:{backgroundColor:"#fff",borderColor:"#CBD0D8"},check:{fontSize:9,color:"#fff",fontWeight:"900"},step:{marginLeft:10,fontSize:14},done:{fontWeight:"800",color:"#10233F"},future:{color:"#8B93A1"},current:{fontSize:11,color:"#FF4B1F",fontWeight:"800",marginLeft:10,marginTop:2},state:{alignItems:"center",paddingVertical:50},muted:{color:"#4B5563",marginTop:5},routeCard:{borderWidth:1,borderColor:"#DCE8F7",borderRadius:16,padding:16,marginTop:14,backgroundColor:"#F4F8FE"},routeResult:{marginTop:12,fontSize:16,fontWeight:"900",color:"#087D65"},info:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,marginTop:14},infoTitle:{fontSize:17,fontWeight:"900",color:"#10233F",marginBottom:12},infoLine:{fontWeight:"800",marginTop:8,color:"#10233F"},photoCard:{borderWidth:1,borderColor:"#bcd9d0",borderRadius:16,padding:16,marginTop:14,backgroundColor:"#f2f8f6"},photoDone:{color:"#087D65",fontWeight:"900",marginTop:10},secondary:{marginTop:14,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center"},secondaryText:{color:"#FF4B1F",fontWeight:"900"},navigation:{marginTop:14,borderRadius:12,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0EA",borderWidth:1,borderColor:"#FF4B1F"},navigationText:{color:"#FF4B1F",fontWeight:"900"},primary:{marginTop:10,borderRadius:12,minHeight:50,alignItems:"center",justifyContent:"center",backgroundColor:"#10233F"},primaryText:{color:"#fff",fontWeight:"900"},confirm:{marginTop:14,borderRadius:12,minHeight:50,alignItems:"center",justifyContent:"center",backgroundColor:"#FF4B1F"},confirmText:{color:"#fff",fontWeight:"900"},map:{height:200,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},mapText:{backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:7,borderRadius:10,fontWeight:"800"},live:{color:"#FF4B1F",fontWeight:"800",marginTop:10}});

