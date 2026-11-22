import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url=process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://bbweclhmbzwmflijppoi.supabase.co";

// Supabase publishable keys are designed for client applications.
// Keep the environment variable as the preferred value, with the
// project publishable key as a safe fallback for native builds where
// EAS/Vercel environment injection is unavailable.
const publishableKey=
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_fE2u4A3S9YNOR_-imSZKJg_MQuxzPVX";

const isWeb=typeof window!=="undefined";

let realtimeChannelSequence=0;

// Give every mounted effect its own topic. A screen can unmount and remount
// before Realtime finishes removing its previous channel; reusing the same
// topic in that window can hand back a channel that is already subscribed.
export function createRealtimeChannel(topic:string){
  realtimeChannelSequence+=1;
  return supabase.channel(`${topic}-${realtimeChannelSequence}`);
}

export const supabase=createClient(url,publishableKey,{
  auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:isWeb}
});

export function getAuthRedirect(){
  if(typeof window!=="undefined") return window.location.origin+"/auth";
  return "vasudhaconnect://auth";
}
