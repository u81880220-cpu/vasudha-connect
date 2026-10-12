import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export type ServiceSelection = {
  categoryId: string | null;
  categoryName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  legacySkillId?: string | null;
  subServiceId: string | null;
  subServiceName: string | null;
};

type Category={id:string;name:string;icon?:string|null};
type Service={id:string;category_id:string;name:string;icon?:string|null;legacy_skill_id:string|null};
type SubService={id:string;service_id:string;name:string};

export function ServicePicker({value,onChange,title="Choose a service",optionalSubService=false,requestService=false}:{value?:Partial<ServiceSelection>;onChange:(value:ServiceSelection)=>void;title?:string;optionalSubService?:boolean;requestService?:boolean}){
 const[categories,setCategories]=useState<Category[]>([]),[services,setServices]=useState<Service[]>([]),[subs,setSubs]=useState<SubService[]>([]);
 const[categoryId,setCategoryId]=useState(value?.categoryId||null),[serviceId,setServiceId]=useState(value?.serviceId||null),[subId,setSubId]=useState(value?.subServiceId||null);
 const[loading,setLoading]=useState(true);\n const[requestOpen,setRequestOpen]=useState(false),[requestCategory,setRequestCategory]=useState(""),[requestServiceName,setRequestServiceName]=useState(""),[requestSubService,setRequestSubService]=useState(""),[requestDescription,setRequestDescription]=useState(""),[requestBusy,setRequestBusy]=useState(false),[myRequests,setMyRequests]=useState<any[]>([]);
 useEffect(()=>{load();if(requestService)loadMyRequests();},[]);\n async function loadMyRequests(){const{data,error}=await supabase.from("professional_service_requests").select("id,category_name,service_name,sub_service_name,status,admin_note,created_at").order("created_at",{ascending:false}).limit(5);if(!error)setMyRequests(data||[]);}\n async function submitServiceRequest(){\n  if(!requestCategory.trim()||!requestServiceName.trim())return Alert.alert("Missing details","Enter the category and service name.");\n  setRequestBusy(true);try{const{data:userData}=await supabase.auth.getUser();if(!userData.user)throw new Error("Please sign in again.");\n   const{error}=await supabase.from("professional_service_requests").insert({professional_id:userData.user.id,category_name:requestCategory.trim(),service_name:requestServiceName.trim(),sub_service_name:requestSubService.trim()||null,description:requestDescription.trim()||null});if(error)throw error;\n   setRequestCategory("");setRequestServiceName("");setRequestSubService("");setRequestDescription("");setRequestOpen(false);await loadMyRequests();Alert.alert("Request submitted","Your new service request has been sent to KAMPRO admin for approval. It will appear in your service options after approval.");\n  }catch(e){Alert.alert("Could not submit request",e instanceof Error?e.message:"Please try again.");}finally{setRequestBusy(false);}\n }
 async function load(){
  setLoading(true);
  const[a,b,c]=await Promise.all([
   supabase.from("service_categories").select("id,name,icon").eq("status","active").order("sort_order").order("name"),
   supabase.from("service_catalogue_services").select("id,category_id,name,icon,legacy_skill_id").eq("status","active").order("sort_order").order("name"),
   supabase.from("service_catalogue_sub_services").select("id,service_id,name").eq("status","active").order("sort_order").order("name")
  ]);
  setCategories(a.data||[]);setServices(b.data||[]);setSubs(c.data||[]);setLoading(false);
 }
 const currentServices=services.filter(x=>x.category_id===categoryId);
 const currentSubs=subs.filter(x=>x.service_id===serviceId);
 const category=categories.find(x=>x.id===categoryId),service=services.find(x=>x.id===serviceId),sub=currentSubs.find(x=>x.id===subId);

 function chooseCategory(id:string){
  setCategoryId(id);setServiceId(null);setSubId(null);
  const cat=categories.find(x=>x.id===id);
  onChange({categoryId:id,categoryName:cat?.name||null,serviceId:null,serviceName:null,legacySkillId:null,subServiceId:null,subServiceName:null});
 }

 function chooseService(id:string){
  setServiceId(id);
  const svc=services.find(x=>x.id===id);
  const cat=categories.find(x=>x.id===svc?.category_id);
  if(svc){
   // A sub-service is optional on job requests. Do not silently select
   // "General / Any" because the professional may not offer that sub-service.
   // The selected service alone is sufficient to submit the request.
   setSubId(null);
   onChange({categoryId:cat?.id||null,categoryName:cat?.name||null,serviceId:svc.id,serviceName:svc.name,legacySkillId:svc.legacy_skill_id||null,subServiceId:null,subServiceName:null});
  }
 }

 function currentSubsFor(id:string){return subs.filter(x=>x.service_id===id);}

 function chooseSub(id:string){
  setSubId(id);
  const selected=subs.find(x=>x.id===id);
  if(!selected)return;
  const svc=services.find(x=>x.id===selected.service_id);
  const cat=categories.find(x=>x.id===svc?.category_id);
  onChange({categoryId:cat?.id||null,categoryName:cat?.name||null,serviceId:svc?.id||null,serviceName:svc?.name||null,legacySkillId:svc?.legacy_skill_id||null,subServiceId:selected.id,subServiceName:selected.name});
 }

 function chooseGeneral(){
  const svc=services.find(x=>x.id===serviceId);
  const cat=categories.find(x=>x.id===svc?.category_id);
  const general=currentSubs.find(x=>x.name.toLowerCase()==="general / any");
  if(!svc||!general)return;
  setSubId(general.id);
  onChange({categoryId:cat?.id||null,categoryName:cat?.name||null,serviceId:svc.id,serviceName:svc.name,legacySkillId:svc.legacy_skill_id||null,subServiceId:general.id,subServiceName:"General service"});
 }

 if(loading)return <View style={s.loading}><ActivityIndicator color="#FF4B1F"/><Text style={s.muted}>Loading services…</Text></View>;

 return <View style={s.wrap}>
  <Text style={s.title}>{title}</Text>
  <Text style={s.step}>1. Category</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{categories.map(x=><Pressable key={x.id} onPress={()=>chooseCategory(x.id)} style={[s.chip,categoryId===x.id&&s.on]}><Text style={[s.chipText,categoryId===x.id&&s.onText]}>{x.name}</Text></Pressable>)}</ScrollView>
  {categoryId?<><Text style={s.step}>2. Service</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{currentServices.map(x=><Pressable key={x.id} onPress={()=>chooseService(x.id)} style={[s.chip,serviceId===x.id&&s.on]}><Text style={[s.chipText,serviceId===x.id&&s.onText]}>{x.name}</Text></Pressable>)}</ScrollView></>:null}
  {serviceId?<><Text style={s.step}>3. Sub-service {optionalSubService?"(optional)":""}</Text><View style={s.subGrid}>{optionalSubService?<Pressable onPress={chooseGeneral} style={[s.subChip,sub?.name.toLowerCase()==="general / any"&&s.on]}><Text style={[s.chipText,sub?.name.toLowerCase()==="general / any"&&s.onText]}>General service</Text></Pressable>:null}{currentSubs.map(x=><Pressable key={x.id} onPress={()=>chooseSub(x.id)} style={[s.subChip,subId===x.id&&s.on]}><Text style={[s.chipText,subId===x.id&&s.onText]}>{x.name}</Text></Pressable>)}</View></>:null}
  {sub?<View style={s.selected}><Text style={s.selectedLabel}>Selected</Text><Text style={s.selectedText}>{category?.name} › {service?.name} › {sub.name==="General / Any"?"General service":sub.name}</Text></View>:null}
 </View>;
}

const s=StyleSheet.create({wrap:{borderWidth:1,borderColor:"#e0e8e5",borderRadius:16,padding:14,backgroundColor:"#fff"},loading:{padding:18,alignItems:"center"},muted:{color:"#6B7280",marginTop:6},title:{fontSize:17,fontWeight:"900",color:"#10233F"},step:{fontSize:12,fontWeight:"900",color:"#6B7280",marginTop:14,marginBottom:7,textTransform:"uppercase",letterSpacing:.5},row:{gap:7,paddingBottom:2},chip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:18,paddingHorizontal:12,paddingVertical:9,backgroundColor:"#fff"},on:{backgroundColor:"#FFF0EA",borderColor:"#FF4B1F",borderWidth:2},chipText:{fontSize:12,fontWeight:"700",color:"#46534f"},onText:{color:"#FF4B1F"},subGrid:{flexDirection:"row",flexWrap:"wrap",gap:7},subChip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:14,paddingHorizontal:11,paddingVertical:9},selected:{marginTop:12,padding:11,borderRadius:12,backgroundColor:"#f2f8f6"},selectedLabel:{fontSize:10,fontWeight:"900",color:"#FF4B1F",textTransform:"uppercase"},selectedText:{fontWeight:"800",color:"#10233F",marginTop:3},requestBox:{marginTop:16,padding:12,borderRadius:12,borderWidth:1,borderColor:"#ffd1c4",backgroundColor:"#fff8f5"},requestTitle:{fontSize:14,fontWeight:"900",color:"#10233F"},requestButton:{alignItems:"center",justifyContent:"center",padding:11,borderRadius:10,backgroundColor:"#FF4B1F",marginTop:8},requestButtonText:{fontWeight:"900",color:"#fff"},requestInput:{borderWidth:1,borderColor:"#cfdad6",borderRadius:10,paddingHorizontal:11,paddingVertical:10,color:"#10233F",backgroundColor:"#fff"},requestItem:{padding:9,borderRadius:8,backgroundColor:"#fff",borderWidth:1,borderColor:"#e0e8e5}});
