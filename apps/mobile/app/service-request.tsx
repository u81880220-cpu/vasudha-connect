import { useEffect, useState } from "react";
import * as Location from "expo-location";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { ServicePicker, ServiceSelection } from "../src/components/ServicePicker";
import { KAMPRO } from "../src/components/kamproTheme";

export default function ServiceRequest(){
 const raw=useLocalSearchParams<{professionalId?:string;serviceId?:string|string[];subServiceId?:string|string[];serviceName?:string|string[];subServiceName?:string|string[]}>();
 const first=(v?:string|string[])=>Array.isArray(v)?v[0]:v;
 const professionalId=first(raw.professionalId)||"";
 const serviceId=first(raw.serviceId)||"";
 const subServiceId=first(raw.subServiceId)||"";
 const serviceName=first(raw.serviceName)||"";
 const subServiceName=first(raw.subServiceName)||"";
 const [selection,setSelection]=useState<ServiceSelection>({categoryId:null,categoryName:null,serviceId:serviceId||null,serviceName:serviceName||null,subServiceId:subServiceId||null,subServiceName:subServiceName||null});
 const [loadingSelection,setLoadingSelection]=useState(!!serviceId);
 const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [date,setDate]=useState(""); const [time,setTime]=useState(""); const [location,setLocation]=useState(""); const [busy,setBusy]=useState(false); const [submitMessage,setSubmitMessage]=useState("");

 useEffect(()=>{resolveSelection();},[serviceId,subServiceId]);

 async function resolveSelection(){
  setLoadingSelection(true);
  let resolvedServiceId=serviceId;
  if(!resolvedServiceId && serviceName){
   const {data:byName}=await supabase.from("service_catalogue_services").select("id").eq("name",serviceName).eq("status","active").maybeSingle();
   resolvedServiceId=byName?.id||"";
  }
  if(!resolvedServiceId){setLoadingSelection(false);return;}
  const[{data:svc},{data:sub}]=await Promise.all([
   supabase.from("service_catalogue_services").select("id,category_id,name,legacy_skill_id").eq("id",resolvedServiceId).maybeSingle(),
   subServiceId?supabase.from("service_catalogue_sub_services").select("id,service_id,name").eq("id",subServiceId).maybeSingle():Promise.resolve({data:null})
  ]);
  if(svc){
   const {data:cat}=await supabase.from("service_categories").select("id,name").eq("id",svc.category_id).maybeSingle();
   setSelection({
    categoryId:cat?.id||null,categoryName:cat?.name||null,serviceId:svc.id,serviceName:serviceName||svc.name,
    legacySkillId:svc.legacy_skill_id||null,subServiceId:sub?.id||subServiceId||null,subServiceName:sub?.name||subServiceName||null
   });
  }
  setLoadingSelection(false);
 }

 async function submit(){
  if(busy)return;
  setSubmitMessage("");
  if(!professionalId){
   setSubmitMessage("This request is not linked to a professional. Go back to Find Professionals, open a professional profile, and choose Create Job from that profile.");
   return;
  }
  if(loadingSelection){
   setSubmitMessage("Please wait while the selected service loads.");
   return;
  }
  if(!selection.serviceId){
   setSubmitMessage("Please choose a service before creating this job.");
   return;
  }
  if(!location.trim()){
   setSubmitMessage("Please enter the service address or area. The professional needs this to navigate to the job.");
   return;
  }
  setBusy(true);
  try{
   let latitude:null|number=null, longitude:null|number=null;
   try{
    if(location.trim()&&await Location.hasServicesEnabledAsync()){
     const perm=await Location.requestForegroundPermissionsAsync();
     if(perm.status==="granted"){
      const places=await Location.geocodeAsync(location.trim());
      if(places[0]){latitude=places[0].latitude;longitude=places[0].longitude;}
     }
    }
   }catch{}
   const {data:requestId,error}=await supabase.rpc("create_service_request",{
    p_professional_id:professionalId,
    p_service_id:selection.serviceId,
    p_sub_service_id:selection.subServiceId||null,
    p_title:title.trim()||null,
    p_description:description.trim()||null,
    p_preferred_date:date.trim()||null,
    p_preferred_time:time.trim()||null,
    p_location_text:location.trim()||null,
    p_location_latitude:latitude,
    p_location_longitude:longitude
   });
   if(error)throw error;
   if(!requestId)throw new Error("The server did not confirm that the request was created. Please open My Jobs and check before trying again.");
   router.replace({pathname:"/jobs",params:{created:"1",requestId:String(requestId)}});
  }catch(e:any){
   setSubmitMessage(e?.message||"The job request could not be created. Please try again.");
  }finally{
   setBusy(false);
  }
 }

 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <VasudhaLogo compact/><Text style={s.title}>Create Job Request</Text>
  <Text style={s.muted}>Your professional and selected service are carried forward automatically. Only the service is required; the remaining details are optional.</Text>
  {loadingSelection?<Text style={s.loading}>Loading selected service…</Text>:selection.serviceId?
   <View style={s.lockedSelection}>
    <Text style={s.selectedLabel}>Selected automatically</Text>
    <Text style={s.selectedService}>{selection.serviceName||"Service"}</Text>
    {selection.subServiceName?<Text style={s.selectedSub}>{selection.subServiceName}</Text>:null}
   </View>
   :<ServicePicker value={selection} optionalSubService onChange={setSelection}/>
  }
  <Text style={s.label}>What do you need? <Text style={s.optional}>(optional)</Text></Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Fix kitchen plumbing" style={s.input}/>
  <Text style={s.label}>Work details <Text style={s.optional}>(optional)</Text></Text><TextInput value={description} onChangeText={setDescription} placeholder="Describe the work required..." multiline style={[s.input,s.large]}/>
  <Text style={s.label}>Preferred date <Text style={s.optional}>(optional)</Text></Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={s.input}/>
  <Text style={s.label}>Preferred time <Text style={s.optional}>(optional)</Text></Text><TextInput value={time} onChangeText={setTime} placeholder="e.g. 11:00 AM" style={s.input}/>
  <Text style={s.label}>Service location (required for navigation)</Text><TextInput value={location} onChangeText={setLocation} placeholder="Enter full address or area, e.g. Civil Lines, Raebareli" style={[s.input,s.large]}/>
  <Text style={s.note}>Please provide the service location so the professional can open directions in Google Maps. Work details and schedule can be discussed later.</Text>
  {submitMessage?<View accessibilityRole="alert" style={s.submitError}><Text style={s.submitErrorText}>{submitMessage}</Text></View>:null}
  <Pressable accessibilityRole="button" onPress={submit} disabled={busy||loadingSelection} style={[s.primary,(busy||loadingSelection)&&{opacity:0.65}]}><Text style={s.primaryText}>{busy?"Creating job…":loadingSelection?"Loading service…":"Create Job"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:KAMPRO.background},container:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:KAMPRO.navy,letterSpacing:-.4},muted:{opacity:.65,marginTop:6,lineHeight:20},loading:{marginTop:18,color:"#6B7280"},lockedSelection:{marginTop:16,borderWidth:1,borderColor:"#bcd9d0",borderRadius:16,padding:14,backgroundColor:"#f2f8f6"},selectedLabel:{fontSize:10,fontWeight:"900",color:"#FF4B1F",textTransform:"uppercase"},selectedService:{fontSize:17,fontWeight:"900",color:"#10233F",marginTop:4},selectedSub:{fontSize:13,color:"#46534f",marginTop:3},label:{fontWeight:"800",marginTop:20,marginBottom:7},optional:{fontSize:11,fontWeight:"600",color:"#6B7280"},input:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:14,padding:12,minHeight:48,backgroundColor:"#fff",color:"#10233F"},large:{height:120,textAlignVertical:"top"},note:{fontSize:12,color:"#6B7280",marginTop:10,lineHeight:18},submitError:{marginTop:12,padding:12,borderWidth:1,borderColor:"#FDA29B",backgroundColor:"#FEF3F2",borderRadius:12},submitErrorText:{color:"#B42318",fontSize:13,lineHeight:19,fontWeight:"600"},primary:{marginTop:24,borderRadius:12,padding:14,alignItems:"center",backgroundColor:"#FF4B1F",minHeight:50,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"}});
