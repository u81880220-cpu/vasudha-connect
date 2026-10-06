import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { useAuth } from "../src/auth/AuthProvider";

type Plan={plan_id:string;code:string;name:string;description?:string|null;price_inr:number;billing_interval:string};
type Sub={plan_name:string;price_inr:number;billing_interval:string;status:string;current_period_end?:string|null};

const TEST_PAYMENT_MODE=(process.env.EXPO_PUBLIC_PAYMENT_PROVIDER||"test").toLowerCase()==="test";

export default function ProfessionalSubscription(){
 const{user}=useAuth();const[plans,setPlans]=useState<Plan[]>([]);const[sub,setSub]=useState<Sub|null>(null);const[loading,setLoading]=useState(true);const[creating,setCreating]=useState<string|null>(null);
 useEffect(()=>{load()},[user?.id]);
 async function load(){
  if(!user)return;setLoading(true);
  const [{data:p,error:pe},{data:s,error:se}]=await Promise.all([
   supabase.from("professional_subscription_plans").select("id,code,name,description,price_inr,billing_interval").eq("status","active").order("sort_order"),
   supabase.from("professional_subscriptions").select("status,current_period_end,professional_subscription_plans(name,price_inr,billing_interval)").eq("professional_id",user.id).in("status",["trial","active","past_due"]).maybeSingle()
  ]);
  if(pe||se){Alert.alert("Unable to load subscription",pe?.message||se?.message||"Please try again.");}
  setPlans((p||[]).map((x:any)=>({...x,plan_id:x.id})));
  const raw:any=s;if(raw){const plan=Array.isArray(raw.professional_subscription_plans)?raw.professional_subscription_plans[0]:raw.professional_subscription_plans;setSub({...raw,plan_name:plan?.name,price_inr:plan?.price_inr,billing_interval:plan?.billing_interval});}
  setLoading(false);
 }
 async function openCheckout(data:any,description:string){
  if(Platform.OS!=="web"||typeof window==="undefined"){Alert.alert("Payment gateway ready","The secure subscription order was created. Native Razorpay checkout will be connected in the mobile build.");return;}
  const w=window as any;
  const launch=()=>{if(!w.Razorpay){Alert.alert("Payment unavailable","Razorpay checkout could not be loaded.");return;}
   const checkout=new w.Razorpay({key:data.key_id,amount:data.amount,currency:data.currency,name:"VASUDHA CONNECT",description,order_id:data.razorpay_order_id,handler:()=>{Alert.alert("Payment submitted","Your subscription will activate after server confirmation.");setTimeout(load,2000)},theme:{color:"#087D65"}});
   checkout.on("payment.failed",(r:any)=>Alert.alert("Payment failed",r?.error?.description||"Please try again."));checkout.open();
  };
  if(w.Razorpay){launch();return;}
  try{await new Promise<void>((resolve,reject)=>{const script=document.createElement("script");script.src="https://checkout.razorpay.com/v1/checkout.js";script.onload=()=>resolve();script.onerror=()=>reject(new Error());document.head.appendChild(script)});launch()}catch{Alert.alert("Payment unavailable","Razorpay checkout could not be loaded.")}
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
   await load();
   Alert.alert("QA subscription active","Free test subscription activated for 30 days. No real payment was charged.");
   return;
  }
  const{data,error}=await supabase.functions.invoke("create-professional-subscription-order",{body:{plan_id:planId}});
  setCreating(null);
  if(error){Alert.alert("Unable to start subscription",error.message);return}
  await openCheckout(data,name);
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Text style={s.title}>Professional Subscription</Text>
  <Text style={s.sub}>Choose a VASUDHA CONNECT professional plan to stay active on the marketplace.</Text>
  {TEST_PAYMENT_MODE?<View style={s.testBanner}><Text style={s.testTitle}>TEST MODE · FREE SUBSCRIPTION</Text><Text style={s.muted}>No real payment is collected. The QA plan activates through a protected test flow.</Text></View>:null}
  {loading?<View style={s.center}><ActivityIndicator/><Text style={s.muted}>Loading plans…</Text></View>:sub?<View style={s.active}><Text style={s.activeTitle}>Subscription active</Text><Text>{sub.plan_name} • ₹{Number(sub.price_inr||0).toLocaleString("en-IN")} / {sub.billing_interval}</Text><Text style={s.muted}>Status: {sub.status} • Valid until {sub.current_period_end?new Date(sub.current_period_end).toLocaleDateString():"—"}</Text></View>:plans.length?plans.map(p=><View key={p.plan_id} style={s.card}><Text style={s.name}>{p.name}</Text>{p.description?<Text style={s.muted}>{p.description}</Text>:null}<Text style={s.price}>₹{Number(p.price_inr||0).toLocaleString("en-IN")} / {p.billing_interval}</Text><Pressable disabled={creating!==null} onPress={()=>subscribe(p.plan_id,p.name)} style={[s.primary,creating!==null&&s.disabled]}><Text style={s.primaryText}>{creating===p.plan_id?(TEST_PAYMENT_MODE?"Activating QA subscription…":"Creating secure order…"):(TEST_PAYMENT_MODE?"Activate Free QA Subscription":"Continue to payment")}</Text></Pressable></View>):<Text style={s.muted}>No professional subscription plans are available yet. Please check again later.</Text>}
  <View style={s.notice}><Text style={s.noticeTitle}>Important</Text><Text style={s.muted}>VASUDHA subscription payment covers your professional marketplace access. Service pricing and payment with customers remain directly between you and the customer.</Text></View>
  <Pressable style={s.secondary} onPress={()=>router.back()}><Text>Back</Text></Pressable>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},container:{padding:20,paddingBottom:50},title:{fontSize:28,fontWeight:"800",color:"#13201c"},sub:{marginTop:6,opacity:.65,lineHeight:20,marginBottom:18},testBanner:{borderWidth:1,borderColor:"#087D65",borderRadius:14,padding:14,marginBottom:14},testTitle:{fontWeight:"900",color:"#087D65"},card:{borderWidth:1,borderColor:"#e2e8e5",borderRadius:16,padding:16,marginBottom:12},name:{fontSize:19,fontWeight:"800"},price:{fontSize:21,fontWeight:"800",marginTop:12},muted:{opacity:.65,marginTop:5,lineHeight:19},primary:{marginTop:14,borderRadius:12,padding:13,alignItems:"center",backgroundColor:"#087D65"},disabled:{opacity:.55},primaryText:{color:"#fff",fontWeight:"800"},active:{borderWidth:1,borderColor:"#087D65",borderRadius:16,padding:16,marginBottom:16},activeTitle:{fontSize:18,fontWeight:"800",color:"#087D65",marginBottom:6},notice:{borderWidth:1,borderColor:"#e2e8e5",borderRadius:14,padding:14,marginTop:6},noticeTitle:{fontWeight:"800"},secondary:{borderWidth:1,borderColor:"#cfdad6",borderRadius:12,padding:13,alignItems:"center",marginTop:14},center:{alignItems:"center",paddingVertical:40}});
