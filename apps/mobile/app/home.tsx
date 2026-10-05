import { Link } from "expo-router";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
const services=["Electrician","Plumber","Carpenter","Painter","AC Technician"];
export default function HomeScreen(){
 const{session,mode,setMode,signOut}=useAuth();
 async function toggleMode(){await setMode(mode==="customer"?"professional":"customer");}
 const customer=mode==="customer";
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <View style={s.top}><VasudhaLogo compact/><Pressable onPress={()=>{}} style={s.bell}><Text>♧</Text></Pressable></View>
  {customer?<CustomerHome email={session?.user.email}/>:<ProfessionalHome email={session?.user.email}/>}
  <Pressable onPress={toggleMode} style={s.switch}><Text style={s.switchText}>{customer?"Switch to Professional mode":"Switch to Customer mode"}</Text><Text style={s.arrow}>›</Text></Pressable>
  <Pressable onPress={signOut} style={s.signout}><Text>Sign out</Text></Pressable>
 </ScrollView><AppBottomNav/></SafeAreaView>
}
function CustomerHome({email}:{email?:string}){
 return <View>
  <Text style={s.greeting}>Good morning {email?email.split("@")[0]:""} 👋</Text>
  <Text style={s.heading}>Find trusted professionals{"\n"}around you.</Text>
  <View style={s.search}><Text style={s.searchIcon}>⌕</Text><Text style={s.searchText}>Search for services...</Text></View>
  <Text style={s.section}>Popular services</Text>
  <View style={s.services}>{services.map(x=><Link key={x} href="/marketplace" asChild><Pressable style={s.service}><View style={s.serviceIcon}><Text>✦</Text></View><Text style={s.serviceText}>{x}</Text></Pressable></Link>)}</View>
  <Link href="/marketplace" asChild><Pressable style={s.hero}><Text style={s.heroTitle}>Your Property. Our Care.</Text><Text style={s.heroSub}>Verified professionals at your doorstep.</Text><Text style={s.heroAction}>Find professionals →</Text></Pressable></Link>
  <Text style={s.section}>Nearby professionals</Text>
  <Link href="/marketplace" asChild><Pressable style={s.nearby}><View style={s.avatar}><Text>RK</Text></View><View style={{flex:1}}><Text style={s.name}>Verified Professional</Text><Text style={s.meta}>Electrician • Available now</Text><Text style={s.meta}>★ 4.8 • Nearby</Text></View><Text style={s.view}>View</Text></Pressable></Link>
 </View>
}
function ProfessionalHome({email}:{email?:string}){
 return <View>
  <Text style={s.greeting}>Welcome back 👋</Text>
  <Text style={s.heading}>Grow your business.{"\n"}Get more customers.</Text>
  <View style={s.statHero}><Text style={s.statLabel}>Professional Trust</Text><Text style={s.statValue}>4.8 <Text style={s.statSmall}>/ 5.0</Text></Text><Text style={s.meta}>Verified profile • Available for jobs</Text></View>
  <View style={s.grid}><Link href="/professional-dashboard" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>0</Text><Text>New requests</Text></Pressable></Link><Link href="/jobs" asChild><Pressable style={s.metric}><Text style={s.metricNumber}>0</Text><Text>Active jobs</Text></Pressable></Link></View>
  <Link href="/professional-profile" asChild><Pressable style={s.primary}><Text style={s.primaryText}>Complete professional profile</Text></Pressable></Link>
  <Text style={s.section}>Quick actions</Text>
  <View style={s.grid}><Link href="/professional-verification" asChild><Pressable style={s.action}><Text style={s.actionIcon}>✓</Text><Text>Verification</Text></Pressable></Link><Link href="/professional-profile" asChild><Pressable style={s.action}><Text style={s.actionIcon}>⌂</Text><Text>My skills</Text></Pressable></Link></View>
 </View>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{padding:18,paddingBottom:110},top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},bell:{width:40,height:40,borderRadius:20,backgroundColor:"#f2f7f5",alignItems:"center",justifyContent:"center"},greeting:{fontSize:14,color:"#66736e",marginTop:22},heading:{fontSize:25,fontWeight:"900",color:"#13201c",lineHeight:31,marginTop:4},search:{height:50,borderWidth:1,borderColor:"#dce6e2",borderRadius:14,flexDirection:"row",alignItems:"center",paddingHorizontal:14,marginTop:18},searchIcon:{fontSize:23,color:"#087D65"},searchText:{marginLeft:8,color:"#8a9691"},section:{fontSize:17,fontWeight:"900",marginTop:22,color:"#13201c"},services:{flexDirection:"row",gap:10,marginTop:10},service:{width:70,alignItems:"center"},serviceIcon:{width:52,height:52,borderRadius:16,backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center"},serviceText:{fontSize:10,textAlign:"center",marginTop:5,fontWeight:"700"},hero:{marginTop:18,borderRadius:18,backgroundColor:"#087D65",padding:18,minHeight:125,justifyContent:"center"},heroTitle:{color:"#fff",fontSize:20,fontWeight:"900"},heroSub:{color:"#dff8f1",marginTop:5},heroAction:{color:"#fff",fontWeight:"900",marginTop:12},nearby:{marginTop:10,borderWidth:1,borderColor:"#e1e8e5",borderRadius:16,padding:14,flexDirection:"row",alignItems:"center",gap:12},avatar:{width:48,height:48,borderRadius:24,backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center"},name:{fontWeight:"900"},meta:{color:"#66736e",fontSize:12,marginTop:3},view:{color:"#087D65",fontWeight:"900"},switch:{marginTop:22,height:50,borderWidth:1,borderColor:"#087D65",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16},switchText:{color:"#087D65",fontWeight:"900"},arrow:{fontSize:24,color:"#087D65"},signout:{alignItems:"center",padding:18},statHero:{backgroundColor:"#E7F7F2",borderRadius:18,padding:18,marginTop:18},statLabel:{fontWeight:"800",color:"#087D65"},statValue:{fontSize:38,fontWeight:"900",color:"#087D65",marginTop:5},statSmall:{fontSize:16},grid:{flexDirection:"row",gap:10,marginTop:12},metric:{flex:1,borderWidth:1,borderColor:"#e1e8e5",borderRadius:16,padding:16},metricNumber:{fontSize:26,fontWeight:"900",color:"#087D65"},primary:{height:52,borderRadius:12,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center",marginTop:16},primaryText:{color:"#fff",fontWeight:"900"},action:{flex:1,borderWidth:1,borderColor:"#e1e8e5",borderRadius:16,padding:16,alignItems:"center"},actionIcon:{fontSize:22,color:"#087D65",fontWeight:"900",marginBottom:5}});