import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});

export async function registerForPushNotifications(userId:string){
 if(Platform.OS!=="android"&&Platform.OS!=="ios")return null;
 const current=await Notifications.getPermissionsAsync();
 let status=current.status;
 if(status!=="granted"){const asked=await Notifications.requestPermissionsAsync();status=asked.status;}
 if(status!=="granted")return null;
 if(Platform.OS==="android")await Notifications.setNotificationChannelAsync("default",{name:"Default",importance:Notifications.AndroidImportance.DEFAULT});
 try{
  const projectId=(Constants.expoConfig?.extra as any)?.eas?.projectId;
  const result=await Notifications.getExpoPushTokenAsync(projectId?{projectId}:undefined);
  const token=result.data;
  await supabase.from("push_tokens").upsert({user_id:userId,token,platform:Platform.OS,updated_at:new Date().toISOString()},{onConflict:"token"});
  return token;
 }catch(e){return null;}
}
