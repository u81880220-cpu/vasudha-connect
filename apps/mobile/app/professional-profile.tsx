import {useEffect,useState} from "react";
import {Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Switch,Text,TextInput,View} from "react-native";
import {Link,router} from "expo-router";
import {supabase} from "../src/lib/supabase";
import {useAuth} from "../src/auth/AuthProvider";
import {VasudhaLogo} from "../src/components/VasudhaLogo";
import {AppBottomNav} from "../src/components/AppBottomNav";
import { ServicePicker, ServiceSelection } from "../src/components/ServicePicker";


export default function ProfessionalProfile(){
 const{session}=useAuth();const uid=session?.user.id;
 const[p,setP]=useState<any>({headline:"",about:"",years_experience:"0",service_radius_km:"10",is_available:false,verification_status:"pending"});
 const[serviceSelection,setServiceSelection]=useState<ServiceSelection>({categoryId:null,categoryName:null,serviceId:null,serviceName:null,subServiceId:null,subServiceName:null});
 const[selectedSubServices,setSelectedSubServices]=useState<any[]>([]);
 const[areas,setAreas]=useState<any[]>([]);
 const[phone,setPhone]=useState("");
 const[port,setPort]=useState({title:"",description:"",media_url:""}),[area,setArea]=useState({label:"",city:"",state:"",radius_km:"10"}),[loading,setLoading]=useState(true);
 useEffect(()=>{if(uid)load()},[uid]);
 async function load(){
  setLoading(true);
  const[q,k,c,a,ct,pss]=await Promise.all([
   supabase.from("professional_profiles").select("headline,about,years_experience,service_radius_km,is_available,verification_status").eq("user_id",uid).maybeSingle(),
   supabase.from("service_areas").select("id,label,city,state,radius_km").eq("professional_id",uid).order("created_at"),
   supabase.from("user_contact_details").select("phone").eq("user_id",uid).maybeSingle(),
   supabase.from("professional_sub_services").select("sub_service_id").eq("professional_id",uid)
  ]);
  if(q.data)setP({...q.data,years_experience:String(q.data.years_experience||0),service_radius_km:String(q.data.service_radius_km||10)});
  setPhone(ct.data?.phone||"");setAreas(a.data||[]);
  const ids=(pss.data||[]).map((x:any)=>x.sub_service_id);
  if(ids.length){const{data:catalog}=await supabase.from("service_catalogue_sub_services").select("id,name,service_id,service_catalogue_services(name)").in("id",ids);setSelectedSubServices((catalog||[]).map((x:any)=>({id:x.id,name:x.name,serviceId:x.service_id,serviceName:x.service_catalogue_services?.name||"Service"})));}else setSelectedSubServices([]);
  setLoading(false);
 }
 async function save(){
  const{error}=await supabase.from("professional_profiles").update({headline:p.headline?.trim()||null,about:p.about?.trim()||null,years_experience:Number(p.years_experience)||0,service_radius_km:Number(p.service_radius_km)||10,is_available:p.is_available}).eq("user_id",uid);
  if(error)return Alert.alert("Save failed",error.message);
  const {error:phoneError}=await supabase.from("user_contact_details").upsert({user_id:uid,phone:pPhone(phone),updated_at:new Date().toISOString()});
  if(phoneError)return Alert.alert("Phone save failed",phoneError.message);
  await supabase.from("professional_sub_services").delete().eq("professional_id",uid);
  if(selectedSubServices.length){const{error:serviceError}=await supabase.from("professional_sub_services").insert(selectedSubServices.map((x,i)=>({professional_id:uid,sub_service_id:x.id,years_experience:Number(p.years_experience)||0,is_primary:i===0})));if(serviceError)return Alert.alert("Services save failed",serviceError.message);}
  Alert.alert("Saved","Professional profile updated.");load();
 }
 async function addArea(){
  if(!area.label.trim())return Alert.alert("Service area","Enter an area.");
  const{error}=await supabase.from("service_areas").insert({professional_id:uid,label:area.label.trim(),city:area.city||null,state:area.state||null,radius_km:Number(area.radius_km)||10,is_primary:areas.length===0});
  if(error)Alert.alert("Area",error.message);else{setArea({label:"",city:"",state:"",radius_km:"10"});load()}
 }
 async function addPortfolio(){
  if(!port.title.trim())return Alert.alert("Portfolio","Enter a title.");
  const{error}=await supabase.from("portfolio_items").insert({professional_id:uid,title:port.title.trim(),description:port.description.trim()||null,media_url:port.media_url.trim()||null});
  if(error)Alert.alert("Portfolio",error.message);else{setPort({title:"",description:"",media_url:""});Alert.alert("Added","Portfolio item added.")}
 }
 return <SafeAreaView style={s.safe}>
  <ScrollView contentContainerStyle={s.c} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   <View style={s.top}><Pressable onPress={()=>router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><VasudhaLogo compact/><View style={s.topSpacer}/></View>
   <Text style={s.t}>My Professional Profile</Text><Text style={s.sub}>Build a trusted profile that helps customers choose you.</Text>
   {loading?<Text style={s.muted}>Loading profile…</Text>:null}
   <View style={s.status}><View><Text style={s.statusTitle}>Professional profile</Text><Text style={s.statusSub}>Verification: {p.verification_status||"pending"}</Text></View><View style={[s.dot,{backgroundColor:p.is_available?"#087D65":"#aebbb7"}]}/></View>
   <Text style={s.section}>Profile details</Text><View style={s.card}><Text style={s.l}>Contact phone</Text><TextInput style={s.i} keyboardType="phone-pad" placeholder="+91 98765 43210" value={phone} onChangeText={setPhone}/><Text style={s.helper}>Your phone is shown to a customer only after they unlock your professional profile.</Text></View>
   <View style={s.card}>
    <Text style={s.l}>Professional headline</Text><TextInput style={s.i} placeholder="e.g. Experienced Electrician" value={p.headline||""} onChangeText={v=>setP({...p,headline:v})}/>
    <Text style={s.l}>About your work</Text><TextInput style={[s.i,s.big]} placeholder="Tell customers about your experience and services" value={p.about||""} onChangeText={v=>setP({...p,about:v})} multiline/>
    <View style={s.inline}><View style={s.half}><Text style={s.l}>Experience</Text><TextInput style={s.i} keyboardType="number-pad" value={p.years_experience} onChangeText={v=>setP({...p,years_experience:v})}/></View><View style={s.half}><Text style={s.l}>Service radius</Text><TextInput style={s.i} keyboardType="number-pad" value={p.service_radius_km} onChangeText={v=>setP({...p,service_radius_km:v})}/></View></View>
    <View style={s.av}><View><Text style={s.bold}>Available for new work</Text><Text style={s.muted}>Customers can see your availability.</Text></View><Switch value={!!p.is_available} onValueChange={v=>setP({...p,is_available:v})}/></View>
    <Pressable style={s.p} onPress={save}><Text style={s.pt}>Save profile</Text></Pressable>
   </View>
   <Text style={s.section}>Services you provide</Text>
   <View style={s.card}><Text style={s.helper}>Choose the exact Category → Service → Sub-service combinations you provide. You can add multiple services.</Text><ServicePicker value={serviceSelection} onChange={v=>{setServiceSelection(v);if(v.subServiceId&&!selectedSubServices.some(x=>x.id===v.subServiceId))setSelectedSubServices(z=>[...z,{id:v.subServiceId,name:v.subServiceName||"Sub-service",serviceId:v.serviceId,serviceName:v.serviceName||"Service"}]);}}/><View style={s.selectedList}>{selectedSubServices.length===0?<Text style={s.muted}>No exact services selected yet.</Text>:selectedSubServices.map((x:any,i:number)=><View key={x.id} style={s.selectedService}><View style={{flex:1}}><Text style={s.bold}>{x.serviceName}</Text><Text style={s.muted}>{x.name}{i===0?" · Primary":""}</Text></View><Pressable onPress={()=>setSelectedSubServices(z=>z.filter(y=>y.id!==x.id))}><Text style={s.remove}>Remove</Text></Pressable></View>)}</View></View>
   <Text style={s.section}>Service areas</Text>
   <View style={s.card}>{areas.map(x=><View key={x.id} style={s.list}><View style={{flex:1}}><Text style={s.bold}>{x.label}</Text><Text style={s.muted}>{[x.city,x.state].filter(Boolean).join(", ")} · {x.radius_km} km</Text></View><Pressable onPress={async()=>{await supabase.from("service_areas").delete().eq("id",x.id);load()}}><Text style={s.remove}>Remove</Text></Pressable></View>)}<TextInput style={s.i} placeholder="Area / locality" value={area.label} onChangeText={v=>setArea({...area,label:v})}/><View style={s.inline}><TextInput style={[s.i,s.half]} placeholder="City" value={area.city} onChangeText={v=>setArea({...area,city:v})}/><TextInput style={[s.i,s.half]} placeholder="State" value={area.state} onChangeText={v=>setArea({...area,state:v})}/></View><TextInput style={s.i} placeholder="Radius km" keyboardType="number-pad" value={area.radius_km} onChangeText={v=>setArea({...area,radius_km:v})}/><Pressable style={s.secondary} onPress={addArea}><Text style={s.secondaryText}>+ Add service area</Text></Pressable></View>
   <Text style={s.section}>Portfolio</Text>
   <View style={s.card}><Text style={s.helper}>Show customers examples of your work. New items go through moderation.</Text><TextInput style={s.i} placeholder="Work sample title" value={port.title} onChangeText={v=>setPort({...port,title:v})}/><TextInput style={s.i} placeholder="Description" value={port.description} onChangeText={v=>setPort({...port,description:v})}/><TextInput style={s.i} placeholder="Public image/link (optional)" value={port.media_url} onChangeText={v=>setPort({...port,media_url:v})}/><Pressable style={s.secondary} onPress={addPortfolio}><Text style={s.secondaryText}>+ Add portfolio item</Text></Pressable></View>
   <Text style={s.section}>Verification</Text>
   <View style={s.card}><View style={s.verifyRow}><View style={s.verifyIcon}><Text>✓</Text></View><View style={{flex:1}}><Text style={s.bold}>Identity verification</Text><Text style={s.muted}>Status: {p.verification_status||"pending"}</Text></View></View><Link href="/professional-verification" asChild><Pressable style={s.p}><Text style={s.pt}>Open verification</Text></Pressable></Link></View>
  </ScrollView>
  <AppBottomNav active="profile"/>
 </SafeAreaView>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#fff"},topSpacer:{width:40},c:{padding:18,paddingBottom:104},top:{height:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},back:{width:40,height:40,borderRadius:20,backgroundColor:"#f2f7f5",alignItems:"center",justifyContent:"center"},backText:{fontSize:30,color:"#13201c",marginTop:-3},more:{fontSize:26,color:"#087D65"},t:{fontSize:28,fontWeight:"900",color:"#13201c",marginTop:18},sub:{color:"#66736e",lineHeight:20,marginTop:6},muted:{fontSize:12,color:"#66736e",marginTop:3},status:{marginTop:18,borderWidth:1,borderColor:"#bcd9d0",borderRadius:16,padding:14,backgroundColor:"#f2f8f6",flexDirection:"row",justifyContent:"space-between",alignItems:"center"},statusTitle:{fontWeight:"900",fontSize:16,color:"#13201c"},statusSub:{fontSize:12,color:"#66736e",marginTop:3},dot:{width:12,height:12,borderRadius:6},section:{fontSize:18,fontWeight:"900",color:"#13201c",marginTop:24,marginBottom:4},card:{borderWidth:1,borderColor:"#e0e8e5",borderRadius:16,padding:14,backgroundColor:"#fff",marginTop:8},l:{fontWeight:"800",color:"#46534f",marginTop:7},i:{borderWidth:1,borderColor:"#cfdad6",borderRadius:12,padding:12,marginTop:7,minHeight:48,backgroundColor:"#fff",color:"#13201c"},big:{minHeight:100,textAlignVertical:"top"},inline:{flexDirection:"row",gap:9},half:{flex:1},av:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:16,paddingTop:14,borderTopWidth:1,borderTopColor:"#edf1ef"},bold:{fontWeight:"800",color:"#13201c"},p:{marginTop:14,backgroundColor:"#087D65",padding:14,borderRadius:12,alignItems:"center",justifyContent:"center",minHeight:50},pt:{color:"#fff",fontWeight:"900"},helper:{fontSize:12,color:"#66736e",lineHeight:18},wrap:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:12},chip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:17,paddingHorizontal:11,paddingVertical:9,backgroundColor:"#fff"},on:{borderWidth:2,borderColor:"#087D65",backgroundColor:"#e7f7f2"},chipText:{fontSize:12,fontWeight:"700",color:"#46534f"},chipOn:{color:"#087D65"},list:{flexDirection:"row",paddingVertical:11,borderBottomWidth:1,borderBottomColor:"#edf1ef",gap:8},remove:{color:"#b14a43",fontWeight:"700"},secondary:{marginTop:10,borderWidth:1,borderColor:"#087D65",borderRadius:12,padding:12,alignItems:"center"},secondaryText:{color:"#087D65",fontWeight:"900"},verifyRow:{flexDirection:"row",alignItems:"center",gap:10},verifyIcon:{width:38,height:38,borderRadius:19,backgroundColor:"#e7f7f2",alignItems:"center",justifyContent:"center"}});

function pPhone(value:string){return value.trim()||null}
