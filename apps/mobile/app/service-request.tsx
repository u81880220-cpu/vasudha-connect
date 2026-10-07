import { useState } from "react";
import * as Location from "expo-location";
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { ServicePicker, ServiceSelection } from "../src/components/ServicePicker";
import { KAMPRO } from "../src/components/kamproTheme";

export default function ServiceRequest(){
 const {professionalId,serviceId,subServiceId,serviceName,subServiceName}=useLocalSearchParams<{professionalId:string;serviceId?:string;subServiceId?:string;serviceName?:string;subServiceName?:string}>();
 const [selection,setSelection]=useState<ServiceSelection>({categoryId:null,categoryName:null,serviceId:serviceId||null,serviceName:serviceName||null,subServiceId:subServiceId||null,subServiceName:subServiceName||null});
 const [title,setTitle]=useState(""); const [description,setDescription]=useState(""); const [date,setDate]=useState(""); const [time,setTime]=useState(""); const [location,setLocation]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(){
  if(!professionalId||!selection.serviceId){Alert.alert("Choose a service","Select the service you want from the professional. The remaining job details are optional and can be added later.");return;}
  setBusy(true);
  let latitude:null|number=null, longitude:null|number=null;
  try{if(location.trim()&&await Location.hasServicesEnabledAsync()){const perm=await Location.requestForegroundPermissionsAsync();if(perm.status==="granted"){const places=await Location.geocodeAsync(location.trim());if(places[0]){latitude=places[0].latitude;longitude=places[0].longitude;}}}}catch{}
  const {error}=await supabase.rpc("create_service_request",{p_professional_id:professionalId,p_service_id:selection.serviceId,p_sub_service_id:selection.subServiceId||null,p_title:title.trim()||null,p_description:description.trim()||null,p_preferred_date:date||null,p_preferred_time:time.trim()||null,p_location_text:location.trim()||null,p_location_latitude:latitude,p_location_longitude:longitude});
  setBusy(false);
  if(error)Alert.alert("Request failed",error.message);
  else{Alert.alert("Request sent","Your job request has been sent to the professional.");router.back();}
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <VasudhaLogo compact/><Text style={s.title}>Create Job Request</Text><Text style={s.muted}>The professional and service are selected first. Add any work details, timing, or location now if useful; these details are optional.</Text>
  <ServicePicker value={selection} optionalSubService onChange={setSelection}/>
  <Text style={s.label}>What do you need? <Text style={s.optional}>(optional)</Text></Text><TextInput value={title} onChangeText={setTitle} placeholder="e.g. Fix kitchen plumbing" style={s.input}/>
  <Text style={s.label}>Work details <Text style={s.optional}>(optional)</Text></Text><TextInput value={description} onChangeText={setDescription} placeholder="Describe the work required..." multiline style={[s.input,s.large]}/>
  <Text style={s.label}>Preferred date <Text style={s.optional}>(optional)</Text></Text><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={s.input}/>
  <Text style={s.label}>Preferred time <Text style={s.optional}>(optional)</Text></Text><TextInput value={time} onChangeText={setTime} placeholder="e.g. 11:00 AM" style={s.input}/>
  <Text style={s.label}>Service location <Text style={s.optional}>(optional)</Text></Text><TextInput value={location} onChangeText={setLocation} placeholder="Enter the property/service address" style={[s.input,s.large]}/>
  <Text style={s.note}>You can provide the remaining details now or discuss them with the professional after the request.</Text>
  <Pressable onPress={submit} disabled={busy} style={s.primary}><Text style={s.primaryText}>{busy?"Sending...":"Send Job Request"}</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:KAMPRO.background},container:{width:"100%",maxWidth:900,alignSelf:"center",padding:28,paddingBottom:60},title:{fontSize:30,fontWeight:"900",color:KAMPRO.navy,letterSpacing:-.4},muted:{opacity:.65,marginTop:6,lineHeight:20},label:{fontWeight:"800",marginTop:20,marginBottom:7},optional:{fontSize:11,fontWeight:"600",color:"#6B7280"},input:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:14,padding:12,minHeight:48,backgroundColor:"#fff",color:"#10233F"},large:{height:120,textAlignVertical:"top"},note:{fontSize:12,color:"#6B7280",marginTop:10,lineHeight:18},primary:{marginTop:24,borderRadius:12,padding:14,alignItems:"center",backgroundColor:"#FF4B1F",minHeight:50,justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"}});
