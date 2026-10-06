import {Link,router} from "expo-router";
import {Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View,ActivityIndicator} from "react-native";
import {useEffect,useState} from "react";
import {useAuth} from "../src/auth/AuthProvider";
import {VasudhaLogo} from "../src/components/VasudhaLogo";
import {AppBottomNav} from "../src/components/AppBottomNav";
import {ServiceIcon} from "../src/components/ServiceIcon";
import {supabase} from "../src/lib/supabase";
import {registerForPushNotifications,registerNotificationTapHandler} from "../src/lib/pushNotifications";

const services=["Electrician","Plumber","Carpenter","Painter","AC Technician"];

export default function HomeScreen(){
 const{session,loading,mode,setMode,signOut}=useAuth();
 const[switching,setSwitching]=useState(false);
 const[checkingOnboarding,setCheckingOnboarding]=useState(true);
 useEffect(()=>{if(!loading&&!session)router.replace("/auth")},[loading,session]);
 useEffect(()=>{
  if(loading||!session)return;
  let active=true;
  (async()=>{
   const{data:profile}=await supabase.from("profiles").select("full_name").eq("id",session.user.id).maybeSingle();
   if(!active)return;
   if(!profile?.full_name?.trim()){router.replace("/basic-profile");return;}
   if(mode==="professional"){
    const[{data:pp},{data:ss},{data:area}]=await Promise.all([
     supabase.from("professional_profiles").select("headline,about").eq("user_id",session.user.id).maybeSingle(),
     supabase.from("professional_sub_services").select("sub_service_id").eq("professional_id",session.user.id).limit(1),
     supabase.from("service_areas").select("id").eq("professional_id",session.user.id).limit(1)
    ]);
    if(!pp?.headline?.trim()||!pp?.about?.trim()||!ss?.length||!area?.length){router.replace("/professional-onboarding");return;}
   }
   setCheckingOnboarding(false);
  })();
  return()=>{active=false};
 },[loading,session?.user.id,mode]);
 useEffect(()=>{if(!session)return; void registerForPushNotifications(session.user.id); const sub=registerNotificationTapHandler(); return()=>sub.remove()},[session?.user.id]);
 if(loading||!session||checkingOnboarding)return <SafeAreaView style={s.safe}><View style={s.loading}><ActivityIndicator color="#087D65"/><Text style={s.muted}>Loading…</Text></View></SafeAreaView>;
 const customer=mode==="customer";
 async function toggleMode(){
  if(switching)return;
  setSwitching(true);
  try{await setMode(customer?"professional":"customer")}
  catch(e:any){Alert.alert("Could not switch mode",e?.message||"Please try again.")}
  finally{setSwitching(false)}
 }
 async function logout(){
  try{await signOut();router.replace("/auth")}
  catch(e:any){Alert.alert("Sign out failed",e?.message||"Please try again.")}
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <View style={s.top}><VasudhaLogo/><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={()=>router.push("/notifications")} style={s.bell}><Text style={s.bellText}>🔔</Text></Pressable></View>
  {customer?<CustomerHome/>:<ProfessionalHome/>}
  <Pressable accessibilityRole="button" disabled={switching} onPress={toggleMode} style={[s.switch,switching&&s.disabled]}><Text style={s.switchText}>{switching?"Switching…":customer?"Switch to Professional mode":"Switch to Customer mode"}</Text><Text style={s.arrow}>›</Text></Pressable>
  <Pressable accessibilityRole="button" onPress={logout} style={s.signout}><Text>Sign out</Text></Pressable>
 </ScrollView><AppBottomNav/></SafeAreaView>
}

function CustomerHome(){
 return <View>
  <Text style={s.greeting}>Good morning 👋</Text>
  <Text style={s.heading}>Find trusted professionals</Text><Text style={s.heading}>around you.</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Search for services" onPress={()=>router.push("/marketplace")} style={s.search}><Text style={s.searchIcon}>⌕</Text><Text style={s.searchText}>Search for services...</Text></Pressable>
  <Text style={s.section}>Popular services</Text>
  <View style={s.services}>{services.map(x=><Link key={x} href="/marketplace" asChild><Pressable style={s.service}><ServiceIcon name={x} size={52}/><Text style={s.serviceText}>{x}</Text></Pressable></Link>)}</View>
  <Link href="/marketplace" asChild><Pressable style={s.hero}><Text style={s.heroTitle}>Your Property. Our Care.</Text><Text style={s.heroSub}>Verified professionals at your doorstep.</Text><Text style={s.heroAction}>Find professionals →</Text></Pressable></Link>
  <Text style={s.section}>Your service activity</Text>
  <Link href="/customer-dashboard" asChild><Pressable style={s.nearby}><View style={s.avatar}><Text>✓</Text></View><View style={{flex:1}}><Text style={s.name}>Requests, jobs & connections</Text><Text style={s.meta}>Track your active work and conversations</Text></View><Text style={s.view}>Open</Text></Pressable></Link>
 </View>
}
function ProfessionalHome(){
 const{session}=useAuth();
 const[stats,setStats]=useState({trust:0,verified:false,available:false,requests:0,jobs:0});
 useEffect(()=>{
  if(!session?.user.id)return;
  let active=true;
  (async()=>{
   const[{data:profile},{data:requests},{data:jobs}]=await Promise.all([
    supabase.from("professional_profiles").select("trust_score,verification_status,is_available").eq("user_id",session.user.id).maybeSingle(),
    supabase.rpc("get_professional_requests"),
    supabase.from("jobs").select("id,status").eq("professional_id",session.user.id).in("status",["quote_accepted","worker_accepted","on_the_way","arrived","work_started"]).limit(50)
   ]);
   if(active)setStats({
    trust:Number(profile?.trust_score||0),
    verified:profile?.verification_status==="verified",
    available:!!profile?.is_available,
    requests:(requests||[]).filter((x:any)=>x.status==="requested").length,
    jobs:(jobs||[]).length
   });
  })();
  return()=>{active=false};
 },[session?.user.id]);
 return <View>
  <Text style={s.greeting}>Welcome back 👋</Text>
  <Text style={s.heading}>Grow your business.</Text><Text style={s.heading}>Get more customers.</Text>
  <View style={s.statHero}><Text style={s.statLabel}>Professional Trust</Text><Text style={s.statValue}>{Math.round(stats.trust)} <Text style={s.statSmall}>/ 100</Text></Text><Text style={s.meta}>{stats.verified?"✓ Verified":"Verification pending"} • {stats.available?"Available for jobs":"Unavailable for jobs"}</Text></View>
  <View style={s.grid}><Link href="/professional-dashboard" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>{stats.requests}</Text><Text>New requests</Text></Pressable></Link><Link href="/jobs" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>{stats.jobs}</Text><Text>Active jobs</Text></Pressable></Link></View>
  <Link href="/professional-profile" asChild><Pressable style={s.primary}><Text style={s.primaryText}>Manage professional profile</Text></Pressable></Link>
  <Text style={s.section}>Quick actions</Text>
  <View style={s.grid}><Link href="/professional-verification" asChild><Pressable style={s.action}><Text style={s.actionIcon}>✓</Text><Text>Verification</Text></Pressable></Link><Link href="/professional-profile" asChild><Pressable style={s.action}><Text style={s.actionIcon}>⌂</Text><Text>Services & area</Text></Pressable></Link></View>
 </View>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},loading:{flex:1,alignItems:"center",justifyContent:"center"},container:{padding:18,paddingBottom:110},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},bell:{width:40,height:40,borderRadius:20,backgroundColor:"#f2f7f5",alignItems:"center",justifyContent:"center"},bellText:{fontSize:18,color:"#087D65"},greeting:{fontSize:14,color:"#66736e",marginTop:22},heading:{fontSize:25,fontWeight:"900",color:"#13201c",lineHeight:31,marginTop:4},search:{height:50,borderWidth:1,borderColor:"#dce6e2",borderRadius:14,flexDirection:"row",alignItems:"center",paddingHorizontal:14,marginTop:18},searchIcon:{fontSize:23,color:"#087D65"},searchText:{marginLeft:8,color:"#8a9691"},section:{fontSize:17,fontWeight:"900",marginTop:22,color:"#13201c"},services:{flexDirection:"row",gap:10,marginTop:10},service:{width:70,alignItems:"center"},serviceText:{fontSize:10,textAlign:"center",marginTop:5,fontWeight:"700"},hero:{marginTop:18,borderRadius:18,backgroundColor:"#087D65",padding:18,minHeight:125,justifyContent:"center"},heroTitle:{color:"#fff",fontSize:20,fontWeight:"900"},heroSub:{color:"#dff8f1",marginTop:5},heroAction:{color:"#fff",fontWeight:"900",marginTop:12},nearby:{marginTop:10,borderWidth:1,borderColor:"#e1e8e5",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12},avatar:{width:48,height:48,borderRadius:24,backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center"},name:{fontWeight:"900"},meta:{color:"#66736e",fontSize:12,marginTop:3},view:{color:"#087D65",fontWeight:"900"},switch:{marginTop:22,height:50,borderWidth:1,borderColor:"#087D65",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16},disabled:{opacity:.6},switchText:{color:"#087D65",fontWeight:"900"},arrow:{fontSize:24,color:"#087D65"},signout:{alignItems:"center",padding:18},statHero:{backgroundColor:"#E7F7F2",borderRadius:18,padding:18,marginTop:18},statLabel:{fontWeight:"800",color:"#087D65"},statValue:{fontSize:38,fontWeight:"900",color:"#087D65",marginTop:5},statSmall:{fontSize:16},grid:{flexDirection:"row",gap:10,marginTop:12},metric:{flex:1,borderWidth:1,borderColor:"#e1e8e5",borderRadius:16,padding:16},metricNumber:{fontSize:26,fontWeight:"900",color:"#087D65"},primary:{height:52,borderRadius:12,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center",marginTop:16},primaryText:{color:"#fff",fontWeight:"900"},action:{flex:1,borderWidth:1,borderColor:"#e1e8e5",borderRadius:16,padding:16,alignItems:"center"},actionIcon:{fontSize:22,color:"#087D65",fontWeight:"900",marginBottom:5},muted:{color:"#66736e",marginTop:8}});
const _keep=undefined;
