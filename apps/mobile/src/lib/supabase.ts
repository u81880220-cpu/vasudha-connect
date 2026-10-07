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

export const supabase=createClient(url,publishableKey,{
  auth:{storage:AsyncStorage,autoRefreshToken:true,persistSession:true,detectSessionInUrl:isWeb}
});

export function getAuthRedirect(){
  if(typeof window!=="undefined") return window.location.origin+"/auth/callback";
  return "vasudhaconnect://auth/callback";
}
