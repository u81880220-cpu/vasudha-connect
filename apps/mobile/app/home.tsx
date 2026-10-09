import {Link,router} from "expo-router";
import * as Location from "expo-location";
import {Alert,Image,Pressable,SafeAreaView,ScrollView,StyleSheet,Switch,Text,View,ActivityIndicator,useWindowDimensions} from "react-native";
import {useEffect,useState} from "react";
import {useAuth} from "../src/auth/AuthProvider";
import {VasudhaLogo} from "../src/components/VasudhaLogo";
import {AppBottomNav} from "../src/components/AppBottomNav";
import {ServiceIcon} from "../src/components/ServiceIcon";
import {supabase} from "../src/lib/supabase";
import {registerForPushNotifications,registerNotificationTapHandler} from "../src/lib/pushNotifications";
import { KamproPage, KamproCard, KamproPrimary, KamproSection } from "../src/components/KamproUI";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { useKamproLanguage } from "../src/i18n/LanguageProvider";

const services=["Electrician","Plumber","Carpenter","Painter","AC Technician"];

// KAMPRO QA: authenticated landing screen
export default function HomeScreen(){
 const{session,loading,mode,setMode,signOut}=useAuth();
 const {t}=useKamproLanguage();
 const {width}=useWindowDimensions();
 const[switching,setSwitching]=useState(false);
 const[customerName,setCustomerName]=useState("");
 const[customerAvatarUrl,setCustomerAvatarUrl]=useState<string|null>(null);
 const[unreadNotifications,setUnreadNotifications]=useState(0);
 const[checkingOnboarding,setCheckingOnboarding]=useState(true);
 useEffect(()=>{if(!loading&&!session)router.replace("/auth")},[loading,session]);
 useEffect(()=>{
  if(loading||!session)return;
  let active=true;
  (async()=>{
   const[{data:profile},{count:unreadCount}]=await Promise.all([supabase.from("profiles").select("full_name,avatar_url").eq("id",session.user.id).maybeSingle(),supabase.from("notifications").select("id",{count:"exact",head:true}).eq("user_id",session.user.id).is("read_at",null)]);
   if(!active)return;
   if(!profile?.full_name?.trim()){router.replace("/basic-profile");return;}
   // Do not block login on incomplete professional onboarding.
   // The home screen remains the authenticated landing page; professionals
   // can complete registration from the profile/verification actions.
   setCustomerName(profile?.full_name?.trim()||"");
   setCustomerAvatarUrl(profile?.avatar_url||null);
   setUnreadNotifications(unreadCount||0);
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
 return <><KamproPage><View style={s.top}><VasudhaLogo/><View style={s.topActions}><LanguageSwitch/><Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={()=>router.push("/notifications")} style={s.bell}><Text style={s.bellText}>🔔</Text>{unreadNotifications>0?<View style={s.badge}><Text style={s.badgeText}>{unreadNotifications>99?"99+":unreadNotifications}</Text></View>:null}</Pressable></View></View>
  {customer?<CustomerHome name={customerName} avatarUrl={customerAvatarUrl}/>:<ProfessionalHome/>}
  <Pressable accessibilityRole="button" disabled={switching} onPress={toggleMode} style={[s.switch,switching&&s.disabled]}><Text style={s.switchText}>{switching?t("switching"):customer?t("switchToProfessional"):t("switchToCustomer")}</Text><Text style={s.arrow}>›</Text></Pressable>
 </KamproPage><AppBottomNav/></>
}

function CurrentLocationBar(){
 const {t}=useKamproLanguage();
 const[locationText,setLocationText]=useState("Detecting your location…");
 const[loadingLocation,setLoadingLocation]=useState(false);
 async function detectLocation(){
  if(loadingLocation)return;
  setLoadingLocation(true);
  try{
   const{status}=await Location.requestForegroundPermissionsAsync();
   if(status!=="granted"){setLocationText(t("locationPermissionNeeded"));return;}
   const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
   const places=await Location.reverseGeocodeAsync({latitude:pos.coords.latitude,longitude:pos.coords.longitude});
   const p=places?.[0];
   const city=p?.city||p?.district||p?.subregion||p?.region||t("currentLocationFallback");
   const state=p?.region&&p.region!==city?p.region:"";
   setLocationText(state?city+", "+state:city);
  }catch{setLocationText(t("unableDetectLocation"));}
  finally{setLoadingLocation(false);}
 }
 useEffect(()=>{void detectLocation()},[]);
 return <Pressable accessibilityRole="button" accessibilityLabel="Detect current location" onPress={detectLocation} style={s.locationBar}>
  <View style={s.locationPin}><Text style={s.locationPinText}>⌖</Text></View>
  <View style={{flex:1}}><Text style={s.locationLabel}>{t("currentLocation")}</Text><Text style={s.locationValue}>{loadingLocation?t("detectingLocation"):locationText}</Text></View>
  <Text style={s.locationTarget}>⌾</Text>
 </Pressable>
}

function CustomerHome({name,avatarUrl}:{name:string;avatarUrl:string|null}){
 const{width}=useWindowDimensions();
 const{session}=useAuth();
 const {t}=useKamproLanguage();
 const[activeJob,setActiveJob]=useState<any>(null);
 const[recentRequests,setRecentRequests]=useState<any[]>([]);
 useEffect(()=>{if(!session?.user.id)return;let active=true;(async()=>{const[{data:jobs},{data:requests}]=await Promise.all([supabase.from("jobs").select("id,title,status,created_at,updated_at,professional_id").eq("customer_id",session.user.id).in("status",["worker_accepted","on_the_way","arrived","work_started"]).order("created_at",{ascending:false}).limit(3),supabase.from("service_requests").select("id,title,status,created_at,professional_id").eq("customer_id",session.user.id).in("status",["requested","submitted"]).order("created_at",{ascending:false}).limit(3)]);if(active){setActiveJob(jobs?.[0]||null);setRecentRequests(requests||[])}})();return()=>{active=false}},[session?.user.id]);
 return <View>
  <View style={s.customerIdentity}><View style={s.customerPhoto}>{avatarUrl?<Image source={{uri:avatarUrl}} style={s.customerPhotoImage}/>:<Text style={s.customerInitial}>{name?.slice(0,1).toUpperCase()||"C"}</Text>}</View><Text style={[s.greeting,s.customerGreeting]} numberOfLines={1} ellipsizeMode="tail">{t("goodMorning")}{name ? ", "+name : ""} 👋</Text></View>
  <CurrentLocationBar/>
  {activeJob?<Pressable onPress={()=>router.push({pathname:"/job-tracking",params:{jobId:activeJob.id}})} style={s.activeJobHero}><View style={s.activeJobIcon}><Text>📍</Text></View><View style={{flex:1}}><Text style={s.activeJobTitle}>Active job · Track now</Text><Text style={s.name}>{activeJob.title||"Professional service"}</Text><Text style={s.meta}>Status: {String(activeJob.status||"on_the_way").replaceAll("_"," ")} · Created {new Date(activeJob.created_at||activeJob.updated_at).toLocaleString()}</Text></View><Text style={s.view}>Track →</Text></Pressable>:null}
  {recentRequests.map(r=><Pressable key={r.id} onPress={()=>router.push("/jobs")} style={s.activeJobHero}><View style={s.activeJobIcon}><Text>🧰</Text></View><View style={{flex:1}}><Text style={s.activeJobTitle}>Job request sent</Text><Text style={s.name}>{r.title||"Professional service"}</Text><Text style={s.meta}>Created {new Date(r.created_at).toLocaleString()} · Status: {r.status}</Text></View><Text style={s.view}>View →</Text></Pressable>)}
  <Text style={[s.heading,{fontSize:width<360?20:width<400?22:24,lineHeight:width<360?28:width<400?31:35}]}>{t("findTrustedProfessionals")}</Text><Text style={[s.heading,{fontSize:width<360?20:width<400?22:24,lineHeight:width<360?28:width<400?31:35}]}>{t("aroundYou")}</Text>
  <Pressable accessibilityRole="button" accessibilityLabel="Search for services" onPress={()=>router.push("/marketplace")} style={s.search}><Text style={s.searchIcon}>⌕</Text><Text style={s.searchText}>{t("searchServices")}</Text></Pressable>
  <Text style={s.section}>{t("popularServices")}</Text>
  <View style={s.services}>{services.map(x=><Link key={x} href="/marketplace" asChild><Pressable style={s.service}><ServiceIcon name={x} size={46}/><Text style={s.serviceText} numberOfLines={2}>{x}</Text></Pressable></Link>)}</View>
  <Link href="/marketplace" asChild><Pressable style={s.hero}><Text style={s.heroTitle}>Kam hai? Pro bulaiye.</Text><Text style={s.heroSub}>{t("trustedAtDoorstep")}</Text><Text style={s.heroAction}>{t("findProfessionals")} →</Text></Pressable></Link>
  <Text style={s.section}>{t("yourConnections")}</Text>
  <Link href="/customer-dashboard" asChild><Pressable style={s.nearby}><View style={s.avatar}><Text>✓</Text></View><View style={{flex:1}}><Text style={s.name}>{t("connectionsConversations")}</Text><Text style={s.meta}>{t("openConnections")}</Text></View><Text style={s.view}>Open</Text></Pressable></Link>

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
 const {t}=useKamproLanguage();
 const[professionalName,setProfessionalName]=useState("");
 const[avatarUrl,setAvatarUrl]=useState<string|null>(null);
 const[stats,setStats]=useState({trust:0,verified:false,available:false,requests:0,connections:0,rating:null as number|null,completion:0});
 const[incomingJobs,setIncomingJobs]=useState<any[]>([]);
 const[busy,setBusy]=useState(false);
 useEffect(()=>{
  if(!session?.user.id)return;
  let active=true;
  (async()=>{
   const[{data:profile},{data:requests},{data:connections},{data:jobs},{data:reviews},{data:userProfile},{data:incoming}]=await Promise.all([
    supabase.from("professional_profiles").select("trust_score,verification_status,is_available").eq("user_id",session.user.id).maybeSingle(),
    supabase.rpc("get_professional_requests"),
    supabase.from("professional_connections").select("id").eq("professional_id",session.user.id).gt("expires_at",new Date().toISOString()),
    supabase.from("jobs").select("id,status").eq("professional_id",session.user.id),
    supabase.from("customer_job_reviews").select("punctuality,work_quality,professional_behaviour,communication,value_for_money,reliability,safety_care").eq("professional_id",session.user.id),
    supabase.from("profiles").select("full_name,avatar_url").eq("id",session.user.id).maybeSingle(),
    supabase.from("service_requests").select("id,title,status,created_at,customer_id").eq("professional_id",session.user.id).in("status",["requested","submitted"]).order("created_at",{ascending:false}).limit(5)
   ]);
   if(!active)return;
   const allJobs=jobs||[], done=allJobs.filter((x:any)=>x.status==="customer_confirmed").length;
   const rv=reviews||[];
   const rating=rv.length?rv.reduce((sum:number,x:any)=>sum+(Number(x.punctuality)+Number(x.work_quality)+Number(x.professional_behaviour)+Number(x.communication)+Number(x.value_for_money)+Number(x.reliability)+Number(x.safety_care))/7,0)/rv.length:null;
   setProfessionalName(userProfile?.full_name?.trim()||"");
   setAvatarUrl(userProfile?.avatar_url||null);
   const customerIds=[...new Set((incoming||[]).map((x:any)=>x.customer_id).filter(Boolean))];
   const customerNames:Record<string,string>={};
   if(customerIds.length){const{data:customerProfiles}=await supabase.from("profiles").select("id,full_name").in("id",customerIds);(customerProfiles||[]).forEach((p:any)=>{customerNames[p.id]=p.full_name||"Customer"});}
   setIncomingJobs((incoming||[]).map((x:any)=>({...x,customer_name:customerNames[x.customer_id]||"Customer"})));
   setStats({trust:Number(profile?.trust_score||0),verified:profile?.verification_status==="verified",available:!!profile?.is_available,requests:(incoming||[]).length,connections:(connections||[]).length,rating,completion:allJobs.length?Math.round(done/allJobs.length*100):0});
  })();
  return()=>{active=false};
 },[session?.user.id]);
 async function toggleAvailability(v:boolean){
  if(busy)return;setBusy(true);
  const{data:current}=await supabase.from("professional_profiles").select("headline,about,years_experience,service_radius_km,base_latitude,base_longitude").eq("user_id",session?.user.id).maybeSingle();
  const{error}=await supabase.rpc("update_professional_profile",{p_headline:current?.headline||null,p_about:current?.about||null,p_years_experience:Number(current?.years_experience||0),p_service_radius_km:Number(current?.service_radius_km||10),p_is_available:v,p_base_latitude:current?.base_latitude??null,p_base_longitude:current?.base_longitude??null});
  setBusy(false);
  if(error)Alert.alert("Availability update failed",error.message);else setStats(x=>({...x,available:v}));
 }
 return <View>
  <View style={s.proIdentity}><View style={s.proPhoto}>{avatarUrl?<Image source={{uri:avatarUrl}} style={s.proPhotoImage}/>:<Text style={s.proInitial}>{professionalName.slice(0,1).toUpperCase()||"P"}</Text>}</View><View style={{flex:1}}><Text style={s.greeting}>Good morning{professionalName?", "+professionalName:""} 👋</Text><Text style={s.proRole}>{t("professionalAccount")}</Text></View></View>
  <CurrentLocationBar/>
  <Text style={s.heading}>{t("growBusiness")}</Text><Text style={s.heading}>{t("getMoreCustomers")}</Text>
  <View style={s.availability}><View style={{flex:1}}><Text style={s.availabilityTitle}>{t("availableForWork")}</Text><Text style={s.meta}>{stats.available?t("availableNow"):t("unavailable")}</Text></View><Switch value={stats.available} onValueChange={toggleAvailability} disabled={busy}/></View>
  <View style={s.statHero}><Text style={s.statLabel}>Professional Trust</Text><Text style={s.statValue}>{Math.round(stats.trust)} <Text style={s.statSmall}>/ 100</Text></Text><Text style={s.meta}>{stats.verified?"✓ Verified":"Verification pending"}</Text></View>
  <View style={s.grid}><View style={s.metric}><Text style={s.metricNumber}>{stats.rating==null?"—":stats.rating.toFixed(1)+"★"}</Text><Text style={s.metricLabel} numberOfLines={1} adjustsFontSizeToFit>Rating</Text></View><View style={s.metric}><Text style={s.metricNumber}>{stats.completion}%</Text><Text style={s.metricLabel} numberOfLines={1} adjustsFontSizeToFit>Completion</Text></View><Link href="/connections" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>{stats.connections}</Text><Text style={s.metricLabel} numberOfLines={1} adjustsFontSizeToFit>Connections</Text></Pressable></Link></View>
  <Link href="/jobs" asChild><Pressable style={s.requestCard}><View style={{flex:1}}><Text style={s.requestTitle}>{t("incomingRequests")}</Text><Text style={s.meta}>{stats.requests?stats.requests+" request"+(stats.requests===1?"":"s")+" waiting for your response":t("noPendingRequests")}</Text></View><Text style={s.view}>View All →</Text></Pressable></Link>
  {incomingJobs.map(r=><Pressable key={r.id} onPress={()=>router.push("/jobs")} style={s.requestCard}><View style={{flex:1}}><Text style={s.requestTitle}>{r.title||"New service request"}</Text><Text style={s.meta}>Customer: {r.customer_name||"Customer"}</Text><Text style={s.meta}>Received {new Date(r.created_at).toLocaleString()} · {r.status}</Text></View><Text style={s.view}>Open →</Text></Pressable>)}
  <Link href="/professional-profile" asChild><Pressable style={s.primary}><Text style={s.primaryText}>{t("manageProfessionalProfile")}</Text></Pressable></Link>
  <Text style={s.section}>{t("quickActions")}</Text>
  <View style={s.grid}><Link href="/professional-verification" asChild><Pressable style={s.action}><Text style={s.actionIcon}>✓</Text><Text style={s.actionText}>{t("verification")}</Text></Pressable></Link><Link href="/professional-profile" asChild><Pressable style={s.action}><Text style={s.actionIcon}>⌂</Text><Text style={s.actionText}>{t("servicesAndArea")}</Text></Pressable></Link></View>
 </View>
}
const s=StyleSheet.create({locationBar:{flexDirection:"row",alignItems:"center",marginTop:10,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:"#DCE8F7",borderRadius:12,backgroundColor:"#F4F8FE",gap:9},locationPin:{width:28,height:28,borderRadius:14,backgroundColor:"#E8F0FC",alignItems:"center",justifyContent:"center"},locationPinText:{fontSize:16,color:"#365D8D"},locationLabel:{fontSize:9,color:"#596575",fontWeight:"600"},locationValue:{fontSize:11,fontWeight:"800",color:"#10233F",marginTop:1},locationTarget:{fontSize:20,color:"#2F80ED",paddingHorizontal:3},customerIdentity:{flexDirection:"row",alignItems:"center",gap:10,marginTop:18},customerGreeting:{flex:1,minWidth:0},customerPhoto:{width:42,height:42,borderRadius:21,backgroundColor:"#FFF0EA",alignItems:"center",justifyContent:"center",overflow:"hidden"},customerPhotoImage:{width:"100%",height:"100%"},customerInitial:{fontSize:17,fontWeight:"900",color:"#FF4B1F"},proIdentity:{flexDirection:"row",alignItems:"center",gap:12,marginTop:18},proPhoto:{width:58,height:58,borderRadius:29,backgroundColor:"#FFF0EA",alignItems:"center",justifyContent:"center",overflow:"hidden"},proPhotoImage:{width:"100%",height:"100%"},proInitial:{fontSize:22,fontWeight:"900",color:"#FF4B1F"},proRole:{fontSize:12,color:"#526071",fontWeight:"600",marginTop:2},availability:{flexDirection:"row",alignItems:"center",marginTop:18,padding:15,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,backgroundColor:"#fff"},availabilityTitle:{fontWeight:"900",color:"#10233F"},requestCard:{marginTop:12,borderWidth:1,borderColor:"#FFD3C2",borderRadius:16,padding:15,flexDirection:"row",alignItems:"center",backgroundColor:"#FFF8F4"},requestTitle:{fontWeight:"900",fontSize:16,color:"#10233F"},safe:{flex:1,backgroundColor:"#fff"},loading:{flex:1,alignItems:"center",justifyContent:"center"},container:{padding:18,paddingBottom:110},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},topActions:{flexDirection:"row",alignItems:"center",gap:8},bell:{width:40,height:40,borderRadius:20,backgroundColor:"#F7F8FA",alignItems:"center",justifyContent:"center"},bellText:{fontSize:18,color:"#FF4B1F"},badge:{position:"absolute",right:-2,top:-2,minWidth:18,height:18,paddingHorizontal:4,borderRadius:9,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"#fff"},badgeText:{color:"#fff",fontSize:10,fontWeight:"900"},greeting:{fontSize:14,color:"#6B7280",marginTop:22},heading:{fontSize:24,fontWeight:"900",color:"#10233F",lineHeight:35,marginTop:4,letterSpacing:-.5},search:{height:56,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,flexDirection:"row",alignItems:"center",paddingHorizontal:16,marginTop:20,backgroundColor:"#fff",shadowColor:"#10233F",shadowOpacity:.04,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:2},searchIcon:{fontSize:23,color:"#FF4B1F"},searchText:{marginLeft:8,color:"#5F6B7A",fontWeight:"600"},section:{fontSize:19,fontWeight:"900",marginTop:28,color:"#10233F"},services:{flexDirection:"row",gap:6,marginTop:10,width:"100%"},service:{flex:1,minWidth:0,alignItems:"center"},serviceText:{fontSize:9,textAlign:"center",marginTop:5,fontWeight:"700",color:"#10233F",lineHeight:12,width:"100%"},hero:{marginTop:18,borderRadius:24,backgroundColor:"#FF4B1F",padding:24,minHeight:150,justifyContent:"center",shadowColor:"#D93812",shadowOpacity:.16,shadowRadius:18,shadowOffset:{width:0,height:8},elevation:4},heroTitle:{color:"#fff",fontSize:18,fontWeight:"900"},heroSub:{color:"#dff8f1",marginTop:5},heroAction:{color:"#fff",fontWeight:"900",marginTop:12},nearby:{marginTop:10,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12},activeJobHero:{marginTop:14,borderWidth:2,borderColor:"#FF4B1F",borderRadius:18,padding:15,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#FFF8F4"},activeJob:{marginTop:10,borderWidth:1,borderColor:"#FFD3C2",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12,backgroundColor:"#FFF8F4"},activeJobIcon:{width:44,height:44,borderRadius:22,backgroundColor:"#FFF0EA",alignItems:"center",justifyContent:"center"},activeJobTitle:{fontSize:13,fontWeight:"900",color:"#FF4B1F",marginBottom:2},avatar:{width:48,height:48,borderRadius:24,backgroundColor:"#FFF0EA",alignItems:"center",justifyContent:"center"},name:{fontWeight:"900",color:"#10233F"},meta:{color:"#596575",fontSize:12,fontWeight:"500",marginTop:3},view:{color:"#FF4B1F",fontWeight:"900"},switch:{marginTop:22,height:50,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16},disabled:{opacity:.6},switchText:{color:"#FF4B1F",fontWeight:"900"},arrow:{fontSize:24,color:"#FF4B1F"},signout:{alignItems:"center",padding:18},signoutText:{color:"#10233F",fontWeight:"700"},setupNotice:{marginTop:16,borderWidth:1,borderColor:"#E18A2D",backgroundColor:"#FFF8EE",borderRadius:16,padding:15},setupTitle:{fontWeight:"900",color:"#10233F"},setupText:{color:"#6B7280",fontSize:12,marginTop:4,lineHeight:18},setupAction:{color:"#FF4B1F",fontWeight:"900",marginTop:8},statHero:{backgroundColor:"#FFF0EA",borderRadius:18,padding:18,marginTop:18},statLabel:{fontWeight:"800",color:"#FF4B1F"},statValue:{fontSize:38,fontWeight:"900",color:"#FF4B1F",marginTop:5},statSmall:{fontSize:16},grid:{flexDirection:"row",gap:10,marginTop:12},metric:{flex:1,minWidth:0,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,paddingHorizontal:8,paddingVertical:14,alignItems:"center",backgroundColor:"#fff"},metricNumber:{fontSize:22,fontWeight:"900",color:"#FF4B1F",textAlign:"center",includeFontPadding:false},primary:{height:52,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:16},primaryText:{color:"#fff",fontWeight:"900"},action:{flex:1,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,alignItems:"center",backgroundColor:"#fff"},actionIcon:{fontSize:22,color:"#FF4B1F",fontWeight:"900",marginBottom:5},metricLabel:{color:"#10233F",fontSize:11,fontWeight:"800",marginTop:5,textAlign:"center",width:"100%",flexShrink:1},actionText:{color:"#26364B",fontSize:14,fontWeight:"700"},muted:{color:"#596575",marginTop:8}});
const _keep=undefined;
