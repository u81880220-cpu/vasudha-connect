import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";
import { startCashfreeCheckout } from "../src/lib/cashfree-checkout";

type Plan={plan_id:string;code:string;name:string;description?:string|null;price_inr:number;billing_interval:string};
type Sub={plan_name:string;price_inr:number;billing_interval:string;status:string;started_at?:string|null;current_period_start?:string|null;current_period_end?:string|null;cancelled_at?:string|null;plan_id?:string};
type Payment={id:string;amount_inr:number;status:string;provider?:string|null;created_at:string;provider_order_id?:string|null;provider_payment_id?:string|null};

const TEST_PAYMENT_MODE=(process.env.EXPO_PUBLIC_PAYMENT_PROVIDER||"test").toLowerCase()==="test";

export default function ProfessionalSubscription(){
 const{user}=useAuth();const[plans,setPlans]=useState<Plan[]>([]);const[sub,setSub]=useState<Sub|null>(null);const[payments,setPayments]=useState<Payment[]>([]);const[loading,setLoading]=useState(true);const[creating,setCreating]=useState<string|null>(null);
 useEffect(()=>{load()},[user?.id]);
 async function load(){
  if(!user)return;setLoading(true);
  const [{data:p,error:pe},{data:s,error:se},{data:pay,error:payErr}]=await Promise.all([
   supabase.from("professional_subscription_plans").select("id,code,name,description,price_inr,billing_interval").eq("status","active").order("sort_order"),
   supabase.from("professional_subscriptions").select("id,plan_id,status,started_at,current_period_start,current_period_end,cancelled_at,professional_subscription_plans(name,price_inr,billing_interval)").eq("professional_id",user.id).order("created_at",{ascending:false}).in("status",["trial","active","past_due","cancelled","expired"]).limit(1).maybeSingle(),
   supabase.from("professional_subscription_payment_orders").select("id,amount_inr,status,provider,created_at,provider_order_id,provider_payment_id").eq("professional_id",user.id).order("created_at",{ascending:false}).limit(10)
  ]);
  if(pe||se||payErr){Alert.alert("Unable to load subscription",pe?.message||se?.message||payErr?.message||"Please try again.");}
  setPlans((p||[]).map((x:any)=>({...x,plan_id:x.id})));
  const raw:any=s;if(raw){const plan=Array.isArray(raw.professional_subscription_plans)?raw.professional_subscription_plans[0]:raw.professional_subscription_plans;setSub({...raw,plan_id:raw.plan_id,plan_name:plan?.name,price_inr:plan?.price_inr,billing_interval:plan?.billing_interval});}
  setPayments((pay||[]) as Payment[]);
  setLoading(false);
 }
 async function openCheckout(data:any,description:string){
  if(!data?.payment_session_id||!data?.cashfree_order_id){
   Alert.alert("Payment unavailable","Cashfree did not return a valid payment session. No payment was taken.");return;
  }
  startCashfreeCheckout(data,description,()=>{
   Alert.alert("Payment submitted","KAMPRO will activate your subscription only after Cashfree confirms payment on the server.");
   void load();
  },(message:string)=>{
   Alert.alert("Payment not completed",message);
  });
 }
 async function subscribe(planId:string,name:string){
  setCreating(planId);
  if(TEST_PAYMENT_MODE){
   const{error}=await supabase.rpc("activate_free_professional_subscription",{p_plan_id:planId});
   setCreating(null);
   if(error){Alert.alert("Unable to activate QA subscription",error.message);return}
   const selectedPlan=plans.find(p=>p.plan_id===planId);
   if(selectedPlan){
    setSub({
     plan_name:selectedPlan.name,
     price_inr:selectedPlan.price_inr,
     billing_interval:selectedPlan.billing_interval,
     status:"active",
     current_period_end:new Date(Date.now()+30*24*60*60*1000).toISOString(),
    });
   }
   Alert.alert("QA subscription active","Free test subscription activated for 30 days. No real payment was charged.");
   return;
  }
  const{data,error}=await supabase.functions.invoke("create-cashfree-subscription-order",{body:{plan_id:planId}});
  setCreating(null);
  if(error){Alert.alert("Unable to start subscription",error.message);return}
  await openCheckout(data,name);
 }
 return <SafeAreaView style={s.safe} edges={["top"]}><ScrollView contentContainerStyle={s.container}>
  <Text style={s.title}>Professional Subscription</Text>
  <Text style={s.sub}>Choose a KAMPRO professional plan to stay active on the marketplace.</Text>
  {TEST_PAYMENT_MODE?<View style={s.testBanner}><Text style={s.testTitle}>TEST MODE · FREE SUBSCRIPTION</Text><Text style={s.muted}>No real payment is collected. The QA plan activates through a protected test flow.</Text></View>:null}
  {loading?<View style={s.center}><ActivityIndicator/><Text style={s.muted}>Loading subscription…</Text></View>:<>{sub?<View style={s.active}>
    <View style={s.activeHead}><View style={{flex:1}}><Text style={s.activeTitle}>{sub.plan_name||"Professional Plan"}</Text><Text style={s.statusBadge}>{sub.status==="active"?"ACTIVE":String(sub.status||"").toUpperCase()}</Text></View><Text style={s.price}>{sub.price_inr!=null?"₹"+Number(sub.price_inr).toLocaleString("en-IN"):"—"} / {sub.billing_interval||"period"}</Text></View>
    <View style={s.detailGrid}>
      <View style={s.detail}><Text style={s.detailLabel}>Activation date</Text><Text style={s.detailValue}>{sub.started_at?new Date(sub.started_at).toLocaleDateString():"—"}</Text></View>
      <View style={s.detail}><Text style={s.detailLabel}>Current period</Text><Text style={s.detailValue}>{sub.current_period_start?new Date(sub.current_period_start).toLocaleDateString():"—"}</Text></View>
      <View style={s.detail}><Text style={s.detailLabel}>{sub.status==="cancelled"?"Ends on":"Renewal / expiry"}</Text><Text style={s.detailValue}>{sub.current_period_end?new Date(sub.current_period_end).toLocaleDateString():"—"}</Text></View>
      <View style={s.detail}><Text style={s.detailLabel}>Auto renewal</Text><Text style={s.detailValue}>{sub.cancelled_at?"Off":"Managed by renewal flow"}</Text></View>
    </View>
    {sub.plan_id?<Pressable disabled={creating!==null} onPress={()=>subscribe(sub.plan_id!,sub.plan_name||"Renew subscription")} style={[s.primary,creating!==null&&s.disabled]}><Text style={s.primaryText}>{creating===sub.plan_id?"Creating secure order…":(TEST_PAYMENT_MODE?"Renew QA subscription":"Renew subscription")}</Text></Pressable>:null}
  </View>:null}
  <Text style={s.sectionTitle}>Available plans</Text>
  {plans.length?plans.map(p=><View key={p.plan_id} style={s.card}><Text style={s.name}>{p.name}</Text>{p.description?<Text style={s.muted}>{p.description}</Text>:null}<Text style={s.price}>₹{Number(p.price_inr||0).toLocaleString("en-IN")} / {p.billing_interval}</Text><Pressable disabled={creating!==null} onPress={()=>subscribe(p.plan_id,p.name)} style={[s.primary,creating!==null&&s.disabled]}><Text style={s.primaryText}>{creating===p.plan_id?(TEST_PAYMENT_MODE?"Activating QA subscription…":"Creating secure order…"):(TEST_PAYMENT_MODE?"Activate Free QA Subscription":"Continue to payment")}</Text></Pressable></View>):<Text style={s.muted}>No professional subscription plans are available yet. Please check again later.</Text>}
  <Text style={s.sectionTitle}>Payment history</Text>
  {payments.length?payments.map(x=><View key={x.id} style={s.paymentRow}><View style={{flex:1}}><Text style={s.paymentTitle}>₹{Number(x.amount_inr||0).toLocaleString("en-IN")}</Text><Text style={s.muted}>{x.created_at?new Date(x.created_at).toLocaleString():"—"}{x.provider?" • "+x.provider:""}</Text></View><Text style={s.paymentStatus}>{x.status}</Text></View>):<Text style={s.muted}>No subscription payment orders yet.</Text>}
  <View style={s.notice}><Text style={s.noticeTitle}>Important</Text><Text style={s.muted}>KAMPRO subscription payment covers your professional marketplace access. Service pricing and payment with customers remain directly between you and the customer.</Text></View>
  <Pressable style={s.secondary} onPress={()=>router.back()}><Text style={s.secondaryText}>Back</Text></Pressable>
  </>}
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({sectionTitle:{fontSize:18,fontWeight:"900",color:"#10233F",marginTop:18,marginBottom:10},activeHead:{flexDirection:"row",alignItems:"flex-start",gap:10},statusBadge:{alignSelf:"flex-start",marginTop:6,fontSize:11,fontWeight:"900",color:"#087D65"},detailGrid:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:14},detail:{width:"48%",borderWidth:1,borderColor:"#E7EAF0",borderRadius:10,padding:10},detailLabel:{fontSize:10,color:"#6B7280"},detailValue:{fontSize:12,fontWeight:"800",color:"#10233F",marginTop:3},paymentRow:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:12,padding:12,marginBottom:8,flexDirection:"row",alignItems:"center"},paymentTitle:{fontSize:15,fontWeight:"900",color:"#10233F"},paymentStatus:{fontSize:11,fontWeight:"900",color:"#087D65",textTransform:"uppercase"},safe:{flex:1,backgroundColor:"#fff"},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800",color:"#10233F"},sub:{marginTop:6,color:"#6B7280",lineHeight:20,marginBottom:18},testBanner:{borderWidth:1,borderColor:"#FF4B1F",borderRadius:14,padding:14,marginBottom:14},testTitle:{fontWeight:"900",color:"#FF4B1F"},card:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,padding:16,marginBottom:12},name:{fontSize:19,fontWeight:"800",color:"#10233F"},price:{fontSize:21,fontWeight:"800",marginTop:12,color:"#10233F"},muted:{color:"#6B7280",marginTop:5,lineHeight:19},primary:{marginTop:14,borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#FF4B1F"},disabled:{opacity:.55},primaryText:{color:"#fff",fontWeight:"800"},active:{borderWidth:1,borderColor:"#FF4B1F",borderRadius:16,padding:16,marginBottom:16},activeTitle:{fontSize:18,fontWeight:"800",color:"#FF4B1F",marginBottom:6},notice:{borderWidth:1,borderColor:"#E7EAF0",borderRadius:14,padding:14,marginTop:6},noticeTitle:{fontWeight:"800",color:"#10233F"},secondary:{borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,padding:13,alignItems:"center",marginTop:14},secondaryText:{color:"#10233F",fontWeight:"800"},center:{alignItems:"center",paddingVertical:40}});
