import { Session } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { registerForPushNotifications } from "../lib/pushNotifications";

type AppMode="customer"|"professional";
type AuthContextValue={session:Session|null;user:Session["user"]|null;loading:boolean;mode:AppMode;setMode:(mode:AppMode)=>Promise<void>;signOut:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|undefined>(undefined);

export function AuthProvider({children}:PropsWithChildren){
 const[session,setSession]=useState<Session|null>(null);
 const[mode,setModeState]=useState<AppMode>("customer");
 const[loading,setLoading]=useState(true);

 useEffect(()=>{
   let mounted=true;

   supabase.auth.getSession().then(({data})=>{
     if(!mounted)return;
     setSession(data.session);
     setLoading(false);
     if(data.session){ void loadMode(data.session.user.id,data.session.user.user_metadata?.initial_mode); void registerForPushNotifications(data.session.user.id).catch(()=>{}); }
   }).catch(()=>{
     if(mounted)setLoading(false);
   });

   const{data:listener}=supabase.auth.onAuthStateChange((_event,next)=>{
     if(!mounted)return;
     setSession(next);
     if(next){ void loadMode(next.user.id,next.user.user_metadata?.initial_mode); void registerForPushNotifications(next.user.id).catch(()=>{}); }
     else setModeState("customer");
     setLoading(false);
   });

   return()=>{
     mounted=false;
     listener.subscription.unsubscribe();
   };
 },[]);

 async function loadMode(_userId:string,registeredMode?:unknown){
   // Always restore the account's registration role after login. Never infer the default from current_mode,
   // because that field changes when the user switches modes inside the app.
   setModeState(registeredMode==="professional"?"professional":"customer");
 }

 async function setMode(nextMode:AppMode){
   if(!session) return;
   const{error}=await supabase.rpc("switch_app_mode",{p_mode:nextMode});
   if(error)throw error;
   setModeState(nextMode);
 }

 async function signOut(){await supabase.auth.signOut();}

 return <AuthContext.Provider value={{session,user:session?.user??null,loading,mode,setMode,signOut}}>{children}</AuthContext.Provider>;
}

export function useAuth(){
 const value=useContext(AuthContext);
 if(!value)throw new Error("useAuth must be used inside AuthProvider");
 return value;
}
