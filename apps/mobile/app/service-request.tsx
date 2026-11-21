import { useEffect, useState } from "react";
import {getCurrentKamproLocation,searchKamproLocations,resolveKamproLocation,type LocationSuggestion} from "../src/lib/kamproLocation";
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { ServicePicker, ServiceSelection } from "../src/components/ServicePicker";
import { KAMPRO } from "../src/components/kamproTheme";
import JobLocationMap from "../src/components/JobLocationMap";

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
 const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [date,setDate]=useState(""); const [time,setTime]=useState(""); const [location,setLocation]=useState(""); const [serviceLatitude,setServiceLatitude]=useState<number|null>(null); const [serviceLongitude,setServiceLongitude]=useState<number|null>(null); const [gettingLocation,setGettingLocation]=useState(false); const [locationSuggestions,setLocationSuggestions]=useState<LocationSuggestion[]>([]); const [selectedLocation,setSelectedLocation]=useState<LocationSuggestion|null>(null); const [busy,setBusy]=useState(false); const [submitMessage,setSubmitMessage]=useState("");

 useEffect(()=>{
  const query=location.trim();
  if(query.length<3){setLocationSuggestions([]);return;}
  if(selectedLocation&&selectedLocation.label===query)return;
  let active=true;
  const timer=setTimeout(async()=>{const rows=await searchKamproLocations(query);if(active)setLocationSuggestions(rows);},180);
  return()=>{active=false;clearTimeout(timer);};
 },[location,selectedLocation]);
 useEffect(()=>{let active=true;void resolveSelection(()=>active);return()=>{active=false}},[serviceId,subServiceId,serviceName]);

 async function resolveSelection(isActive:()=>boolean=()=>true){
  setLoadingSelection(true);
  try{
   let resolvedServiceId=serviceId;
   if(!resolvedServiceId&&serviceName){
    const{data:byName,error}=await supabase.from("service_catalogue_services").select("id").eq("name",serviceName).eq("status","active").maybeSingle();
    if(error)throw error;
    resolvedServiceId=byName?.id||"";
   }
   if(!resolvedServiceId)return;
   const[{data:svc,error:svcError},{data:sub,error:subError}]=await Promise.all([
    supabase.from("service_catalogue_services").select("id,category_id,name,legacy_skill_id").eq("id",resolvedServiceId).maybeSingle(),
    subServiceId?supabase.from("service_catalogue_sub_services").select("id,service_id,name").eq("id",subServiceId).maybeSingle():Promise.resolve({data:null,error:null})
   ]);
   if(svcError)throw svcError;
   if(subError)throw subError;
   if(svc){
    const{data:cat,error:catError}=await supabase.from("service_categories").select("id,name").eq("id",svc.category_id).maybeSingle();
    if(catError)throw catError;
    if(!isActive())return;
    setSelection({categoryId:cat?.id||null,categoryName:cat?.name||null,serviceId:svc.id,serviceName:serviceName||svc.name,legacySkillId:svc.legacy_skill_id||null,subServiceId:sub?.id||subServiceId||null,subServiceName:sub?.name||subServiceName||null});
   }
  }catch(e:any){
   console.warn("KAMPRO service selection lookup failed:",e?.message||e);
   if(isActive())setSubmitMessage("The selected service could not be loaded. Please choose it again.");
  }finally{if(isActive())setLoadingSelection(false);}
 }

 async function useCurrentServiceLocation(){
  if(gettingLocation||busy)return;
  setGettingLocation(true);setSubmitMessage("");
  try{
   const point=await getCurrentKamproLocation();
   setLocation(point.label||"Current location");
   setServiceLatitude(point.latitude);setServiceLongitude(point.longitude);
   setSelectedLocation(null);setLocationSuggestions([]);
  }catch(e:any){setSubmitMessage(e?.message||"GPS could not detect your location. Enter the address manually.");}
  finally{setGettingLocation(false);}
 }

 async function selectAddress(place:LocationSuggestion){
  setSelectedLocation(place);setLocation(place.label);
  setServiceLatitude(place.latitude);setServiceLongitude(place.longitude);
  setLocationSuggestions([]);setSubmitMessage("");
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
   let latitude:number|null=serviceLatitude, longitude:number|null=serviceLongitude;
   if(latitude==null||longitude==null){
    const place=selectedLocation||await resolveKamproLocation(location,locationSuggestions);
    latitude=place.latitude;longitude=place.longitude;
    setServiceLatitude(latitude);setServiceLongitude(longitude);
   }
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
   router.replace({pathname:"/customer-request-details",params:{requestId:String(requestId)}});
  }catch(e:any){
   setSubmitMessage(e?.message||"The job request could not be created. Please try again.");
  }finally{
   setBusy(false);
  }
 }

 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
  <Text style={s.label}>What do you need? <Text style={s.optional}>(optional)</Text></Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Fix kitchen plumbing" placeholderTextColor="#667085" style={s.input}/>
  <Text style={s.label}>Work details <Text style={s.optional}>(optional)</Text></Text><TextInput value={description} onChangeText={setDescription} placeholder="Describe the work required..." placeholderTextColor="#667085" multiline style={[s.input,s.large]}/>
  <Text style={s.label}>Preferred date <Text style={s.optional}>(optional)</Text></Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#667085" style={s.input}/>
  <Text style={s.label}>Preferred time <Text style={s.optional}>(optional)</Text></Text><TextInput value={time} onChangeText={setTime} placeholder="e.g. 11:00 AM" placeholderTextColor="#667085" style={s.input}/>
  <Text style={s.label}>Service location (required for navigation)</Text><Pressable accessibilityRole="button" onPress={useCurrentServiceLocation} disabled={gettingLocation||busy} style={s.locationButton}><Text style={s.locationButtonText}>{gettingLocation?"Getting GPS location…":"⌖ Use current GPS location"}</Text></Pressable><TextInput value={location} onChangeText={value=>{setLocation(value);setSelectedLocation(null);setServiceLatitude(null);setServiceLongitude(null);setLocationSuggestions([]);setSubmitMessage("");}} placeholder="Search house, street, locality or area (e.g. Vibhuti Khand, Lucknow)" placeholderTextColor="#667085" style={[s.input,s.large]} returnKeyType="search" onSubmitEditing={()=>{if(locationSuggestions[0])void selectAddress(locationSuggestions[0]);}}/>{locationSuggestions.length>0?<View style={s.locationSuggestionList}>{locationSuggestions.map((place,i)=><Pressable key={place.latitude+"-"+place.longitude+"-"+i} onPress={()=>void selectAddress(place)} style={s.locationSuggestionItem}><Text style={s.locationSuggestionTitle}>{place.label}</Text><Text style={s.locationSuggestionDetail} numberOfLines={2}>{place.detail}</Text></Pressable>)}</View>:null}{serviceLatitude!=null&&serviceLongitude!=null?<><Text style={s.coordinateNote}>Location pin ready. Please confirm the marker is at the correct service address before creating the job.</Text><JobLocationMap latitude={serviceLatitude} longitude={serviceLongitude} label={location}/></>:null}
  <Text style={s.note}>Please provide the service location so the professional can open directions in Google Maps. Work details and schedule can be discussed later.</Text>
  {submitMessage?<View accessibilityRole="alert" style={s.submitError}><Text style={s.submitErrorText}>{submitMessage}</Text></View>:null}
  <Pressable accessibilityRole="button" onPress={submit} disabled={busy||loadingSelection} style={[s.primary,(busy||loadingSelection)&&{opacity:0.65}]}><Text style={s.primaryText}>{busy?"Creating job…":loadingSelection?"Loading service…":"Create Job"}</Text></Pressable>
 </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:KAMPRO.background},container:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:KAMPRO.navy,letterSpacing:-.4},muted:{color:"#475467",marginTop:6,lineHeight:20},loading:{marginTop:18,color:"#6B7280"},lockedSelection:{marginTop:16,borderWidth:1,borderColor:"#bcd9d0",borderRadius:16,padding:14,backgroundColor:"#f2f8f6"},selectedLabel:{fontSize:10,fontWeight:"900",color:"#FF4B1F",textTransform:"uppercase"},selectedService:{fontSize:17,fontWeight:"900",color:"#10233F",marginTop:4},selectedSub:{fontSize:13,color:"#46534f",marginTop:3},label:{fontWeight:"800",color:"#10233F",marginTop:20,marginBottom:7},optional:{fontSize:11,fontWeight:"600",color:"#6B7280"},input:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:14,padding:12,minHeight:48,backgroundColor:"#fff",color:"#10233F"},large:{height:120,textAlignVertical:"top"},locationButton:{marginBottom:8,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,minHeight:44,alignItems:"center",justifyContent:"center",backgroundColor:"#FFF0EA"},locationSuggestionList:{marginTop:4,borderWidth:1,borderColor:"#E7EAF0",borderRadius:12,backgroundColor:"#fff",overflow:"hidden"},locationSuggestionItem:{padding:12,borderBottomWidth:1,borderBottomColor:"#EEF2F6"},locationSuggestionTitle:{fontSize:14,fontWeight:"800",color:"#10233F"},locationSuggestionDetail:{fontSize:11,color:"#475467",marginTop:3},locationButtonText:{fontWeight:"900",color:"#FF4B1F"},coordinateNote:{fontSize:12,color:"#087D65",marginTop:7,fontWeight:"700"},note:{fontSize:12,color:"#6B7280",marginTop:10,lineHeight:18},submitError:{marginTop:12,padding:12,borderWidth:1,borderColor:"#FDA29B",backgroundColor:"#FEF3F2",borderRadius:12},submitErrorText:{color:"#B42318",fontSize:13,lineHeight:19,fontWeight:"600"},primary:{marginTop:24,borderRadius:12,padding:14,alignItems:"center",backgroundColor:"#FF4B1F",minHeight:50,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"}});
