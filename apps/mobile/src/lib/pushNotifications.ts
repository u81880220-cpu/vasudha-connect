import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});

export async function registerForPushNotifications(userId:string){
 if(Platform.OS!=="android"&&Platform.OS!=="ios")return null;
 const current=await Notifications.getPermissionsAsync();
 let status=current.status;
 if(status!=="granted"){const asked=await Notifications.requestPermissionsAsync();status=asked.status;}
 if(status!=="granted")return null;
 if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("default",{name:"VASUDHA CONNECT",importance:Notifications.AndroidImportance.DEFAULT,sound:"default"});
 try{
  const projectId=(Constants.expoConfig?.extra as any)?.eas?.projectId;
  const result=await Notifications.getExpoPushTokenAsync(projectId?{projectId}:undefined);
  const token=result.data;
  const{error}=await supabase.from("push_tokens").upsert({user_id:userId,token,platform:Platform.OS,updated_at:new Date().toISOString()},{onConflict:"token"});
  if(error)return null;
  return token;
 }catch{return null;}
}

export function registerNotificationTapHandler(){
 if(Platform.OS!=="android"&&Platform.OS!=="ios") return {remove:()=>{}};
 return Notifications.addNotificationResponseReceivedListener(response=>{
  const data=(response.notification.request.content.data||{}) as any;
  if(data.screen==="jobs")router.push("/jobs");
  else if(data.screen==="connections")router.push("/connections");
  else if(data.screen==="notifications")router.push("/notifications");
  else if(data.screen==="marketplace")router.push("/marketplace");
  else router.push("/notifications");
 });
}
