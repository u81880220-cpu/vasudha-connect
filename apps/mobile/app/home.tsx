import {Link,router} from "expo-router";
import {Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View,ActivityIndicator} from "react-native";
import {useEffect,useState} from "react";
import {useAuth} from "../src/auth/AuthProvider";
import {VasudhaLogo} from "../src/components/VasudhaLogo";
import {AppBottomNav} from "../src/components/AppBottomNav";
import {ServiceIcon} from "../src/components/ServiceIcon";
import {supabase} from "../src/lib/supabase";
import {registerForPushNotifications,registerNotificationTapHandler} from "../src/lib/pushNotifications";
import { KamproPage, KamproCard, KamproPrimary, KamproSection } from "../src/components/KamproUI";

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
   // Do not block login on incomplete professional onboarding.
   // The home screen remains the authenticated landing page; professionals
   // can complete registration from the profile/verification actions.
   setCheckingOnboarding(false);
  })();
  return()=>{active=false};
 },[loading,session?.user.id,mode]);
 useEffect(()=>{if(!session)return; void registerForPushNotifications(session.user.id); const sub=registerNotificationTapHandler(); return()=>sub.remove()},[session?.user.id]);
 if(loading||!session||checkingOnboarding)return <SafeAreaView style={s.safe}><View style={s.loading}><ActivityIndicator color="#FF4B1F"/><Text style={s.muted}>Loading…</Text></View></SafeAreaView>;
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
 return <><KamproPage><View style={s.top}><VasudhaLogo/><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={()=>router.push("/notifications")} style={s.bell}><Text style={s.bellText}>🔔</Text></Pressable></View>
  {customer?<CustomerHome/>:<ProfessionalHome/>}
  <Pressable accessibilityRole="button" disabled={switching} onPress={toggleMode} style={[s.switch,switching&&s.disabled]}><Text style={s.switchText}>{switching?"Switching…":customer?"Switch to Professional mode":"Switch to Customer mode"}</Text><Text style={s.arrow}>›</Text></Pressable>
  <Pressable accessibilityRole="button" onPress={logout} style={s.signout}><Text style={s.signoutText}>Sign out</Text></Pressable>
 </KamproPage><AppBottomNav/></>
}

function CustomerHome(){
 return <View>
  <Text style={s.greeting}>Good morning 👋</Text>
  <Text style={s.heading}>Find trusted professionals</Text><Text style={s.heading}>around you.</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Search for services" onPress={()=>router.push("/marketplace")} style={s.search}><Text style={s.searchIcon}>⌕</Text><Text style={s.searchText}>Search for services...</Text></Pressable>
  <Text style={s.section}>Popular services</Text>
  <View style={s.services}>{services.map(x=><Link key={x} href="/marketplace" asChild><Pressable style={s.service}><ServiceIcon name={x} size={52}/><Text style={s.serviceText}>{x}</Text></Pressable></Link>)}</View>
  <Link href="/marketplace" asChild><Pressable style={s.hero}><Text style={s.heroTitle}>Kam hai? Pro bulaiye.</Text><Text style={s.heroSub}>Verified professionals at your doorstep.</Text><Text style={s.heroAction}>Find professionals →</Text></Pressable></Link>
  <Text style={s.section}>Your connections</Text>
  <Link href="/customer-dashboard" asChild><Pressable style={s.nearby}><View style={s.avatar}><Text>✓</Text></View><View style={{flex:1}}><Text style={s.name}>Connections & conversations</Text><Text style={s.meta}>Open your professional connections and chats</Text></View><Text style={s.view}>Open</Text></Pressable></Link>
 </View>
}
function ProfessionalSetupNotice(){
 const{session}=useAuth();
 const[ready,setReady]=useState(false);
 useEffect(()=>{
  if(!session?.user.id)return;
  (async()=>{
   const[{data:pp},{data:ss},{data:area}]=await Promise.all([
    supabase.from("professional_profiles").select("headline,about").eq("user_id",session.user.id).maybeSingle(),
    supabase.from("professional_sub_services").select("sub_service_id").eq("professional_id",session.user.id).limit(1),
    supabase.from("service_areas").select("id").eq("professional_id",session.user.id).limit(1)
   ]);
   setReady(!pp?.headline?.trim()||!pp?.about?.trim()||!ss?.length||!area?.length);
  })();
 },[session?.user.id]);
 if(!ready)return null;
 return <Pressable onPress={()=>router.push("/professional-onboarding")} style={s.setupNotice}>
  <Text style={s.setupTitle}>Complete your professional registration</Text>
  <Text style={s.setupText}>Add your services and service area to become visible to customers.</Text>
  <Text style={s.setupAction}>Continue registration →</Text>
 </Pressable>;
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
    supabase.from("professional_connections").select("id").eq("professional_id",session.user.id).gt("expires_at",new Date().toISOString()).limit(50)
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
  <ProfessionalSetupNotice/>
  <View style={s.statHero}><Text style={s.statLabel}>Professional Trust</Text><Text style={s.statValue}>{Math.round(stats.trust)} <Text style={s.statSmall}>/ 100</Text></Text><Text style={s.meta}>{stats.verified?"✓ Verified":"Verification pending"} • {stats.available?"Available for customers":"Currently unavailable"}</Text></View>
  <View style={s.grid}><Link href="/professional-dashboard" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>{stats.requests}</Text><Text>New requests</Text></Pressable></Link><Link href="/connections" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>{stats.jobs}</Text><Text>Connections</Text></Pressable></Link></View>
  <Link href="/professional-profile" asChild><Pressable style={s.primary}><Text style={s.primaryText}>Manage professional profile</Text></Pressable></Link>
  <Text style={s.section}>Quick actions</Text>
  <View style={s.grid}><Link href="/professional-verification" asChild><Pressable style={s.action}><Text style={s.actionIcon}>✓</Text><Text>Verification</Text></Pressable></Link><Link href="/professional-profile" asChild><Pressable style={s.action}><Text style={s.actionIcon}>⌂</Text><Text>Services & area</Text></Pressable></Link></View>
 </View>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},loading:{flex:1,alignItems:"center",justifyContent:"center"},container:{padding:18,paddingBottom:110},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},bell:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},bellText:{fontSize:18,color:"#FF4B1F"},greeting:{fontSize:14,color:"#6B7280",marginTop:22},heading:{fontSize:30,fontWeight:"900",color:"#10233F",lineHeight:35,marginTop:4,letterSpacing:-.5},search:{height:56,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,flexDirection:"row",alignItems:"center",paddingHorizontal:16,marginTop:20,backgroundColor:"#fff",shadowColor:"#10233F",shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2},searchIcon:{fontSize:23,color:"#FF4B1F"},searchText:{marginLeft:8,color:"#8a9691"},section:{fontSize:19,fontWeight:"900",marginTop:28,color:"#10233F"},services:{flexDirection:"row",gap:10,marginTop:10},service:{width:70,alignItems:"center"},serviceText:{fontSize:10,textAlign:"center",marginTop:5,fontWeight:"700",color:"#10233F"},hero:{marginTop:18,borderRadius:24,backgroundColor:"#FF4B1F",padding:24,minHeight:150,justifyContent:"center",shadowColor:"#D93812",shadowOpacity:.16,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:4},heroTitle:{color:"#fff",fontSize:20,fontWeight:"900"},heroSub:{color:"#dff8f1",marginTop:5},heroAction:{color:"#fff",fontWeight:"900",marginTop:12},nearby:{marginTop:10,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12},avatar:{width:48,height:48,borderRadius:24,backgroundColor:"#FFF0EA",alignItems:"center",justifyContent:"center"},name:{fontWeight:"900"},meta:{color:"#6B7280",fontSize:12,marginTop:3},view:{color:"#FF4B1F",fontWeight:"900"},switch:{marginTop:22,height:50,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16},disabled:{opacity:.6},switchText:{color:"#FF4B1F",fontWeight:"900"},arrow:{fontSize:24,color:"#FF4B1F"},signout:{alignItems:"center",padding:18},signoutText:{color:"#10233F",fontWeight:"700"},setupNotice:{marginTop:16,borderWidth:1,borderColor:"#E18A2D",backgroundColor:"#FFF8EE",borderRadius:16,padding:15},setupTitle:{fontWeight:"900",color:"#10233F"},setupText:{color:"#6B7280",fontSize:12,marginTop:4,lineHeight:18},setupAction:{color:"#FF4B1F",fontWeight:"900",marginTop:8},statHero:{backgroundColor:"#FFF0EA",borderRadius:18,padding:18,marginTop:18},statLabel:{fontWeight:"800",color:"#FF4B1F"},statValue:{fontSize:38,fontWeight:"900",color:"#FF4B1F",marginTop:5},statSmall:{fontSize:16},grid:{flexDirection:"row",gap:10,marginTop:12},metric:{flex:1,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,backgroundColor:"#fff"},metricNumber:{fontSize:26,fontWeight:"900",color:"#FF4B1F"},primary:{height:52,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:16},primaryText:{color:"#fff",fontWeight:"900"},action:{flex:1,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,alignItems:"center",backgroundColor:"#fff"},actionIcon:{fontSize:22,color:"#FF4B1F",fontWeight:"900",marginBottom:5},muted:{color:"#6B7280",marginTop:8}});
const _keep=undefined;
