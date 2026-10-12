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

export function ServicePicker({value,onChange,title="Choose a service",optionalSubService=false,requestService=false,searchQuery=""}:{value?:Partial<ServiceSelection>;onChange:(value:ServiceSelection)=>void;title?:string;optionalSubService?:boolean;requestService?:boolean;searchQuery?:string}){
 const[categories,setCategories]=useState<Category[]>([]),[services,setServices]=useState<Service[]>([]),[subs,setSubs]=useState<SubService[]>([]);
 const[categoryId,setCategoryId]=useState(value?.categoryId||null),[serviceId,setServiceId]=useState(value?.serviceId||null),[subId,setSubId]=useState(value?.subServiceId||null);
 const[loading,setLoading]=useState(true);
 const[requestOpen,setRequestOpen]=useState(false),[requestCategory,setRequestCategory]=useState(""),[requestServiceName,setRequestServiceName]=useState(""),[requestSubService,setRequestSubService]=useState(""),[requestDescription,setRequestDescription]=useState(""),[requestBusy,setRequestBusy]=useState(false),[myRequests,setMyRequests]=useState<any[]>([]);
 useEffect(()=>{load();if(requestService)loadMyRequests();},[]);
 async function loadMyRequests(){const{data,error}=await supabase.from("professional_service_requests").select("id,category_name,service_name,sub_service_name,status,admin_note,created_at").order("created_at",{ascending:false}).limit(5);if(!error)setMyRequests(data||[]);}
 async function submitServiceRequest(){
  if(!requestCategory.trim()||!requestServiceName.trim())return Alert.alert("Missing details","Enter the category and service name.");
  setRequestBusy(true);try{const{data:userData}=await supabase.auth.getUser();if(!userData.user)throw new Error("Please sign in again.");
   const{error}=await supabase.from("professional_service_requests").insert({professional_id:userData.user.id,category_name:requestCategory.trim(),service_name:requestServiceName.trim(),sub_service_name:requestSubService.trim()||null,description:requestDescription.trim()||null});if(error)throw error;
   setRequestCategory("");setRequestServiceName("");setRequestSubService("");setRequestDescription("");setRequestOpen(false);await loadMyRequests();Alert.alert("Request submitted","Your new service request has been sent to KAMPRO admin for approval. It will appear in your service options after approval.");
  }catch(e){Alert.alert("Could not submit request",e instanceof Error?e.message:"Please try again.");}finally{setRequestBusy(false);}
 }
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
 const q=searchQuery.trim().toLowerCase();
 const searchAliases:Record<string,string[]>={
  carpenter:["carpentry","woodworker","wood work","furniture repair","door repair","wooden door","cabinet","wardrobe","almirah","लकड़ी","बढ़ई","बढ़ईगीरी"],
  plumber:["plumbing","pipe repair","water tap","leakage","bathroom fitting","नल","प्लंबर","पानी की पाइप"],
  electrician:["electrical","wiring","fan repair","switch repair","light fitting","मीटर","बिजली","इलेक्ट्रीशियन"],
  painter:["painting","wall paint","whitewash","putty","दीवार पेंट","पेंटर"],
  cleaner:["cleaning","house cleaning","deep cleaning","सफai","सफाई"],
  ac:["air conditioner","air conditioning","ac repair","cooling","एसी रिपेयर"],
  mechanic:["vehicle repair","bike repair","car repair","मिस्त्री"],
  driver:["chauffeur","car driver","personal driver","ड्राइवर"],
  beautician:["beauty parlour","salon","makeup artist","hair styling","ब्यूटी पार्लर"],
  tutor:["teacher","tuition","home tutor","coaching","ट्यूशन"],
  appliance:["washing machine repair","refrigerator repair","fridge repair","microwave repair","घरेलू उपकरण"],
  pest:["pest control","termite","cockroach","दीमक"],
  solar:["solar panel","solar installation","solar repair","सोलर पैनल"]
 };
 const termsFor=(name:string)=>{const n=name.toLowerCase();const terms=[n];for(const [key,aliases] of Object.entries(searchAliases)){if(n.includes(key)||key.includes(n)||aliases.some(a=>a===n||n.includes(a)||a.includes(n))){terms.push(key,...aliases);}}return terms;};
 const matchesQuery=(name:string)=>termsFor(name).some(term=>term.includes(q)||q.includes(term));
 const serviceMatches=q.length>=2?services.flatMap(svc=>{const cat=categories.find(c=>c.id===svc.category_id);const matchedSubs=subs.filter(sub=>sub.service_id===svc.id&&matchesQuery(sub.name));const serviceMatch=matchesQuery(svc.name)||Boolean(cat&&matchesQuery(cat.name));if(serviceMatch)return [{key:"svc-"+svc.id,category:cat,service:svc,sub:null,label:svc.name,detail:(cat?.name||"Service")+" · Category/service match"}];return matchedSubs.map(sub=>({key:"sub-"+sub.id,category:cat,service:svc,sub,label:sub.name,detail:svc.name+" · "+(cat?.name||"")}));}).slice(0,8):[];
 function chooseSearchMatch(match:any){if(!match.service||!match.category)return;setCategoryId(match.category.id);setServiceId(match.service.id);setSubId(match.sub?.id||null);onChange({categoryId:match.category.id,categoryName:match.category.name,serviceId:match.service.id,serviceName:match.service.name,legacySkillId:match.service.legacy_skill_id||null,subServiceId:match.sub?.id||null,subServiceName:match.sub?.name||null});}

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
  {q.length>=2?<View style={s.searchMatches}><Text style={s.searchMatchesTitle}>Matching services</Text>{serviceMatches.length?serviceMatches.map(match=><Pressable key={match.key} onPress={()=>chooseSearchMatch(match)} style={s.searchMatch}><View style={{flex:1}}><Text style={s.searchMatchName}>{match.label}</Text><Text style={s.searchMatchDetail}>{match.detail}</Text></View><Text style={s.searchMatchAction}>Select</Text></Pressable>):<Text style={s.muted}>No matching service in the catalogue yet.</Text>}</View>:null}
  <Text style={s.step}>1. Category</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{categories.map(x=><Pressable key={x.id} onPress={()=>chooseCategory(x.id)} style={[s.chip,categoryId===x.id&&s.on]}><Text style={[s.chipText,categoryId===x.id&&s.onText]}>{x.name}</Text></Pressable>)}</ScrollView>
  {categoryId?<><Text style={s.step}>2. Service</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>{currentServices.map(x=><Pressable key={x.id} onPress={()=>chooseService(x.id)} style={[s.chip,serviceId===x.id&&s.on]}><Text style={[s.chipText,serviceId===x.id&&s.onText]}>{x.name}</Text></Pressable>)}</ScrollView></>:null}
  {serviceId?<><Text style={s.step}>3. Sub-service {optionalSubService?"(optional)":""}</Text><View style={s.subGrid}>{optionalSubService?<Pressable onPress={chooseGeneral} style={[s.subChip,sub?.name.toLowerCase()==="general / any"&&s.on]}><Text style={[s.chipText,sub?.name.toLowerCase()==="general / any"&&s.onText]}>General service</Text></Pressable>:null}{currentSubs.map(x=><Pressable key={x.id} onPress={()=>chooseSub(x.id)} style={[s.subChip,subId===x.id&&s.on]}><Text style={[s.chipText,subId===x.id&&s.onText]}>{x.name}</Text></Pressable>)}</View></>:null}
  {sub?<View style={s.selected}><Text style={s.selectedLabel}>Selected</Text><Text style={s.selectedText}>{category?.name} › {service?.name} › {sub.name==="General / Any"?"General service":sub.name}</Text></View>:null}
  {requestService?<View style={s.requestBox}>
   <Text style={s.requestTitle}>Can’t find your profession or service?</Text>
   <Text style={s.muted}>Request a new category or service. It will appear in the catalogue only after KAMPRO admin approves it.</Text>
   <Pressable accessibilityRole="button" style={s.requestButton} onPress={()=>setRequestOpen(v=>!v)}><Text style={s.requestButtonText}>{requestOpen?"Close request form":"+ Request missing service"}</Text></Pressable>
   {requestOpen?<View style={{gap:8,marginTop:10}}>
    <TextInput value={requestCategory} onChangeText={setRequestCategory} placeholder="Profession / category (e.g. Home Repair)" placeholderTextColor="#8B93A1" style={s.requestInput} maxLength={80}/>
    <TextInput value={requestServiceName} onChangeText={setRequestServiceName} placeholder="Service name (e.g. Solar Panel Installer)" placeholderTextColor="#8B93A1" style={s.requestInput} maxLength={100}/>
    <TextInput value={requestSubService} onChangeText={setRequestSubService} placeholder="Sub-service (optional)" placeholderTextColor="#8B93A1" style={s.requestInput} maxLength={100}/>
    <TextInput value={requestDescription} onChangeText={setRequestDescription} placeholder="Details for admin (optional)" placeholderTextColor="#8B93A1" style={[s.requestInput,{minHeight:72,textAlignVertical:"top"}]} multiline maxLength={500}/>
    <Pressable accessibilityRole="button" disabled={requestBusy} style={[s.requestButton,requestBusy&&{opacity:0.6}]} onPress={submitServiceRequest}><Text style={s.requestButtonText}>{requestBusy?"Submitting…":"Submit for admin approval"}</Text></Pressable>
   </View>:null}
   {myRequests.length>0?<View style={{gap:6,marginTop:12}}><Text style={s.requestTitle}>Your recent requests</Text>{myRequests.map((r:any)=><View key={r.id} style={s.requestItem}><Text style={s.chipText}>{r.service_name}{r.sub_service_name?" · "+r.sub_service_name:""}</Text><Text style={s.muted}>{r.category_name} · {r.status.toUpperCase()}</Text>{r.admin_note?<Text style={s.muted}>Admin note: {r.admin_note}</Text>:null}</View>)}</View>:null}
  </View>:null}
 </View>;
}

const s=StyleSheet.create({wrap:{borderWidth:1,borderColor:"#e0e8e5",borderRadius:16,padding:14,backgroundColor:"#fff"},loading:{padding:18,alignItems:"center"},muted:{color:"#6B7280",marginTop:6},title:{fontSize:17,fontWeight:"900",color:"#10233F"},step:{fontSize:12,fontWeight:"900",color:"#6B7280",marginTop:14,marginBottom:7,textTransform:"uppercase",letterSpacing:.5},row:{gap:7,paddingBottom:2},chip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:18,paddingHorizontal:12,paddingVertical:9,backgroundColor:"#fff"},on:{backgroundColor:"#FFF0EA",borderColor:"#FF4B1F",borderWidth:2},chipText:{fontSize:12,fontWeight:"700",color:"#46534f"},onText:{color:"#FF4B1F"},subGrid:{flexDirection:"row",flexWrap:"wrap",gap:7},subChip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:14,paddingHorizontal:11,paddingVertical:9},selected:{marginTop:12,padding:11,borderRadius:12,backgroundColor:"#f2f8f6"},selectedLabel:{fontSize:10,fontWeight:"900",color:"#FF4B1F",textTransform:"uppercase"},selectedText:{fontWeight:"800",color:"#10233F",marginTop:3},requestBox:{marginTop:16,padding:12,borderRadius:12,borderWidth:1,borderColor:"#ffd1c4",backgroundColor:"#fff8f5"},requestTitle:{fontSize:14,fontWeight:"900",color:"#10233F"},requestButton:{alignItems:"center",justifyContent:"center",padding:11,borderRadius:10,backgroundColor:"#FF4B1F",marginTop:8},requestButtonText:{fontWeight:"900",color:"#fff"},requestInput:{borderWidth:1,borderColor:"#cfdad6",borderRadius:10,paddingHorizontal:11,paddingVertical:10,color:"#10233F",backgroundColor:"#fff"},requestItem:{padding:9,borderRadius:8,backgroundColor:"#fff",borderWidth:1,borderColor:"#e0e8e5"}});
