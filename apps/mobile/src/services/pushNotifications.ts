import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";

Notifications.setNotificationHandler({handle:async()=>({shouldShowAlert:true,shouldPlaySound:true,shouldSetBadge:false})});

export async function registerForPushNotifications(userId:string){
  if(Platform.OS==="web")return null;
  const permissions=await Notifications.getPermissionsAsync();
  let status=permissions.status;
  if(status!=="granted"){
    const requested=await Notifications.requestPermissionsAsync();
    status=requested.status;
  }
  if(status!=="granted")return null;
  const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
  if(!projectId)return null;
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  const platform=Platform.OS==="ios"?"ios":"android";
  const{error}=await supabase.from("push_tokens").upsert({user_id:userId,token,platform,updated_at:new Date().toISOString()},{onConflict:"token"});
  if(error)throw error;
  return token;
}
