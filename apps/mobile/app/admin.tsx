import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../src/lib/supabase";

type Tab="dashboard"|"professionals"|"verification"|"customers"|"services"|"jobs"|"payments"|"notifications"|"complaints"|"portfolio"|"audit";
const tabs:Tab[]=["dashboard","professionals","verification","customers","services","jobs","payments","notifications","complaints","portfolio","audit"];

export default function AdminScreen(){
 const[session,setSession]=useState<any>(null),[admin,setAdmin]=useState(false),[loading,setLoading]=useState(true);
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[message,setMessage]=useState("");
 const[tab,setTab]=useState<Tab>("dashboard");
 const[data,setData]=useState<any>({pros:[],verification:[],customers:[],services:[],jobs:[],payments:[],notifications:[],complaints:[],portfolio:[],audit:[]});

 useEffect(()=>{let mounted=true;
  supabase.auth.getSession().then(async({data:d})=>{if(!mounted)return;setSession(d.session);if(d.session)await checkAdmin();setLoading(false)});
  const {data:l}=supabase.auth.onAuthStateChange(async(_e,s)=>{setSession(s);if(s)await checkAdmin();else setAdmin(false);setLoading(false)});
  return()=>{mounted=false;l.subscription.unsubscribe()};
 },[]);

 async function checkAdmin(){const{data,error}=await supabase.rpc("is_admin");if(error){setAdmin(false);setMessage(error.message);return}setAdmin(Boolean(data));if(data)await loadAll()}
 async function login(){setMessage("");setLoading(true);const{error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage(error.message);else await checkAdmin();setLoading(false)}
 async function loadAll(){
  const calls:[string,string][]=[["pros","admin_marketplace_professionals"],["verification","admin_pending_verifications"],["customers","admin_customer_reputation"],["services","admin_marketplace_skills"],["jobs","admin_jobs"],["payments","admin_payment_orders"],["notifications","admin_notifications"],["complaints","admin_complaints"],["portfolio","admin_portfolio_moderation"],["audit","admin_audit_log"]];
  const results=await Promise.all(calls.map(async([key,fn])=>{const{data,error}=await supabase.rpc(fn);return[key,error?[]:data||[]]}));
  setData(Object.fromEntries(results));
 }
 async function signOut(){await supabase.auth.signOut();setAdmin(false);setSession(null)}

 if(loading)return <View style={s.center}><ActivityIndicator/><Text style={s.muted}>Loading admin console…</Text></View>;
 if(!session)return <View style={s.center}><View style={s.login}><Text style={s.logo}>VASUDHA CONNECT</Text><Text style={s.title}>Admin Console</Text><Text style={s.muted}>Authorized administrators only.</Text><TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" placeholder="Admin email" value={email} onChangeText={setEmail}/><TextInput style={s.input} secureTextEntry placeholder="Password" value={password} onChangeText={setPassword}/><Pressable style={s.primary} onPress={login}><Text style={s.primaryText}>Sign in to Admin</Text></Pressable>{message?<Text style={s.error}>{message}</Text>:null}</View></View>;
 if(!admin)return <View style={s.center}><View style={s.login}><Text style={s.title}>Admin access required</Text><Text style={s.muted}>This account is not on the VASUDHA admin allow-list.</Text><Pressable style={s.secondary} onPress={signOut}><Text>Sign out</Text></Pressable>{message?<Text style={s.error}>{message}</Text>:null}</View></View>;

 const counts={verified:data.pros.filter((x:any)=>x.verification_status==="verified").length,pending:data.verification.length,customers:data.customers.length,jobs:data.jobs.length,paid:data.payments.filter((x:any)=>x.status==="paid").length,complaints:data.complaints.filter((x:any)=>["open","under_review"].includes(x.status)).length,portfolio:data.portfolio.filter((x:any)=>x.moderation_status==="pending").length,services:data.services.filter((x:any)=>x.is_active).length};
 return <View style={s.page}>
  <View style={s.header}><View><Text style={s.logo}>VASUDHA CONNECT</Text><Text style={s.title}>Admin Console</Text></View><Pressable onPress={signOut} style={s.secondary}><Text>Sign out</Text></Pressable></View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>{tabs.map(x=><Pressable key={x} onPress={()=>setTab(x)} style={tab===x?s.tabActive:s.tab}><Text style={tab===x?s.tabTextActive:s.tabText}>{x==="dashboard"?"Dashboard":x[0].toUpperCase()+x.slice(1)}</Text></Pressable>)}</ScrollView>
  <ScrollView style={s.body} contentContainerStyle={s.bodyInner}>
   {tab==="dashboard"&&<><View style={s.grid}>{Object.entries({Verified:counts.verified,Pending:counts.pending,Customers:counts.customers,Jobs:counts.jobs,Paid:counts.paid,"Open complaints":counts.complaints,"Portfolio pending":counts.portfolio,"Active services":counts.services}).map(([k,v])=><View key={k} style={s.metric}><Text style={s.muted}>{k}</Text><Text style={s.metricValue}>{String(v)}</Text></View>)}</View><Section title="Admin workflow"><Text style={s.muted}>Use the sections above to manage marketplace operations. State-changing actions remain protected by admin-only RPCs.</Text></Section></>}
   {tab==="professionals"&&<List title="Professionals" items={data.pros} render={(x:any)=><Row title={x.display_name||"Professional"} subtitle={(x.headline||"No headline")+" • Trust "+Math.round(x.trust_score||0)+"/100"} meta={(x.verification_status||"")+" • "+(x.is_available?"Available":"Unavailable")}/>} />}
   {tab==="verification"&&<List title="Pending verification" items={data.verification} render={(x:any)=><Row title={x.professional_name||"Professional"} subtitle={(x.document_type||"Document")+" • "+(x.city||"")} meta={new Date(x.submitted_at).toLocaleString()}/>} />}
   {tab==="customers"&&<List title="Customers" items={data.customers} render={(x:any)=><Row title={x.display_name||"Customer"} subtitle={(x.city||"")+" "+(x.state||"")} meta={"Trust "+Math.round(x.customer_trust_score||0)+"/100 • "+(x.jobs_completed||0)+" jobs"}/>} />}
   {tab==="services"&&<List title="Service catalogue" items={data.services} render={(x:any)=><Row title={x.name||"Service"} subtitle={(x.category||"")+" • "+(x.professional_count||0)+" professionals"} meta={x.is_active?"Active":"Inactive"}/>} />}\n   {tab==="jobs"&&<List title="Jobs & Work" items={data.jobs} render={(x:any)=><Row title={x.title||"Work"} subtitle={(x.customer_name||"Customer")+" → "+(x.professional_name||"Professional")} meta={(x.status||"")+" • ₹"+Number(x.agreed_amount_inr||0).toLocaleString("en-IN")}/>} />}
   {tab==="payments"&&<List title="Payments" items={data.payments} render={(x:any)=><Row title={(x.customer_name||"Customer")+" • "+(x.package_code||"Package")} subtitle={"₹"+Number(x.amount_inr||0).toLocaleString("en-IN")} meta={x.status||"unknown"}/>} />}
   {tab==="notifications"&&<List title="Notifications" items={data.notifications} render={(x:any)=><Row title={x.title||"Notification"} subtitle={(x.user_name||"User")+" • "+(x.type||"notification")} meta={x.push_sent_at?"Sent":x.push_error?"Failed":"Pending"}/>} />}\n   {tab==="complaints"&&<List title="Complaints & disputes" items={data.complaints} render={(x:any)=><Row title={(x.category||"Complaint").replaceAll("_"," ")} subtitle={(x.reporter_name||"User")+" reported "+(x.against_name||"User")} meta={x.status||"open"}/>} />}
   {tab==="portfolio"&&<List title="Portfolio moderation" items={data.portfolio} render={(x:any)=><Row title={x.title||"Portfolio item"} subtitle={x.professional_name||"Professional"} meta={x.moderation_status||"pending"}/>} />}
   {tab==="audit"&&<List title="Audit logs" items={data.audit} render={(x:any)=><Row title={(x.action||"action")+" • "+(x.entity_type||"entity")} subtitle={x.actor_name||"Admin"} meta={new Date(x.created_at).toLocaleString()}/>} />}
  </ScrollView>
 </View>
}

function Section({title,children}:{title:string;children:any}){return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>}
function List({title,items,render}:{title:string;items:any[];render:(x:any)=>any}){return <Section title={title}>{!items.length?<Text style={s.muted}>No records found.</Text>:items.map((x:any)=><View key={x.id||x.user_id||x.document_id}>{render(x)}</View>)}</Section>}
function Row({title,subtitle,meta}:{title:string;subtitle:string;meta:string}){return <View style={s.row}><View style={{flex:1}}><Text style={s.rowTitle}>{title}</Text><Text style={s.muted}>{subtitle}</Text></View><Text style={s.badge}>{meta}</Text></View>}

const s=StyleSheet.create({
 page:{flex:1,backgroundColor:"#f5f7f6"},center:{flex:1,justifyContent:"center",alignItems:"center",padding:24,backgroundColor:"#f5f7f6"},login:{width:"100%",maxWidth:440,backgroundColor:"#fff",padding:28,borderRadius:18},logo:{fontSize:18,fontWeight:"800",color:"#087f68",letterSpacing:1},title:{fontSize:28,fontWeight:"800",marginTop:6,marginBottom:8},muted:{color:"#66706d",fontSize:14},input:{borderWidth:1,borderColor:"#d9dfdc",borderRadius:10,padding:13,marginTop:12,backgroundColor:"#fff"},primary:{backgroundColor:"#087f68",padding:14,borderRadius:10,alignItems:"center",marginTop:14},primaryText:{color:"#fff",fontWeight:"800"},secondary:{borderWidth:1,borderColor:"#d4dad7",backgroundColor:"#fff",paddingHorizontal:14,paddingVertical:10,borderRadius:10,alignItems:"center"},error:{color:"#b42318",marginTop:12},header:{paddingHorizontal:24,paddingVertical:18,paddingTop:28,flexDirection:"row",justifyContent:"space-between",alignItems:"center",backgroundColor:"#fff"},tabs:{paddingHorizontal:16,paddingVertical:10,gap:8,backgroundColor:"#fff",alignItems:"center",minHeight:54},tab:{paddingHorizontal:14,paddingVertical:10,borderRadius:10,borderWidth:1,borderColor:"#dde3e0",alignSelf:"center",height:40},tabActive:{paddingHorizontal:14,paddingVertical:10,borderRadius:10,backgroundColor:"#087f68",alignSelf:"center",height:40},tabText:{fontWeight:"700",color:"#37413e"},tabTextActive:{fontWeight:"800",color:"#fff"},body:{flex:1},bodyInner:{paddingHorizontal:24,paddingTop:18,paddingBottom:40,maxWidth:1400,width:"100%",alignSelf:"center"},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},metric:{backgroundColor:"#fff",borderRadius:14,padding:16,width:"31%",minWidth:150,gap:6},metricValue:{fontSize:28,fontWeight:"800"},section:{backgroundColor:"#fff",borderRadius:16,padding:18,marginTop:14},sectionTitle:{fontSize:20,fontWeight:"800",marginBottom:12},row:{flexDirection:"row",alignItems:"center",gap:12,borderTopWidth:1,borderTopColor:"#edf0ef",paddingVertical:14},rowTitle:{fontSize:16,fontWeight:"800"},badge:{fontSize:12,fontWeight:"800",maxWidth:180,textAlign:"right"}
});
