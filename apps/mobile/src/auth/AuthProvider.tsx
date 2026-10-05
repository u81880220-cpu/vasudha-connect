import { Session } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";

type AppMode="customer"|"professional";
type AuthContextValue={session:Session|null;loading:boolean;mode:AppMode;setMode:(mode:AppMode)=>Promise<void>;signOut:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|undefined>(undefined);

export function AuthProvider({children}:PropsWithChildren){
 const[session,setSession]=useState<Session|null>(null);
 const[mode,setModeState]=useState<AppMode>("customer");
 const[loading,setLoading]=useState(true);

 useEffect(()=>{
   let mounted=true;
   let pushTap:{remove:()=>void}|null=null;

   const init=async()=>{
     // Push notifications are native-only. Never import their module in the browser.
     if(Platform.OS!=="web"){
       const push=await import("../lib/pushNotifications");
       pushTap=push.registerNotificationTapHandler();
     }

     const {data}=await supabase.auth.getSession();
     if(!mounted)return;
     setSession(data.session);

     if(data.session){
       await loadMode(data.session.user.id);
       if(Platform.OS!=="web"){
         const push=await import("../lib/pushNotifications");
         await push.registerForPushNotifications(data.session.user.id);
       }
     }
     if(mounted)setLoading(false);
   };

   void init();

   const{data:listener}=supabase.auth.onAuthStateChange(async(_event,next)=>{
     if(!mounted)return;
     setSession(next);
     if(next){
       await loadMode(next.user.id);
       if(Platform.OS!=="web"){
         const push=await import("../lib/pushNotifications");
         await push.registerForPushNotifications(next.user.id);
       }
     }else{
       setModeState("customer");
     }
     if(mounted)setLoading(false);
   });

   return()=>{
     mounted=false;
     listener.subscription.unsubscribe();
     pushTap?.remove();
   };
 },[]);

 async function loadMode(userId:string){
   const{data}=await supabase.from("profiles").select("current_mode").eq("id",userId).maybeSingle();
   setModeState(data?.current_mode==="professional"?"professional":"customer");
 }
 async function setMode(nextMode:AppMode){
   if(!session)return;
   const{error}=await supabase.rpc("switch_app_mode",{p_mode:nextMode});
   if(error)throw error;
   setModeState(nextMode);
 }
 async function signOut(){await supabase.auth.signOut();}

 return <AuthContext.Provider value={{session,loading,mode,setMode,signOut}}>{children}</AuthContext.Provider>;
}
export function useAuth(){
 const value=useContext(AuthContext);
 if(!value)throw new Error("useAuth must be used inside AuthProvider");
 return value;
}
