import { router, useLocalSearchParams } from "expo-router";
import { FunctionsFetchError, FunctionsRelayError } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Msg91RegistrationWidget } from "../src/components/Msg91RegistrationWidget";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { useKamproLanguage } from "../src/i18n/LanguageProvider";

// Keep client-side validation aligned with the mobile-login and msg91-register Edge Functions.
const PASSWORD_MIN_LENGTH = 6;

async function edgeFunctionError(error: unknown, fallback: string): Promise<Error> {
 const e = error as { message?: string; context?: { clone?: () => { json?: () => Promise<unknown> }; json?: () => Promise<unknown> } };
 if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
  return new Error("Could not reach KAMPRO sign-in service. Check your internet connection or switch between Wi-Fi and mobile data, then try again.");
 }
 const response = e?.context;
 if (response) {
  try {
   const readable = typeof response.clone === "function" ? response.clone() : response;
   const payload = typeof readable.json === "function" ? await readable.json() : null;
   if (payload && typeof payload === "object") {
    const details = payload as { error?: unknown; message?: unknown };
    if (typeof details.error === "string" && details.error.trim()) return new Error(details.error);
    if (typeof details.message === "string" && details.message.trim()) return new Error(details.message);
   }
  } catch {
   // Keep a safe fallback when the Edge Function response is not JSON.
  }
 }
 return new Error(e?.message || fallback);
}

async function invokeMobileLogin(body: {phone:string;password:string}) {
 let result = await supabase.functions.invoke("mobile-login", { body });
 if (result.error instanceof FunctionsFetchError || result.error instanceof FunctionsRelayError) {
  // Retry only transport/relay failures. Never retry invalid credentials or server responses.
  console.warn("KAMPRO mobile-login transport failed; retrying once", result.error.name);
  await new Promise(resolve => setTimeout(resolve, 800));
  result = await supabase.functions.invoke("mobile-login", { body });
 }
 return result;
}

function friendlyAuthError(error: unknown, flow: "login" | "signup" | "reset" | "general" = "general") {
 const e = error as { message?: string; code?: string; status?: number };
 const message = (e?.message ?? "").toLowerCase();
 const code = (e?.code ?? "").toLowerCase();
 if (flow === "login" && (message.includes("invalid login credentials") || message.includes("invalid credentials") || message.includes("wrong password") || code === "invalid_credentials")) return "Incorrect email/mobile number or password. Please check your details and try again.";
 if (flow === "signup" && (code.includes("user_already_exists") || code.includes("email_exists") || message.includes("already registered") || message.includes("already been registered") || message.includes("user already registered") || message.includes("email address is already"))) return "An account may already exist with these details. Please sign in or use Forgot password/PIN.";
 if (message.includes("email not confirmed")) return "Please verify your email using the confirmation link we sent before logging in.";
 if (message.includes("password should be at least") || message.includes("password must be")) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
 if (message.includes("rate limit") || message.includes("too many requests")) return "Too many attempts. Please wait a little while and try again.";
 if (message.includes("network") || message.includes("fetch")) return "We couldn’t connect. Check your internet connection and try again.";
 if (flow === "reset") return e?.message?.trim() || "Password reset failed. Please try again shortly.";
 if (flow === "login") return "We couldn’t sign you in. Check your details and try again.";
 if (flow === "signup") return "We couldn’t create your account. Please check your details and try again.";
 return "Something went wrong. Please try again.";
}

export default function AuthScreen(){
 const {t}=useKamproLanguage();
 const params=useLocalSearchParams<{mode?:string}>();
 const [mode,setMode]=useState<"customer"|"professional">(params.mode==="professional"?"professional":"customer");
 const [modeChosen,setModeChosen]=useState(params.mode==="customer"||params.mode==="professional");
 const [phone,setPhone]=useState(""); const [otp,setOtp]=useState("");
 const [password,setPassword]=useState(""); const [fullName,setFullName]=useState("");
 const [showPassword,setShowPassword]=useState(false); const [showConfirmPassword,setShowConfirmPassword]=useState(false);
 const [accountMode,setAccountMode]=useState<"login"|"signup">("login");
 const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false); const [showMsg91Widget,setShowMsg91Widget]=useState(false); const [confirmPassword,setConfirmPassword]=useState(""); const [mobileRecovery,setMobileRecovery]=useState(false); const [pinRecoveryReady,setPinRecoveryReady]=useState(false); const [recoveryAccessToken,setRecoveryAccessToken]=useState(""); const [feedback,setFeedback]=useState<{kind:"error"|"success";text:string}|null>(null);

 // Login handlers own navigation after successful authentication. Avoid a second
 // SIGNED_IN-triggered router.replace racing with the explicit navigation below.
 useEffect(()=>{if(params.mode==="customer"||params.mode==="professional"){setMode(params.mode);setModeChosen(true);}},[params.mode]);

 async function verifyOtp(){
  if(otp.trim().length<4)return Alert.alert("Enter OTP","Please enter the OTP you received.");
  setBusy(true);
  try{
   const{data,error}=await supabase.auth.verifyOtp({phone:"+91"+phone.replace(/\D/g,"").slice(-10),token:otp.trim(),type:"sms"});if(error)throw error;
   if(mobileRecovery){setMobileRecovery(false);setPinRecoveryReady(true);setSent(false);setOtp("");return;}
   if(accountMode==="signup"&&data.user&&fullName.trim())await supabase.from("profiles").update({full_name:fullName.trim(),display_name:fullName.trim()}).eq("id",data.user.id);
   const{error:modeError}=await supabase.rpc("switch_app_mode",{p_mode:mode});if(modeError)throw modeError;router.replace("/home");
  }catch(e){Alert.alert("OTP verification failed",e instanceof Error?e.message:"Please try again.");}
  finally{setBusy(false);}
 }
 async function mobileLogin(){
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Please enter a valid 10-digit mobile number.");
  if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("Enter PIN/password",`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  setBusy(true);
  try{
   const {data,error}=await invokeMobileLogin({phone:"+91"+phone.replace(/\D/g,"").slice(-10),password});
   if(error)throw await edgeFunctionError(error,"Mobile sign-in request failed.");
   if(!data?.access_token||!data?.refresh_token)throw new Error(typeof data?.error==="string"?data.error:"We couldn't sign you in. Check your details and try again.");
   const {data:sessionData,error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
   const signedInUser=sessionData.session?.user;
   if(signedInUser){
    const normalizedPhone="+91"+phone.replace(/\D/g,"").slice(-10);
    const {error:contactError}=await supabase.from("user_contact_details").upsert({user_id:signedInUser.id,phone:normalizedPhone,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(contactError)console.warn("KAMPRO: mobile number profile sync failed",contactError.message);
   }
   router.replace("/home");
  }catch(e){Alert.alert("Sign-in unsuccessful",e instanceof Error?e.message:friendlyAuthError(e,"login"));}
  finally{setBusy(false);}
 }
 async function mobileSignup(){
  if(!modeChosen)return Alert.alert("Choose account type","Select Customer or Professional before creating your account.");
  // The MSG91 registration widget is currently supported in the Android app only.
  // Do not open the placeholder web component, which cannot complete OTP verification.
  if(Platform.OS==="web"){
   const message="New account registration is currently available in the KAMPRO Android app using mobile OTP. After registering, use your mobile number and password to sign in on the website.";
   setFeedback({kind:"error",text:message});
   Alert.alert("Mobile registration unavailable on web",message);
   return;
  }
  if(fullName.trim().length<2)return Alert.alert("Enter your name","Please enter your full name before creating your account.");
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Please enter a valid 10-digit mobile number.");
  if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("PIN/password too short",`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if(password!==confirmPassword)return Alert.alert("PIN/passwords do not match","Enter the same PIN/password in both fields.");
  if(!process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH)return Alert.alert("OTP setup incomplete","KAMPRO's MSG91 widget token has not been configured for this build. Please configure EXPO_PUBLIC_MSG91_TOKEN_AUTH in the mobile build environment.");
  setFeedback(null);
  setShowMsg91Widget(true);
 }
 async function completeMsg91Registration(result: {success?:boolean; identifier?:string; message?:string}){
  setShowMsg91Widget(false);
  if(!result?.success){setMobileRecovery(false);return Alert.alert("Mobile verification failed",result?.message||"MSG91 could not verify this mobile number. Please try again.");}
  const enteredPhone="+91"+phone.replace(/\D/g,"").slice(-10);
  const verifiedDigits=(result.identifier||"").replace(/\D/g,"");
  const normalizedVerified=verifiedDigits.length===10?"91"+verifiedDigits:verifiedDigits;
  if(normalizedVerified!==enteredPhone.replace(/\D/g,"")){setMobileRecovery(false);return Alert.alert("Mobile number mismatch","The number verified by MSG91 does not match the number entered. Please retry with the same number.");}
  const accessToken=result.message||"";
  if(accessToken.length<20)return Alert.alert("Verification response incomplete","MSG91 did not return a valid verification token. Please retry.");
  if(mobileRecovery){setRecoveryAccessToken(accessToken);setMobileRecovery(false);setPinRecoveryReady(true);setOtp("");setFeedback({kind:"success",text:"Mobile verified. Choose a new password."});return;}
  setBusy(true);
  try{
   const {data,error}=await supabase.functions.invoke("msg91-register",{body:{accessToken,phone:enteredPhone,password,fullName:fullName.trim(),mode}});
   if(error)throw await edgeFunctionError(error,"Registration service request failed.");
   if(!data?.success)throw new Error(typeof data?.error==="string"?data.error:"KAMPRO could not complete registration.");
   const {data:loginData,error:loginError}=await invokeMobileLogin({phone:enteredPhone,password});
   if(loginError||!loginData?.access_token||!loginData?.refresh_token)throw new Error("Your account was created and your mobile was verified, but automatic sign-in failed. Please sign in using the same mobile number and password.");
   const {data:sessionData,error:sessionError}=await supabase.auth.setSession({access_token:loginData.access_token,refresh_token:loginData.refresh_token});
   if(sessionError)throw new Error("Account created, but automatic sign-in could not be completed. Please sign in again.");
   const signedInUser=sessionData.session?.user;
   if(signedInUser){
    const {error:contactError}=await supabase.from("user_contact_details").upsert({user_id:signedInUser.id,phone:enteredPhone,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(contactError)console.warn("KAMPRO: registration succeeded but mobile profile sync failed",contactError.message);
   }
   const {error:modeError}=await supabase.rpc("switch_app_mode",{p_mode:mode});
   if(modeError)throw new Error("Account created, but account type setup did not finish. Please sign in again.");
   router.replace("/home");
  }catch(e){
   const message=e instanceof Error?e.message:"Please try again.";
   setFeedback({kind:"error",text:message});
   Alert.alert("Couldn’t create account",message);
  }finally{setBusy(false);}
 }
 async function startMobileRecovery(){
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Enter the mobile number linked to your KAMPRO account first.");
  if(Platform.OS==="web")return Alert.alert("Use KAMPRO Android app","Mobile password recovery through MSG91 is currently supported in the Android app. Please open KAMPRO on your Android phone.");
  if(!process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH||!process.env.EXPO_PUBLIC_MSG91_WIDGET_ID)return Alert.alert("Recovery unavailable","Mobile recovery is not configured in this app build. Please contact KAMPRO support.");
  setRecoveryAccessToken("");setPinRecoveryReady(false);setMobileRecovery(true);setShowMsg91Widget(true);
 }
 async function updateMobilePin(){
  if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("Password too short",`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  if(password!==confirmPassword)return Alert.alert("Passwords do not match","Enter the same password in both fields.");
  if(recoveryAccessToken.length<20)return Alert.alert("Verify your mobile number","Please complete mobile verification again.");
  setBusy(true);
  try{
   const{data,error}=await supabase.functions.invoke("mobile-password-recovery",{body:{accessToken:recoveryAccessToken,phone:"+91"+phone.replace(/\D/g,"").slice(-10),newPassword:password}});
   if(error)throw await edgeFunctionError(error,"Password recovery request failed.");
   if(!data?.success)throw new Error(typeof data?.error==="string"?data.error:"Unable to reset password. Please try again.");
   setPinRecoveryReady(false);setMobileRecovery(false);setRecoveryAccessToken("");setPassword("");setConfirmPassword("");setOtp("");setSent(false);setFeedback({kind:"success",text:"Password updated. Please sign in with your mobile number and new password."});Alert.alert("Password updated","Your password has been reset. Please sign in using your mobile number and new password.");
  }catch(e){Alert.alert("Unable to reset password",e instanceof Error?e.message:"Please verify your mobile number and try again.");}
  finally{setBusy(false);}
 }
 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><ScrollView style={s.flex} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
  <View style={{alignItems:"flex-end",marginBottom:10}}><LanguageSwitch/></View>
  <VasudhaLogo/>
  <Text style={s.heading}>{t("welcomeBack")}</Text>
  <Text style={s.sub}>{accountMode==="signup"?t("createAccount"):t("signInContinue")}</Text>
  {accountMode==="signup"&&<View style={s.modePicker}><Text style={s.modeLabel}>I want to use KAMPRO as</Text><View style={s.modeOptions}><Pressable accessibilityRole="button" accessibilityState={{selected:modeChosen&&mode==="customer"}} onPress={()=>{setMode("customer");setModeChosen(true);}} style={[s.modeOption,modeChosen&&mode==="customer"&&s.modeOptionOn]}><Text style={[s.modeOptionText,modeChosen&&mode==="customer"&&s.modeOptionTextOn]}>Customer</Text><Text style={s.modeOptionSub}>Find trusted professionals</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{selected:modeChosen&&mode==="professional"}} onPress={()=>{setMode("professional");setModeChosen(true);}} style={[s.modeOption,modeChosen&&mode==="professional"&&s.modeOptionOn]}><Text style={[s.modeOptionText,modeChosen&&mode==="professional"&&s.modeOptionTextOn]}>Professional</Text><Text style={s.modeOptionSub}>Offer your services</Text></Pressable></View>{!modeChosen&&<Text style={s.modeHint}>Please select one to continue.</Text>}</View>}
  {accountMode==="signup"&&<TextInput value={fullName} onChangeText={setFullName} placeholder={t("fullName")} placeholderTextColor="#7B8794" style={s.input} autoCapitalize="words"/>}
  {pinRecoveryReady?<><Text style={s.otpLabel}>Choose a new PIN/password for +91 {phone}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholder="New password (6+ characters)" placeholderTextColor="#7B8794" style={s.input}/><Pressable accessibilityRole="button" onPress={()=>setShowPassword(v=>!v)}><Text style={s.change}>{showPassword?"Hide password":"Show password"}</Text></Pressable><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} autoCapitalize="none" placeholder="Confirm new PIN/password" placeholderTextColor="#7B8794" style={s.input}/><Pressable accessibilityRole="button" onPress={()=>setShowConfirmPassword(v=>!v)}><Text style={s.change}>{showConfirmPassword?"Hide confirmation":"Show confirmation"}</Text></Pressable><Pressable disabled={busy} onPress={updateMobilePin} style={s.primary}><Text style={s.primaryText}>{busy?"Updating…":"Set new PIN/password"}</Text></Pressable></>
   :sent?<><Text style={s.otpLabel}>{mobileRecovery?"Enter recovery OTP sent to":"Enter confirmation OTP sent to"} +91 {phone}</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} placeholder="••••••" placeholderTextColor="#7B8794" style={s.otp}/><Pressable disabled={busy} onPress={verifyOtp} style={s.primary}><Text style={s.primaryText}>{busy?"Verifying…":mobileRecovery?"Verify and set new PIN":"Verify mobile number"}</Text></Pressable><Pressable onPress={()=>{setSent(false);setMobileRecovery(false);}}><Text style={s.change}>Change mobile number</Text></Pressable></>
   :<><View style={s.phoneRow}><View style={s.code}><Text>🇮🇳 +91</Text></View><TextInput testID="auth-mobile-input" accessibilityLabel="KAMPRO mobile number" nativeID="auth-mobile-input" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor="#7B8794" style={s.phone}/></View>{accountMode==="login"?<><TextInput testID="auth-mobile-password" accessibilityLabel="KAMPRO PIN/password" nativeID="auth-mobile-password" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholder="Password (6+ characters)" placeholderTextColor="#7B8794" style={s.input}/><Pressable accessibilityRole="button" onPress={()=>setShowPassword(v=>!v)}><Text style={s.change}>{showPassword?"Hide password":"Show password"}</Text></Pressable></>:<><TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholder="Create password (6+ characters)" placeholderTextColor="#7B8794" style={s.input}/><Pressable accessibilityRole="button" onPress={()=>setShowPassword(v=>!v)}><Text style={s.change}>{showPassword?"Hide password":"Show password"}</Text></Pressable><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showConfirmPassword} autoCapitalize="none" placeholder="Confirm PIN/password" placeholderTextColor="#7B8794" style={s.input}/><Pressable accessibilityRole="button" onPress={()=>setShowConfirmPassword(v=>!v)}><Text style={s.change}>{showConfirmPassword?"Hide confirmation":"Show confirmation"}</Text></Pressable></>}<Pressable testID="auth-mobile-submit" accessibilityLabel="Continue with mobile number" disabled={busy} onPress={accountMode==="signup"?mobileSignup:mobileLogin} style={[s.primary,busy&&s.primaryBusy]}><Text style={s.primaryText}>{busy?(accountMode==="signup"?"Creating account…":"Signing in…"):(accountMode==="signup"?t("createMobileAccount"):t("signInMobile"))}</Text></Pressable>{accountMode==="login"&&<Pressable disabled={busy} onPress={startMobileRecovery}><Text style={s.change}>Forgot password?</Text></Pressable>}{accountMode==="login"&&<Pressable disabled={busy} onPress={()=>setAccountMode("signup")}><Text style={s.create}>{t("newAccount")}</Text></Pressable>}{accountMode==="signup"&&<Pressable onPress={()=>setAccountMode("login")}><Text style={s.change}>{t("existingAccount")}</Text></Pressable>}</>}
  {feedback&&<Text accessibilityRole="alert" style={[s.feedback,feedback.kind==="error"?s.feedbackError:s.feedbackSuccess]}>{feedback.text}</Text>}
  <Text style={s.terms}>By continuing, you agree to our{"\n"}Terms & Conditions and Privacy Policy</Text>
  {showMsg91Widget&&<Msg91RegistrationWidget visible={showMsg91Widget} onClose={()=>{setShowMsg91Widget(false);setMobileRecovery(false);}} onCompletion={(result)=>{void completeMsg91Registration(result as {success?:boolean;identifier?:string;message?:string});}} widgetId={process.env.EXPO_PUBLIC_MSG91_WIDGET_ID||""} tokenAuth={process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH||""} />}
  {accountMode==="login"&&<Pressable onPress={()=>router.push("/select-mode")}><Text style={s.switch}>Choose Customer or Professional</Text></Pressable>}
 </ScrollView></KeyboardAvoidingView></SafeAreaView>
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:KAMPRO.background},flex:{flex:1},container:{flexGrow:1,paddingHorizontal:22,paddingVertical:24,justifyContent:"center",width:"100%",maxWidth:520,alignSelf:"center"},
 heading:{fontSize:26,fontWeight:"900",textAlign:"center",marginTop:28,color:"#10233F"},sub:{textAlign:"center",color:"#6B7280",marginTop:5,marginBottom:16},
 tabs:{flexDirection:"row",backgroundColor:"#F7F8FA",borderRadius:12,padding:3,marginBottom:14},tab:{flex:1,height:40,alignItems:"center",justifyContent:"center",borderRadius:9},tabOn:{backgroundColor:"#fff"},tabText:{fontWeight:"800",color:"#6B7280"},tabTextOn:{color:"#FF4B1F"},
 phoneRow:{flexDirection:"row",borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,height:52,overflow:"hidden"},code:{paddingHorizontal:12,justifyContent:"center",backgroundColor:"#f7faf9",borderRightWidth:1,borderRightColor:"#CBD0D8"},phone:{flex:1,paddingHorizontal:12,fontSize:16,color:"#10233F",backgroundColor:"#fff"},
 input:{height:52,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,paddingHorizontal:14,fontSize:16,marginBottom:10,color:"#10233F",backgroundColor:"#fff"},primary:{height:52,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:12},primaryText:{color:"#fff",fontWeight:"900",fontSize:16},primaryBusy:{opacity:0.75},feedback:{textAlign:"center",fontSize:13,fontWeight:"700",marginTop:12,lineHeight:19},feedbackError:{color:"#B42318"},feedbackSuccess:{color:"#137547"},
 otpLabel:{fontSize:13,color:"#6B7280",marginBottom:7},otp:{height:54,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,textAlign:"center",fontSize:22,letterSpacing:8,color:"#10233F",backgroundColor:"#fff"},change:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:12},create:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:14},
 or:{flexDirection:"row",alignItems:"center",gap:10,marginVertical:18},line:{height:1,backgroundColor:"#E7EAF0",flex:1},orText:{color:"#596575",fontWeight:"600"},google:{height:50,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12},googleG:{fontSize:20,fontWeight:"900",color:"#10233F"},googleText:{fontWeight:"700",color:"#10233F"},
 modePicker:{marginBottom:12},modeLabel:{fontSize:13,fontWeight:"800",color:"#10233F",marginBottom:8},modeOptions:{flexDirection:"row",gap:10},modeOption:{flex:1,minHeight:76,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,backgroundColor:"#fff",padding:10,justifyContent:"center"},modeOptionOn:{borderWidth:2,borderColor:"#FF4B1F",backgroundColor:"#FFF5F1"},modeOptionText:{fontSize:15,fontWeight:"900",color:"#10233F"},modeOptionTextOn:{color:"#E5441B"},modeOptionSub:{fontSize:10,color:"#6B7280",marginTop:4},modeHint:{fontSize:11,color:"#B42318",marginTop:6},
 terms:{textAlign:"center",fontSize:11,color:"#596575",lineHeight:17,marginTop:22},switch:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:14}
});