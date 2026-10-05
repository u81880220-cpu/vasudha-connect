import { Session } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { registerForPushNotifications } from "../lib/pushNotifications";
type AppMode="customer"|"professional";
type AuthContextValue={session:Session|null;loading:boolean;mode:AppMode;setMode:(mode:AppMode)=>Promise<void>;signOut:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
export function AuthProvider({children}:PropsWithChildren){
 const[session,setSession]=useState<Session|null>(null),[mode,setModeState]=useState<AppMode>("customer"),[loading,setLoading]=useState(true);
 useEffect(()=>{let mounted=true;supabase.auth.getSession().then(async({data})=>{if(!mounted)return;setSession(data.session);if(data.session){await loadMode(data.session.user.id);registerForPushNotifications(data.session.user.id);}setLoading(false);});const{data:listener}=supabase.auth.onAuthStateChange(async(_event,next)=>{setSession(next);if(next){await loadMode(next.user.id);registerForPushNotifications(next.user.id);}else setModeState("customer");setLoading(false);});return()=>{mounted=false;listener.subscription.unsubscribe();};},[]);
 async function loadMode(userId:string){const{data}=await supabase.from("profiles").select("current_mode").eq("id",userId).maybeSingle();setModeState(data?.current_mode==="professional"?"professional":"customer");}
 async function setMode(nextMode:AppMode){if(!session)return;const{error}=await supabase.rpc("switch_app_mode",{p_mode:nextMode});if(error)throw error;setModeState(nextMode);}
 async function signOut(){await supabase.auth.signOut();}
 return <AuthContext.Provider value={{session,loading,mode,setMode,signOut}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error("useAuth must be used inside AuthProvider");return value;}
