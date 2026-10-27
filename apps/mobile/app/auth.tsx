import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { Msg91RegistrationWidget } from "../src/components/Msg91RegistrationWidget";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase,getAuthRedirect } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { KAMPRO } from "../src/components/kamproTheme";
import { LanguageSwitch } from "../src/components/LanguageSwitch";
import { useKamproLanguage } from "../src/i18n/LanguageProvider";

type Method="mobile"|"email";

// KAMPRO password policy: minimum 4 characters; no app-level maximum or mandatory character classes.
const PASSWORD_MIN_LENGTH = 4;

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
 const [sent,setSent]=useState(false); const [busy,setBusy]=useState(false); const [showMsg91Widget,setShowMsg91Widget]=useState(false); const [resetSent,setResetSent]=useState(false); const [confirmPassword,setConfirmPassword]=useState(""); const [mobileRecovery,setMobileRecovery]=useState(false); const [pinRecoveryReady,setPinRecoveryReady]=useState(false); const [feedback,setFeedback]=useState<{kind:"error"|"success";text:string}|null>(null); const isReset=params.mode==="reset-password";

 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session&&!isReset){setTimeout(()=>router.replace("/home"),0);}});return()=>data.subscription.unsubscribe();},[isReset]);
 async function updatePassword(){if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("Password too short",`Use at least ${PASSWORD_MIN_LENGTH} characters.`);if(password!==confirmPassword)return Alert.alert("Passwords do not match","Enter the same password in both fields.");setBusy(true);try{const{error}=await supabase.auth.updateUser({password});if(error)throw error;Alert.alert("Password updated","Your password has been changed.");router.replace("/home");}catch(e){Alert.alert("Unable to update password",e instanceof Error?e.message:"Please request a new reset link.");}finally{setBusy(false);}}
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
  if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("Enter PIN/password","Use at least ${PASSWORD_MIN_LENGTH} characters.");
  setBusy(true);
  try{
   const {data,error}=await supabase.functions.invoke("mobile-login",{body:{phone:"+91"+phone.replace(/\D/g,"").slice(-10),password}});
   if(error)throw new Error(error.message||"Mobile sign-in request failed.");
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
  // The MSG91 registration widget is currently supported in the Android app only.
  // Do not open the placeholder web component, which cannot complete OTP verification.
  if(Platform.OS==="web"){
   const message="Mobile OTP registration is available in the KAMPRO Android app. On the web, choose Email to create an account, or open KAMPRO on Android to register with your mobile number.";
   setFeedback({kind:"error",text:message});
   Alert.alert("Mobile registration unavailable on web",message);
   return;
  }
  if(fullName.trim().length<2)return Alert.alert("Enter your name","Please enter your full name before creating your account.");
  if(phone.replace(/\D/g,"").length<10)return Alert.alert("Enter mobile number","Please enter a valid 10-digit mobile number.");
  if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("PIN/password too short","Use at least ${PASSWORD_MIN_LENGTH} characters.");
  if(password!==confirmPassword)return Alert.alert("PIN/passwords do not match","Enter the same PIN/password in both fields.");
  if(!process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH)return Alert.alert("OTP setup incomplete","KAMPRO's MSG91 widget token has not been configured for this build. Please configure EXPO_PUBLIC_MSG91_TOKEN_AUTH in the mobile build environment.");
  setFeedback(null);
  setShowMsg91Widget(true);
 }
 async function completeMsg91Registration(result: {success?:boolean; identifier?:string; message?:string}){
  setShowMsg91Widget(false);
  if(!result?.success)return Alert.alert("Mobile verification failed",result?.message||"MSG91 could not verify this mobile number. Please try again.");
  const enteredPhone="+91"+phone.replace(/\D/g,"").slice(-10);
  const verifiedDigits=(result.identifier||"").replace(/\D/g,"");
  const normalizedVerified=verifiedDigits.length===10?"91"+verifiedDigits:verifiedDigits;
  if(normalizedVerified!==enteredPhone.replace(/\D/g,""))return Alert.alert("Mobile number mismatch","The number verified by MSG91 does not match the number entered. Please retry with the same number.");
  const accessToken=result.message||"";
  if(accessToken.length<20)return Alert.alert("Verification response incomplete","MSG91 did not return a valid verification token. Please retry.");
  setBusy(true);
  try{
   const {data,error}=await supabase.functions.invoke("msg91-register",{body:{accessToken,phone:enteredPhone,password,fullName:fullName.trim(),mode}});
   if(error)throw new Error(error.message||"Registration service request failed.");
   if(!data?.success)throw new Error(typeof data?.error==="string"?data.error:"KAMPRO could not complete registration.");
   const {data:loginData,error:loginError}=await supabase.functions.invoke("mobile-login",{body:{phone:enteredPhone,password}});
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
  setBusy(true);
  try{const{error}=await supabase.auth.signInWithOtp({phone:"+91"+phone.replace(/\D/g,"").slice(-10),options:{shouldCreateUser:false}});if(error)throw error;setMobileRecovery(true);setPinRecoveryReady(false);setOtp("");setSent(true);Alert.alert("OTP sent","Verify your mobile number to set a new PIN/password.");}
  catch(e){Alert.alert("Unable to send recovery OTP",friendlyAuthError(e,"reset"));}
  finally{setBusy(false);}
 }
 async function updateMobilePin(){
  if(password.length<PASSWORD_MIN_LENGTH)return Alert.alert("PIN/password too short","Use at least ${PASSWORD_MIN_LENGTH} characters.");
  if(password!==confirmPassword)return Alert.alert("PIN/passwords do not match","Enter the same PIN/password in both fields.");
  setBusy(true);
  try{const{error}=await supabase.auth.updateUser({password});if(error)throw error;Alert.alert("PIN/password updated","Your mobile login credential has been updated.");setPinRecoveryReady(false);setMobileRecovery(false);setPassword("");setConfirmPassword("");setOtp("");setSent(false);router.replace("/home");}
  catch(e){Alert.alert("Unable to update PIN/password",e instanceof Error?e.message:"Please verify your mobile number and try again.");}
  finally{setBusy(false);}
 }
 async function emailLogin(){
  if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())){const message="Please enter a valid email address.";setFeedback({kind:"error",text:message});Alert.alert("Check your email",message);return;}
  if(password.length<PASSWORD_MIN_LENGTH)return setFeedback({kind:"error",text:`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`});
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
  if(fullName.trim().length<2){const message="Enter your full name before creating an account.";setFeedback({kind:"error",text:message});Alert.alert("Name required",message);return;}
  if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())){const message="Please enter a valid email address.";setFeedback({kind:"error",text:message});Alert.alert("Check your email",message);return;}
  if(password.length<PASSWORD_MIN_LENGTH){const message="Password must be at least ${PASSWORD_MIN_LENGTH} characters long.";setFeedback({kind:"error",text:message});Alert.alert("Password too short",message);return;}
  setBusy(true);
  try{
   const{data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{initial_mode:mode,full_name:fullName.trim()},emailRedirectTo:getAuthRedirect()}});
   if(error)throw error;
   if(data.session){Alert.alert("Account created","Your KAMPRO account has been created successfully.");router.replace("/home");}
   else{
    const message="Registration request accepted. Please check your inbox and spam folder for the KAMPRO confirmation email before signing in. If you already have an account, please sign in or use Forgot password.";
    setFeedback({kind:"success",text:message});
    Alert.alert("Check your email",message);
   }
  }
  catch(e){const message=friendlyAuthError(e,"signup");setFeedback({kind:"error",text:message});Alert.alert("Couldn’t create account",message);}
  finally{setBusy(false);}
 }
 async function google(){
  setBusy(true);
  try{
   const redirectTo=Platform.OS==="web"?getAuthRedirect():Linking.createURL("auth/callback");
   const{data,error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo,skipBrowserRedirect:true}});
   if(error)throw error;
   if(!data.url)throw new Error("Google sign-in did not return an authorization URL. Enable Google under Supabase Dashboard → Authentication → Sign In / Providers and add its OAuth client credentials.");
   if(Platform.OS==="web"){window.location.assign(data.url);return;}
   if(typeof WebBrowser.openAuthSessionAsync!=="function")throw new Error("Google sign-in is unavailable in this build because the secure browser module is not available. Rebuild the Android app with expo-web-browser installed and configured.");
   const result=await WebBrowser.openAuthSessionAsync(data.url,redirectTo);
   if(result.type==="success"&&result.url){
    const callbackUrl=new URL(result.url);
    const errorDescription=callbackUrl.searchParams.get("error_description");
    if(errorDescription)throw new Error(errorDescription);
    const code=callbackUrl.searchParams.get("code");
    if(code){
     const{error:exchangeError}=await supabase.auth.exchangeCodeForSession(code);
     if(exchangeError)throw exchangeError;
     router.replace("/home");
    }else if(callbackUrl.hash.includes("access_token=")){
     const params=new URLSearchParams(callbackUrl.hash.replace(/^#/,""));
     const access_token=params.get("access_token"),refresh_token=params.get("refresh_token");
     if(!access_token||!refresh_token)throw new Error("Google returned an incomplete sign-in session.");
     const{error:sessionError}=await supabase.auth.setSession({access_token,refresh_token});
     if(sessionError)throw sessionError;
     router.replace("/home");
    }else{
     throw new Error("Google returned to KAMPRO without a sign-in code. Check the Supabase OAuth redirect URL configuration.");
    }
   }else if(result.type==="cancel"||result.type==="dismiss") {
    // The user closed the browser; keep them on the sign-in screen.
   }
  }catch(e){Alert.alert("Google sign in unavailable",e instanceof Error?e.message:"Please configure Google in Supabase Auth.");}
  finally{setBusy(false);}
 }

 if(isReset)return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><ScrollView style={s.flex} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}><VasudhaLogo/><Text style={s.heading}>Reset your password</Text><Text style={s.sub}>Choose a new password for your KAMPRO account.</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="New password (4+ characters)" placeholderTextColor="#7B8794" style={s.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Confirm new password" placeholderTextColor="#7B8794" style={s.input}/><Pressable disabled={busy} onPress={updatePassword} style={s.primary}><Text style={s.primaryText}>{busy?"Updating…":"Update password"}</Text></Pressable></ScrollView></KeyboardAvoidingView></SafeAreaView>;
 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==="ios"?"padding":"height"}><ScrollView style={s.flex} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
  <View style={{alignItems:"flex-end",marginBottom:10}}><LanguageSwitch/></View>
  <VasudhaLogo/>
  <Text style={s.heading}>{t("welcomeBack")}</Text>
  <Text style={s.sub}>{accountMode==="signup"?t("createAccount"):t("signInContinue")}</Text>
  <View style={s.tabs}>
   <Pressable testID="auth-mobile-tab" accessibilityLabel="Mobile" onPress={()=>{setMethod("mobile");setSent(false);setMobileRecovery(false);setPinRecoveryReady(false);}} style={[s.tab,method==="mobile"&&s.tabOn]}><Text style={[s.tabText,method==="mobile"&&s.tabTextOn]}>{t("mobilePin")}</Text></Pressable>
   <Pressable testID="auth-email-tab" accessibilityLabel="Email" onPress={()=>setMethod("email")} style={[s.tab,method==="email"&&s.tabOn]}><Text style={[s.tabText,method==="email"&&s.tabTextOn]}>{t("email")}</Text></Pressable>
  </View>
  {accountMode==="signup"&&<TextInput value={fullName} onChangeText={setFullName} placeholder={t("fullName")} placeholderTextColor="#7B8794" style={s.input} autoCapitalize="words"/>}
  {method==="mobile"?(
   pinRecoveryReady?<><Text style={s.otpLabel}>Choose a new PIN/password for +91 {phone}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="New PIN/password (4+ characters)" placeholderTextColor="#7B8794" style={s.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Confirm new PIN/password" placeholderTextColor="#7B8794" style={s.input}/><Pressable disabled={busy} onPress={updateMobilePin} style={s.primary}><Text style={s.primaryText}>{busy?"Updating…":"Set new PIN/password"}</Text></Pressable></>
   :sent?<><Text style={s.otpLabel}>{mobileRecovery?"Enter recovery OTP sent to":"Enter confirmation OTP sent to"} +91 {phone}</Text><TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} placeholder="••••••" placeholderTextColor="#7B8794" style={s.otp}/><Pressable disabled={busy} onPress={verifyOtp} style={s.primary}><Text style={s.primaryText}>{busy?"Verifying…":mobileRecovery?"Verify and set new PIN":"Verify mobile number"}</Text></Pressable><Pressable onPress={()=>{setSent(false);setMobileRecovery(false);}}><Text style={s.change}>Change mobile number</Text></Pressable></>
   :<><View style={s.phoneRow}><View style={s.code}><Text>🇮🇳 +91</Text></View><TextInput testID="auth-mobile-input" accessibilityLabel="KAMPRO mobile number" nativeID="auth-mobile-input" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98765 43210" placeholderTextColor="#7B8794" style={s.phone}/></View>{accountMode==="login"?<TextInput testID="auth-mobile-password" accessibilityLabel="KAMPRO PIN/password" nativeID="auth-mobile-password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="PIN/password (4+ characters)" placeholderTextColor="#7B8794" style={s.input}/>:<><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" placeholder="Create PIN/password (4+ characters)" placeholderTextColor="#7B8794" style={s.input}/><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="Confirm PIN/password" placeholderTextColor="#7B8794" style={s.input}/></>}<Pressable testID="auth-mobile-submit" accessibilityLabel="Sign in with Mobile" disabled={busy} onPress={accountMode==="signup"?mobileSignup:mobileLogin} style={[s.primary,busy&&s.primaryBusy]}><Text style={s.primaryText}>{busy?(accountMode==="signup"?"Creating account…":"Signing in…"):(accountMode==="signup"?t("createMobileAccount"):t("signInMobile"))}</Text></Pressable>{accountMode==="login"&&<Text style={s.change}>Forgot your password? SMS recovery is not enabled yet. Please contact KAMPRO support.</Text>}{accountMode==="login"&&<Pressable disabled={busy} onPress={()=>setAccountMode("signup")}><Text style={s.create}>{t("newAccount")}</Text></Pressable>}{accountMode==="signup"&&<Pressable onPress={()=>setAccountMode("login")}><Text style={s.change}>{t("existingAccount")}</Text></Pressable>}</>
  ):(
   <><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="auth-email-input" accessibilityLabel="KAMPRO email address" nativeID="auth-email-input" placeholder="Email address" placeholderTextColor="#7B8794" style={s.input}/><TextInput secureTextEntry value={password} onChangeText={setPassword} testID="auth-password-input" accessibilityLabel="KAMPRO password" nativeID="auth-password-input" placeholder="Password" placeholderTextColor="#7B8794" style={s.input}/><Pressable testID="auth-email-submit" accessibilityLabel="Sign in with Email" accessibilityRole="button" disabled={busy} onPress={accountMode==="signup"?emailSignup:emailLogin} style={[s.primary,busy&&s.primaryBusy]}><Text style={s.primaryText}>{busy?(accountMode==="signup"?"Creating account…":"Signing in…"):(accountMode==="signup"?t("createEmailAccount"):t("signInEmail"))}</Text></Pressable>{accountMode==="login"&&<Pressable disabled={busy} onPress={()=>setAccountMode("signup")}><Text style={s.create}>Create a new account</Text></Pressable>}{feedback&&<Text accessibilityRole="alert" style={[s.feedback,feedback.kind==="error"?s.feedbackError:s.feedbackSuccess]}>{feedback.text}</Text>}{accountMode==="login"&&<Pressable disabled={busy} onPress={forgotPassword}><Text style={s.change}>{busy?"Please wait…":resetSent?"Send password reset link again":"Forgot password?"}</Text></Pressable> }
   {accountMode==="signup"&&<Pressable onPress={()=>setAccountMode("login")}><Text style={s.change}>Already have an account? Sign in</Text></Pressable>}</>
  )}
  {method==="mobile"&&feedback&&<Text accessibilityRole="alert" style={[s.feedback,feedback.kind==="error"?s.feedbackError:s.feedbackSuccess]}>{feedback.text}</Text>}
  <View style={s.or}><View style={s.line}/><Text style={s.orText}>or</Text><View style={s.line}/></View>
  {<Pressable accessibilityRole="button" disabled={busy} onPress={google} style={[s.google,busy&&s.primaryBusy]}><Text style={s.googleG}>G</Text><Text style={s.googleText}>{busy?"Connecting…":"Continue with Google"}</Text></Pressable>}
  <Text style={s.terms}>By continuing, you agree to our{"\n"}Terms & Conditions and Privacy Policy</Text>
  {showMsg91Widget&&<Msg91RegistrationWidget visible={showMsg91Widget} onClose={()=>setShowMsg91Widget(false)} onCompletion={(result)=>{void completeMsg91Registration(result as {success?:boolean;identifier?:string;message?:string});}} widgetId={process.env.EXPO_PUBLIC_MSG91_WIDGET_ID||""} tokenAuth={process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH||""} />}
  <Pressable onPress={()=>router.replace({pathname:"/select-mode",params:{mode}})}><Text style={s.switch}>{mode==="customer"?"Use KAMPRO as a Professional":"Use KAMPRO as a Customer"}</Text></Pressable>
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
 terms:{textAlign:"center",fontSize:11,color:"#596575",lineHeight:17,marginTop:22},switch:{textAlign:"center",color:"#FF4B1F",fontWeight:"800",marginTop:14}
});