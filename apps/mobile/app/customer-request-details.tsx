import {useEffect,useState} from "react";
import {ActivityIndicator,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View,Alert} from "react-native";
import {router,useLocalSearchParams} from "expo-router";
import {useAuth} from "../src/auth/AuthProvider";
import {supabase} from "../src/lib/supabase";
import {VasudhaLogo} from "../src/components/VasudhaLogo";

export default function CustomerRequestDetails(){
 const params=useLocalSearchParams<{requestId?:string|string[]}>();
 const requestId=Array.isArray(params.requestId)?params.requestId[0]:params.requestId;
 const {user}=useAuth();
 const [request,setRequest]=useState<any>(null);
 const [professional,setProfessional]=useState<any>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;(async()=>{
  if(!requestId||!user?.id){setError("This request could not be identified.");setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const {data:r,error:rqError}=await supabase.from("service_requests").select("*").eq("id",requestId).eq("customer_id",user.id).maybeSingle();
   if(rqError)throw rqError;
   if(!r){setRequest(null);setError("This request was not found in your customer account.");return;}
   setRequest(r);
   if(r.professional_id){
    const [{data:p,error:pError},{data:pp,error:ppError}]=await Promise.all([
     supabase.from("profiles").select("full_name,display_name,avatar_url").eq("id",r.professional_id).maybeSingle(),
     supabase.from("professional_profiles").select("headline,verification_status,is_available").eq("user_id",r.professional_id).maybeSingle()
    ]);
    if(pError)console.warn("KAMPRO professional profile unavailable:",pError.message);
    if(ppError)console.warn("KAMPRO professional details unavailable:",ppError.message);
    if(active)setProfessional({...p,...pp});
   }
  }catch(e:any){if(active)setError(e?.message||"Unable to load this job request.");}
  finally{if(active)setLoading(false);}
 })();return()=>{active=false}},[requestId,user?.id]);
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <View style={s.top}><Pressable onPress={()=>router.replace("/home")}><Text style={s.back}>‹ Home</Text></Pressable><VasudhaLogo compact/></View>
  <Text style={s.title}>Your Job Request</Text>
  <Text style={s.sub}>Customer request details and selected professional</Text>
  {loading?<View style={s.state}><ActivityIndicator color="#FF4B1F"/><Text style={s.muted}>Loading your request…</Text></View>:error?<View style={s.card}><Text style={s.error}>{error}</Text><Pressable onPress={()=>router.replace("/jobs")} style={s.button}><Text style={s.buttonText}>Open My Jobs</Text></Pressable></View>:request?<>
   <View style={s.card}>
    <Text style={s.section}>Request status</Text><Text style={s.status}>{String(request.status||"requested").replaceAll("_"," ").toUpperCase()}</Text>
    <Text style={s.label}>Service</Text><Text style={s.value}>{request.service_name||request.title||"Professional service"}</Text>
    {request.sub_service_name?<><Text style={s.label}>Sub-service</Text><Text style={s.value}>{request.sub_service_name}</Text></>:null}
    {request.title?<><Text style={s.label}>What you need</Text><Text style={s.value}>{request.title}</Text></>:null}
    {request.description?<><Text style={s.label}>Work details</Text><Text style={s.value}>{request.description}</Text></>:null}
    {request.preferred_date||request.preferred_time?<><Text style={s.label}>Preferred schedule</Text><Text style={s.value}>{[request.preferred_date,request.preferred_time].filter(Boolean).join(" · ")}</Text></>:null}
    <Text style={s.label}>Service location</Text><Text style={s.value}>{request.location_text||"Not provided"}</Text>
    <Text style={s.label}>Created</Text><Text style={s.value}>{request.created_at?new Date(request.created_at).toLocaleString():"—"}</Text>
   </View>
   <View style={s.card}>
    <Text style={s.section}>Selected professional</Text>
    <Text style={s.value}>{professional?.display_name||professional?.full_name||"Professional"}</Text>
    {professional?.headline?<Text style={s.muted}>{professional.headline}</Text>:null}
    <Text style={s.muted}>Verification: {professional?.verification_status||"Not available"}</Text>
    {request.professional_id?<Pressable onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:request.professional_id}})} style={s.button}><Text style={s.buttonText}>View Professional Profile</Text></Pressable>:<Text style={s.muted}>A professional has not been assigned yet.</Text>}
   </View>
   <Text style={s.foot}>This is your customer-side request. The professional dashboard is separate.</Text>
  </>:null}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#F7F8FA"},container:{padding:20,paddingBottom:48,maxWidth:760,width:"100%",alignSelf:"center"},top:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",minHeight:54},back:{fontSize:16,fontWeight:"800",color:"#FF4B1F"},title:{fontSize:28,fontWeight:"900",color:"#10233F",marginTop:18},sub:{fontSize:14,color:"#667085",marginTop:5},card:{backgroundColor:"#fff",borderRadius:18,borderWidth:1,borderColor:"#E4E7EC",padding:18,marginTop:18},section:{fontSize:19,fontWeight:"900",color:"#10233F",marginBottom:10},label:{fontSize:12,fontWeight:"800",color:"#667085",marginTop:16,textTransform:"uppercase"},value:{fontSize:16,fontWeight:"700",color:"#10233F",marginTop:5,lineHeight:23},status:{alignSelf:"flex-start",backgroundColor:"#FFF0EA",color:"#B93815",fontWeight:"900",paddingHorizontal:12,paddingVertical:7,borderRadius:18,overflow:"hidden"},muted:{fontSize:14,color:"#667085",marginTop:8,lineHeight:20},state:{padding:32,alignItems:"center"},error:{color:"#B42318",fontSize:15,lineHeight:22},button:{marginTop:16,backgroundColor:"#FF4B1F",padding:14,borderRadius:12,alignItems:"center"},buttonText:{color:"#fff",fontWeight:"900"},foot:{fontSize:12,color:"#667085",textAlign:"center",marginTop:18}});
