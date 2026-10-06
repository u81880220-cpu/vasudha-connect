import { View, Text, StyleSheet } from "react-native";
export default function JobTrackingLocationMap({serviceLatitude,serviceLongitude,serviceLabel,liveLatitude,liveLongitude}:{serviceLatitude?:number|null;serviceLongitude?:number|null;serviceLabel?:string|null;liveLatitude?:number|null;liveLongitude?:number|null}){
 if(serviceLatitude==null||serviceLongitude==null)return null;
 return <View style={s.map}><Text style={s.mapText}>📍 {serviceLabel||"Service location"}{liveLatitude!=null&&liveLongitude!=null?"  •  🟢 Professional location live":""}</Text></View>;
}
const s=StyleSheet.create({map:{height:200,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},mapText:{backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:7,borderRadius:10,fontWeight:"800"}});
