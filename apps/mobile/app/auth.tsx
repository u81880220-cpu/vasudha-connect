import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase,getAuthRedirect } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { useKamproLanguage } from "../src/i18n/LanguageProvider";

type Method="mobile"|"email";

function friendlyAuthError(error: unknown, flow: "login" | "signup" | "reset" | "general" = "general") {
 const e = error as { message?: string; code?: string; status?: number };
 const message = (e?.message ?? "").toLowerCase();
 const code = (e?.code ?? "").toLowerCase();
 if (flow === "login" && (message.includes("invalid login credentials") || message.includes("invalid credentials") || message.includes("wrong password") || code === "invalid_credentials")) return "Incorrect email/mobile number or password. Please check your details and try again.";
 if (flow === "signup" && (code.includes("user_already_exists") || code.includes("email_exists") || message.includes("already registered") || message.includes("already been registered") || message.includes("user already registered") || message.includes("email address is already"))) return "An account may already exist with these details. Please sign in or use Forgot password/PIN.";
 if (message.includes("email not confirmed")) return "Please verify your email using the confirmation link we sent before logging in.";
 if (message.includes("password should be at least") || message.includes("password must be")) return "Password must be at least 8 characters long.";
 if (message.includes("rate limit") || message.includes("too many requests")) return "Too many attempts. Please wait a little while and try again.";
 if (message.includes("network") || message.includes("fetch")) return "We couldn’t connect. Check your internet connection and try again.";
 if (flow === "reset") return "We couldn’t process the password reset request. Please try again shortly.";
 if (flow === "login") return "We couldn’t sign you in. Check your details and try again.";
 if (flow === "signup") return "We couldn’t create your account. Please check your details and try again.";
 return "Something went wrong. Please try again.";
}

export default function AuthScreen(){
 const {t}=useKamproLanguage();
 const params=useLocalSearchParams<{mode?:string}>();
 const [mode,setMode]=useState<"customer"|"professional">(params.mode==="professional"?"professional":"customer");
 const [method,setMethod]=useState<Method>("mobile");
 const [phone,setPhone]=useState(""); const [otp,setOtp]=useState("");
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [fullName,setFullName]=useState("");
 const [accountMode,setAccountMode]=useState<"login"|"signup">("login");
 const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false); const [resetSent,setResetSent]=useState(false); const [confirmPassword,setConfirmPassword]=useState(""); const [mobileRecovery,setMobileRecovery]=useState(false); const [pinRecoveryReady,setPinRecoveryReady]=useState(false); const [feedback,setFeedback]=useState<{kind:"error"|"success";text:string}|null>(null); const isReset=params.mode==="reset-password";

 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session&&!isReset){setTimeout(()=>router.replace("/home"),0);}});return()=>data.subscription.unsubscribe();},[isReset]);
 async function updatePassword(){if(password.length<8)return Alert.alert("Password too short","Use at least 8 characters.");if(password!==confirmPassword)return Alert.alert("Passwords do not match","Enter the same password in both fields.");setBusy(true);try{const{error}=await supabase.auth.updateUser({password});if(error)throw error;Alert.alert("Password updated","Your password has been changed.");router.replace("/home");}catch(e){Alert.alert("Unable to update password",e instanceof Error?e.message:"Please request a new reset link.");}finally{setBusy(false);}}
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
  if(password.length<8)return Alert.alert("Enter PIN/password","Use at least 8 characters.");
  setBusy(true);
  try{const{error}=await supabase.auth.signInWithPassword({phone:"+91"+phone.replace(/\D/g,"").slice(-10),password});if(error)throw error;router.replace("/home");}
  catch(e){Alert.alert("Sign-in unsuccessful",friendlyAuthError(e,"login"));}
  finally{setBusy(false);}
 }
 async function mobileSignup(){
  if(fullName.trim().length<2)return Alert.alert("Enter your name","Please enter your full name before creating your account.");
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Please enter a valid 10-digit mobile number.");
  if(password.length<8)return Alert.alert("PIN/password too short","Use at least 8 characters.");
  if(password!==confirmPassword)return Alert.alert("PIN/passwords do not match","Enter the same PIN/password in both fields.");
  setBusy(true);
  try{const{data,error}=await supabase.auth.signUp({phone:"+91"+phone.replace(/\D/g,"").slice(-10),password,options:{data:{initial_mode:mode,full_name:fullName.trim()}}});if(error)throw error;if(data.session){const{error:modeError}=await supabase.rpc("switch_app_mode",{p_mode:mode});if(modeError)throw modeError;router.replace("/home");}else{setFeedback({kind:"error",text:"KAMPRO did not receive a sign-in session. SMS-free mobile registration requires Phone confirmations to be disabled in Supabase Auth settings. Please try again after the setting is updated."});}}
  catch(e){Alert.alert("Couldn’t create account",friendlyAuthError(e,"signup"));}
  finally{setBusy(false);}
 }
 async function startMobileRecovery(){
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Enter the mobile number linked to your KAMPRO account first.");
  setBusy(true);
  try{const{error}=await supabase.auth.signInWithOtp({phone:"+91"+phone.replace(/\D/g,"").slice(-10),options:{shouldCreateUser:false}});if(error)throw error;setMobileRecovery(true);setPinRecoveryReady(false);setOtp("");setSent(true);Alert.alert("OTP sent","Verify your mobile number to set a new PIN/password.");}
  catch(e){Alert.alert("Unable to send recovery OTP",friendlyAuthError(e,"reset"));}
  finally{setBusy(false);}
 }
 async function updateMobilePin(){
  if(password.length<8)return Alert.alert("PIN/password too short","Use at least 8 characters.");
  if(password!==confirmPassword)return Alert.alert("PIN/passwords do not match","Enter the same PIN/password in both fields.");
  setBusy(true);
  try{const{error}=await supabase.auth.updateUser({password});if(error)throw error;Alert.alert("PIN/password updated","Your mobile login credential has been updated.");setPinRecoveryReady(false);setMobileRecovery(false);setPassword("");setConfirmPassword("");setOtp("");setSent(false);router.replace("/home");}
  catch(e){Alert.alert("Unable to update PIN/password",e instanceof Error?e.message:"Please verify your mobile number and try again.");}
  finally{setBusy(false);}
 }
 async function emailLogin(){
  if(!email.trim()||!/^\S+@\S+\.\S+$/.test(email.trim()))return setFeedback({kind:"error",text:"Please enter a valid email address."});
  if(password.length<8)return setFeedback({kind:"error",text:"Password must be at least 8 characters long."});
  setFeedback(null);
  setBusy(true);
  try{const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;router.replace("/home");}
  catch(e){setFeedback({kind:"error",text:friendlyAuthError(e,"login")});}
  finally{setBusy(false);}
 }
 async function forgotPassword(){
  if(!email.trim()||!email.includes("@"))return Alert.alert("Enter your email","Enter the email address linked to your KAMPRO account first.");
  setBusy(true);
  try{const{error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:getAuthRedirect()+"?mode=reset-password"});if(error)throw error;setResetSent(true);Alert.alert("Check your email","If an account exists for this address, Supabase will send a password-reset link. Open it on this device or browser to choose a new password.");}
  catch(e){Alert.alert("Password reset",friendlyAuthError(e,"reset"));}
  finally{setBusy(false);}
 }
 async function emailSignup(){
  setFeedback(null);
  if(fullName.trim().length<2){setFeedback({kind:"error",text:"Enter your full name before creating an account."});return;}
  if(!email.trim()||!/^\S+@\S+\.\S+$/.test(email.trim())){setFeedback({kind:"error",text:"Please enter a valid email address."});return;}
  if(password.length<8){setFeedback({kind:"error",text:"Password must be at least 8 characters long."});return;}
  setBusy(true);
  try{const{data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{initial_mode:mode,full_name:fullName.trim()},emailRedirectTo:getAuthRedirect()}});if(error)throw error;if(data.session)router.replace("/home");else setFeedback({kind:"success",text:"Registration request accepted. Check your inbox and spam folder for the confirmation email. If you already have an account, please sign in or use Forgot password."});}
  catch(e){setFeedback({kind:"error",text:friendlyAuthError(e,"signup")});}
  finally{setBusy(false);}
 }
 async function google(){
  setBusy(true);
  try{
   const{data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:getAuthRedirect(),skipBrowserRedirect:Platform.OS==="web"}});
   if(error)throw error;
   if(!data.url)throw new Error("Google sign-in did not return an authorization URL. Enable Google under Supabase Dashboard → Authentication → Sign In / Providers and add its OAuth client credentials.");
   if(Platform.OS==="web")window.location.assign(data.url);
  }catch(e){Alert.alert("Google sign in unavailable",e instanceof Error?e.message:"Please configure Google in Supabase Auth.");}
  finally{setBusy(false);}
 }

 if(isReset)return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><View style={s.container}><VasudhaLogo/><Text style={s.heading}>Reset your password</Text><Text style={s.sub}>Choose a new password for your KAMPRO account.</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="New password (8+ characters)" placeholderTextColor="#7B8794" style={s.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Confirm new password" placeholderTextColor="#7B8794" style={s.input}/><Pressable disabled={busy} onPress={updatePassword} style={s.primary}><Text style={s.primaryText}>{busy?"Updating…":"Update password"}</Text></Pressable></View></KeyboardAvoidingView></SafeAreaView>;
 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><View style={s.container}>
  <View style={{alignItems:"flex-end",marginBottom:10}}><LanguageSwitch/></View>
  <VasudhaLogo/>
  <Text style={s.heading}>{t("welcomeBack")}</Text>
  <Text style={s.sub}>{accountMode==="signup"?t("createAccount"):t("signInContinue")}</Text>
  <View style={s.tabs}>
   <Pressable onPress={()=>{setMethod("mobile");setSent(false);setMobileRecovery(false);setPinRecoveryReady(false);}} style={[s.tab,method==="mobile"&&s.tabOn]}><Text style={[s.tabText,method==="mobile"&&s.tabTextOn]}>{t("mobilePin")}</Text></Pressable>
   <Pressable onPress={()=>setMethod("email")} style={[s.tab,method==="email"&&s.tabOn]}><Text style={[s.tabText,method==="email"&&s.tabTextOn]}>{t("email")}</Text></Pressable>
  </View>
  {accountMode==="signup"&&<TextInput value={fullName} onChangeText={setFullName} placeholder={t("fullName")} placeholderTextColor="#7B8794" style={s.input} autoCapitalize="words"/>}
  {method==="mobile"?(
   pinRecoveryReady?<><Text style={s.otpLabel}>Choose a new PIN/password for +91 {phone}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="New PIN/password (8+ characters)" placeholderTextColor="#7B8794" style={s.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Confirm new PIN/password" placeholderTextColor="#7B8794" style={s.input}/><Pressable disabled={busy} onPress={updateMobilePin} style={s.primary}><Text style={s.primaryText}>{busy?"Updating…":"Set new PIN/password"}</Text></Pressable></>
   :sent?<><Text style={s.otpLabel}>{mobileRecovery?"Enter recovery OTP sent to":"Enter confirmation OTP sent to"} +91 {phone}</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} placeholder="••••••" placeholderTextColor="#7B8794" style={s.otp}/><Pressable disabled={busy} onPress={verifyOtp} style={s.primary}><Text style={s.primaryText}>{busy?"Verifying…":mobileRecovery?"Verify and set new PIN":"Verify mobile number"}</Text></Pressable><Pressable onPress={()=>{setSent(false);setMobileRecovery(false);}}><Text style={s.change}>Change mobile number</Text></Pressable></>
   :<><View style={s.phoneRow}><View style={s.code}><Text>🇮🇳 +91</Text></View><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor="#7B8794" style={s.phone}/></View>{accountMode==="login"?<TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="PIN/password (8+ characters)" placeholderTextColor="#7B8794" style={s.input}/>:<><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Create PIN/password (8+ characters)" placeholderTextColor="#7B8794" style={s.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Confirm PIN/password" placeholderTextColor="#7B8794" style={s.input}/></>}<Pressable disabled={busy} onPress={accountMode==="signup"?mobileSignup:mobileLogin} style={[s.primary,busy&&s.primaryBusy]}><Text style={s.primaryText}>{busy?(accountMode==="signup"?"Creating account…":"Signing in…"):(accountMode==="signup"?t("createMobileAccount"):t("signInMobile"))}</Text></Pressable>{accountMode==="login"&&<Text style={s.change}>Forgot your password? SMS recovery is not enabled yet. Please contact KAMPRO support.</Text>}{accountMode==="login"&&<Pressable disabled={busy} onPress={()=>setAccountMode("signup")}><Text style={s.create}>{t("newAccount")}</Text></Pressable>}{accountMode==="signup"&&<Pressable onPress={()=>setAccountMode("login")}><Text style={s.change}>{t("existingAccount")}</Text></Pressable>}</>
  ):(
   <><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="KAMPRO email address" placeholder="Email address" placeholderTextColor="#7B8794" style={s.input}/><TextInput secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="KAMPRO password" placeholder="Password" placeholderTextColor="#7B8794" style={s.input}/><Pressable accessibilityRole="button" disabled={busy} onPress={accountMode==="signup"?emailSignup:emailLogin} style={[s.primary,busy&&s.primaryBusy]}><Text style={s.primaryText}>{busy?(accountMode==="signup"?"Creating account…":"Signing in…"):(accountMode==="signup"?t("createEmailAccount"):t("signInEmail"))}</Text></Pressable>{accountMode==="login"&&<Pressable disabled={busy} onPress={()=>setAccountMode("signup")}><Text style={s.create}>Create a new account</Text></Pressable>}{feedback&&<Text accessibilityRole="alert" style={[s.feedback,feedback.kind==="error"?s.feedbackError:s.feedbackSuccess]}>{feedback.text}</Text>}{accountMode==="login"&&<Pressable disabled={busy} onPress={forgotPassword}><Text style={s.change}>{busy?"Please wait…":resetSent?"Send password reset link again":"Forgot password?"}</Text></Pressable> }
   {accountMode==="signup"&&<Pressable onPress={()=>setAccountMode("login")}><Text style={s.change}>Already have an account? Sign in</Text></Pressable>}</>
  )}
  {method==="mobile"&&feedback&&<Text accessibilityRole="alert" style={[s.feedback,feedback.kind==="error"?s.feedbackError:s.feedbackSuccess]}>{feedback.text}</Text>}
  <View style={s.or}><View style={s.line}/><Text style={s.orText}>or</Text><View style={s.line}/></View>
  <Pressable disabled={busy} onPress={google} style={s.google}><Text style={s.googleG}>G</Text><Text style={s.googleText}>Continue with Google</Text></Pressable>
  <Text style={s.terms}>By continuing, you agree to our{"\n"}Terms & Conditions and Privacy Policy</Text>
  <Pressable onPress={()=>router.replace({pathname:"/select-mode",params:{mode}})}><Text style={s.switch}>{mode==="customer"?"Use KAMPRO as a Professional":"Use KAMPRO as a Customer"}</Text></Pressable>
 </View></KeyboardAvoidingView></SafeAreaView>
}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:KAMPRO.background},flex:{flex:1},container:{flex:1,padding:22,justifyContent:"center"},
 heading:{fontSize:26,fontWeight:"900",textAlign:"center",marginTop:28,color:"#10233F"},sub:{textAlign:"center",color:"#6B7280",marginTop:5,marginBottom:16},
 tabs:{flexDirection:"row",backgroundColor:"#F7F8FA",borderRadius:12,padding:3,marginBottom:14},tab:{flex:1,height:40,alignItems:"center",justifyContent:"center",borderRadius:9},tabOn:{backgroundColor:"#fff"},tabText:{fontWeight:"800",color:"#6B7280"},tabTextOn:{color:"#FF4B1F"},
 phoneRow:{flexDirection:"row",borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,height:52,overflow:"hidden"},code:{paddingHorizontal:12,justifyContent:"center",backgroundColor:"#f7faf9",borderRightWidth:1,borderRightColor:"#CBD0D8"},phone:{flex:1,paddingHorizontal:12,fontSize:16,color:"#10233F",backgroundColor:"#fff"},
 input:{height:52,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,paddingHorizontal:14,fontSize:16,marginBottom:10,color:"#10233F",backgroundColor:"#fff"},primary:{height:52,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:12},primaryText:{color:"#fff",fontWeight:"900",fontSize:16},primaryBusy:{opacity:0.75},feedback:{textAlign:"center",fontSize:13,fontWeight:"700",marginTop:12,lineHeight:19},feedbackError:{color:"#B42318"},feedbackSuccess:{color:"#137547"},
 otpLabel:{fontSize:13,color:"#6B7280",marginBottom:7},otp:{height:54,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,textAlign:"center",fontSize:22,letterSpacing:8,color:"#10233F",backgroundColor:"#fff"},change:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:12},create:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:14},
 or:{flexDirection:"row",alignItems:"center",gap:10,marginVertical:18},line:{height:1,backgroundColor:"#E7EAF0",flex:1},orText:{color:"#596575",fontWeight:"600"},google:{height:50,borderWidth:1,borderColor:"#CBD0D8",borderRadius:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12},googleG:{fontSize:20,fontWeight:"900",color:"#10233F"},googleText:{fontWeight:"700",color:"#10233F"},
 terms:{textAlign:"center",fontSize:11,color:"#596575",lineHeight:17,marginTop:22},switch:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:14}
});