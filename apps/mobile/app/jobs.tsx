import {useEffect,useState} from "react";
import {ActivityIndicator,Alert,Pressable,SafeAreaView,ScrollView,StyleSheet,Text,View} from "react-native";
import {supabase} from "../src/lib/supabase";
import {router} from "expo-router";
import {useAuth} from "../src/auth/AuthProvider";
import {VasudhaLogo} from "../src/components/VasudhaLogo";
import {AppBottomNav} from "../src/components/AppBottomNav";

const steps=["quote_accepted","worker_accepted","on_the_way","arrived","work_started","work_completed","customer_confirmed"];
const labels=["Quote accepted","Worker accepted","On the way","Arrived","Work started","Work completed","Customer confirmed"];

export default function Jobs(){
 const{user,mode}=useAuth();const[jobs,setJobs]=useState<any[]>([]);const[loading,setLoading]=useState(true);
 useEffect(()=>{load()},[user?.id,mode]);
 async function load(){if(!user)return;setLoading(true);const{data,error}=await supabase.from("jobs").select("*").or(`customer_id.eq.${user.id},professional_id.eq.${user.id}`).order("created_at",{ascending:false});if(error)Alert.alert("Unable to load jobs",error.message);else setJobs(data||[]);setLoading(false)}
 async function status(job:any,next:string){const{error}=await supabase.rpc("update_job_status",{p_job_id:job.id,p_status:next});if(error)Alert.alert("Status update failed",error.message);else load()}
 function nextFor(j:any){const i=steps.indexOf(j.status);return i>=0&&i<steps.length-1?steps[i+1]:null}
 return <SafeAreaView style={s.safe}>
  <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   <View style={s.top}><VasudhaLogo compact/><Pressable style={s.refresh} onPress={load}><Text style={s.refreshText}>↻</Text></Pressable></View>
   <Text style={s.title}>My Jobs</Text><Text style={s.subtitle}>{mode==="customer"?"Track work and confirm completion":"Manage assigned work"}</Text>
   {loading?<View style={s.state}><ActivityIndicator size="small" color="#087D65"/><Text style={s.muted}>Loading jobs…</Text></View>:
    jobs.length===0?<View style={s.empty}><View style={s.emptyIcon}><Text>✓</Text></View><Text style={s.emptyTitle}>No jobs yet</Text><Text style={s.emptyText}>{mode==="customer"?"Your accepted services will appear here.":"Jobs assigned to you will appear here."}</Text></View>:
    jobs.map(j=>{const n=nextFor(j),idx=steps.indexOf(j.status);return <View key={j.id} style={s.card}>
      <View style={s.cardTop}><View style={{flex:1}}><Text style={s.name}>{j.title||"Service job"}</Text><Text style={s.id}>JOB · {String(j.id).slice(0,8).toUpperCase()}</Text></View><Text style={s.amount}>₹{Number(j.agreed_amount_inr||0).toLocaleString("en-IN")}</Text></View>
      <View style={s.badge}><View style={s.badgeDot}/><Text style={s.badgeText}>{labels[idx]||j.status}</Text></View>
      <View style={s.timeline}>{labels.map((x,i)=><View key={x} style={s.row}><View style={s.track}>{i<labels.length-1?<View style={[s.line,i<=idx&&s.lineDone]}/>:null}<View style={[s.dot,i<=idx?s.active:s.inactive]}>{i<=idx?<Text style={s.check}>✓</Text>:null}</View></View><Text style={[s.step,i<=idx?s.done:s.future]}>{x}</Text></View>)}</View>
      {j.status!=="customer_confirmed"&&j.status!=="cancelled"?<Pressable onPress={()=>router.push({pathname:"/job-tracking",params:{jobId:j.id}})} style={s.trackBtn}><Text style={s.trackText}>Track Job</Text></Pressable>:null}
      {n&&((mode==="professional"&&steps.indexOf(n)<=5)||(mode==="customer"&&n==="customer_confirmed"))?<Pressable onPress={()=>status(j,n)} style={s.primary}><Text style={s.primaryText}>{mode==="customer"?"Confirm work completed":"Mark "+labels[steps.indexOf(n)]}</Text></Pressable>:null}
      {mode==="customer"&&j.status==="customer_confirmed"?<Pressable onPress={()=>router.push({pathname:"/review",params:{jobId:j.id,professionalId:j.professional_id}})} style={s.secondary}><Text style={s.secondaryText}>Rate Professional</Text></Pressable>:null}
      {mode==="professional"&&j.status==="customer_confirmed"?<Pressable onPress={()=>router.push({pathname:"/customer-review",params:{jobId:j.id,customerId:j.customer_id}})} style={s.secondary}><Text style={s.secondaryText}>Rate Customer</Text></Pressable>:null}
      <Pressable onPress={()=>router.push({pathname:"/complaint",params:{jobId:j.id,againstUserId:mode==="customer"?j.professional_id:j.customer_id}})} style={s.problem}><Text style={s.problemText}>Report a Problem</Text></Pressable>
    </View>})}
  </ScrollView><AppBottomNav active="jobs"/>
 </SafeAreaView>
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#fff"},container:{padding:18,paddingBottom:104},top:{height:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#f2f7f5",alignItems:"center",justifyContent:"center"},refreshText:{fontSize:22,color:"#087D65"},title:{fontSize:28,fontWeight:"900",color:"#13201c",marginTop:18},subtitle:{color:"#66736e",marginTop:5},muted:{color:"#66736e",marginTop:9},state:{alignItems:"center",paddingVertical:48},empty:{marginTop:28,borderWidth:1,borderColor:"#e0e8e5",borderRadius:18,padding:24,alignItems:"center",backgroundColor:"#f7faf9"},emptyIcon:{width:52,height:52,borderRadius:26,backgroundColor:"#e7f7f2",alignItems:"center",justifyContent:"center"},emptyTitle:{fontSize:18,fontWeight:"900",color:"#13201c",marginTop:12},emptyText:{textAlign:"center",color:"#66736e",lineHeight:19,marginTop:5},card:{borderWidth:1,borderColor:"#dce6e2",borderRadius:18,padding:16,marginTop:16,backgroundColor:"#fff"},cardTop:{flexDirection:"row",alignItems:"flex-start"},name:{fontSize:18,fontWeight:"900",color:"#13201c"},id:{fontSize:10,color:"#87928e",marginTop:4,letterSpacing:.5},amount:{fontSize:17,fontWeight:"900",color:"#087D65"},badge:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",backgroundColor:"#e7f7f2",borderRadius:20,paddingHorizontal:10,paddingVertical:6,marginTop:12},badgeDot:{width:7,height:7,borderRadius:4,backgroundColor:"#087D65",marginRight:6},badgeText:{fontSize:12,fontWeight:"800",color:"#087D65"},timeline:{marginTop:16},row:{flexDirection:"row",minHeight:31},track:{width:20,alignItems:"center",position:"relative"},line:{position:"absolute",top:17,bottom:0,width:2,backgroundColor:"#e0e8e5"},lineDone:{backgroundColor:"#087D65"},dot:{width:14,height:14,borderRadius:7,borderWidth:1,borderColor:"#cfdad6",backgroundColor:"#fff",alignItems:"center",justifyContent:"center",zIndex:2},active:{backgroundColor:"#087D65",borderColor:"#087D65"},inactive:{backgroundColor:"#fff"},check:{fontSize:8,color:"#fff",fontWeight:"900"},step:{fontSize:12,marginLeft:8,paddingTop:0},done:{color:"#13201c",fontWeight:"700"},future:{color:"#9aa6a2"},primary:{marginTop:12,backgroundColor:"#087D65",borderRadius:12,minHeight:50,alignItems:"center",justifyContent:"center"},primaryText:{color:"#fff",fontWeight:"900"},secondary:{marginTop:10,borderWidth:1,borderColor:"#087D65",borderRadius:12,minHeight:46,alignItems:"center",justifyContent:"center"},secondaryText:{color:"#087D65",fontWeight:"900"},trackBtn:{marginTop:10,borderWidth:1,borderColor:"#087D65",borderRadius:12,minHeight:44,alignItems:"center",justifyContent:"center"},trackText:{color:"#087D65",fontWeight:"900"},problem:{marginTop:9,alignItems:"center",paddingVertical:8},problemText:{color:"#8b5b57",fontSize:12,fontWeight:"700"}
});
