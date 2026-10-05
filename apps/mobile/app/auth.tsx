import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase,getAuthRedirect } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";

type Method="otp"|"email";

export default function AuthScreen(){
 const params=useLocalSearchParams<{mode?:string}>();
 const [mode,setMode]=useState<"customer"|"professional">(params.mode==="professional"?"professional":"customer");
 const [method,setMethod]=useState<Method>("otp");
 const [phone,setPhone]=useState(""); const [otp,setOtp]=useState("");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
 const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false);

 async function sendOtp(){
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Please enter a valid 10-digit mobile number.");
  setBusy(true);
  try{const{error}=await supabase.auth.signInWithOtp({phone:"+91"+phone.replace(/\D/g,"").slice(-10),options:{data:{initial_mode:mode}}});if(error)throw error;setSent(true);}
  catch(e){Alert.alert("Unable to send OTP",e instanceof Error?e.message:"Please try again.");}
  finally{setBusy(false);}
 }
 async function verifyOtp(){
  if(otp.trim().length<4)return Alert.alert("Enter OTP","Please enter the OTP you received.");
  setBusy(true);
  try{const{error}=await supabase.auth.verifyOtp({phone:"+91"+phone.replace(/\D/g,"").slice(-10),token:otp.trim(),type:"sms"});if(error)throw error;router.replace("/home");}
  catch(e){Alert.alert("OTP verification failed",e instanceof Error?e.message:"Please try again.");}
  finally{setBusy(false);}
 }
 async function emailLogin(){
  if(!email.includes("@")||password.length<6)return Alert.alert("Check details","Enter a valid email and a password of at least 6 characters.");
  setBusy(true);
  try{const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;router.replace("/home");}
  catch(e){Alert.alert("Email sign in failed",e instanceof Error?e.message:"Please try again.");}
  finally{setBusy(false);}
 }
 async function emailSignup(){
  if(!email.includes("@")||password.length<6)return Alert.alert("Check details","Enter a valid email and a password of at least 6 characters.");
  setBusy(true);
  try{const{data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{initial_mode:mode},emailRedirectTo:getAuthRedirect()}});if(error)throw error;if(data.session)router.replace("/home");else Alert.alert("Check your email","We sent a confirmation link to your email address.");}
  catch(e){Alert.alert("Account creation failed",e instanceof Error?e.message:"Please try again.");}
  finally{setBusy(false);}
 }
 async function google(){
  setBusy(true);
  try{
   const{data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:getAuthRedirect(),skipBrowserRedirect:Platform.OS==="web"}});
   if(error)throw error;
   if(Platform.OS==="web"&&data.url)window.location.assign(data.url);
  }catch(e){Alert.alert("Google sign in unavailable",e instanceof Error?e.message:"Please configure Google in Supabase Auth.");}
  finally{setBusy(false);}
 }

 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><View style={s.container}>
  <VasudhaLogo/>
  <Text style={s.heading}>Welcome Back</Text>
  <Text style={s.sub}>Sign in to continue</Text>
  <View style={s.tabs}>
   <Pressable onPress={()=>setMethod("otp")} style={[s.tab,method==="otp"&&s.tabOn]}><Text style={[s.tabText,method==="otp"&&s.tabTextOn]}>Mobile OTP</Text></Pressable>
   <Pressable onPress={()=>setMethod("email")} style={[s.tab,method==="email"&&s.tabOn]}><Text style={[s.tabText,method==="email"&&s.tabTextOn]}>Email</Text></Pressable>
  </View>
  {method==="otp"?(
   !sent?<><View style={s.phoneRow}><View style={s.code}><Text>🇮🇳 +91</Text></View><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" style={s.phone}/></View>
   <Pressable disabled={busy} onPress={sendOtp} style={s.primary}><Text style={s.primaryText}>{busy?"Sending…":"Send OTP"}</Text></Pressable></>
   :<><Text style={s.otpLabel}>Enter OTP sent to +91 {phone}</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} placeholder="••••••" style={s.otp}/><Pressable disabled={busy} onPress={verifyOtp} style={s.primary}><Text style={s.primaryText}>{busy?"Verifying…":"Verify & Continue"}</Text></Pressable><Pressable onPress={()=>setSent(false)}><Text style={s.change}>Change mobile number</Text></Pressable></>
  ):(
   <><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="Email address" style={s.input}/><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="Password" style={s.input}/><Pressable disabled={busy} onPress={emailLogin} style={s.primary}><Text style={s.primaryText}>{busy?"Signing in…":"Sign in with Email"}</Text></Pressable><Pressable disabled={busy} onPress={emailSignup}><Text style={s.create}>Create account with Email</Text></Pressable></>
  )}
  <View style={s.or}><View style={s.line}/><Text style={s.orText}>or</Text><View style={s.line}/></View>
  <Pressable disabled={busy} onPress={google} style={s.google}><Text style={s.googleG}>G</Text><Text style={s.googleText}>Continue with Google</Text></Pressable>
  <Text style={s.terms}>By continuing, you agree to our{"\n"}Terms & Conditions and Privacy Policy</Text>
  <Pressable onPress={()=>router.replace({pathname:"/select-mode",params:{mode}})}><Text style={s.switch}>{mode==="customer"?"Use VASUDHA as a Professional":"Use VASUDHA as a Customer"}</Text></Pressable>
 </View></KeyboardAvoidingView></SafeAreaView>
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#fff"},flex:{flex:1},container:{flex:1,padding:22,justifyContent:"center"},
 heading:{fontSize:26,fontWeight:"900",textAlign:"center",marginTop:28,color:"#13201c"},sub:{textAlign:"center",color:"#66736e",marginTop:5,marginBottom:16},
 tabs:{flexDirection:"row",backgroundColor:"#f2f7f5",borderRadius:12,padding:3,marginBottom:14},tab:{flex:1,height:40,alignItems:"center",justifyContent:"center",borderRadius:9},tabOn:{backgroundColor:"#fff"},tabText:{fontWeight:"800",color:"#66736e"},tabTextOn:{color:"#087D65"},
 phoneRow:{flexDirection:"row",borderWidth:1,borderColor:"#cfdad6",borderRadius:12,height:52,overflow:"hidden"},code:{paddingHorizontal:12,justifyContent:"center",backgroundColor:"#f7faf9",borderRightWidth:1,borderRightColor:"#cfdad6"},phone:{flex:1,paddingHorizontal:12,fontSize:16},
 input:{height:52,borderWidth:1,borderColor:"#cfdad6",borderRadius:12,paddingHorizontal:14,fontSize:16,marginBottom:10},primary:{height:52,borderRadius:12,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center",marginTop:12},primaryText:{color:"#fff",fontWeight:"900",fontSize:16},
 otpLabel:{fontSize:13,color:"#66736e",marginBottom:7},otp:{height:54,borderWidth:1,borderColor:"#cfdad6",borderRadius:12,textAlign:"center",fontSize:22,letterSpacing:8},change:{textAlign:"center",color:"#087D65",fontWeight:"800",marginTop:12},create:{textAlign:"center",color:"#087D65",fontWeight:"800",marginTop:14},
 or:{flexDirection:"row",alignItems:"center",gap:10,marginVertical:18},line:{height:1,backgroundColor:"#e2e8e5",flex:1},orText:{color:"#8a9691"},google:{height:50,borderWidth:1,borderColor:"#cfdad6",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12},googleG:{fontSize:20,fontWeight:"900"},googleText:{fontWeight:"700"},
 terms:{textAlign:"center",fontSize:11,color:"#7b8782",lineHeight:17,marginTop:22},switch:{textAlign:"center",color:"#087D65",fontWeight:"800",marginTop:14}
});