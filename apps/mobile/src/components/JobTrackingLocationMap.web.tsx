import { View, Text, StyleSheet } from "react-native";
export default function JobTrackingLocationMap({serviceLatitude,serviceLongitude,serviceLabel,liveLatitude,liveLongitude}:{serviceLatitude?:number|null;serviceLongitude?:number|null;serviceLabel?:string|null;liveLatitude?:number|null;liveLongitude?:number|null}){
 const lat=serviceLatitude==null?NaN:Number(serviceLatitude);
 const lng=serviceLongitude==null?NaN:Number(serviceLongitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180|| (lat===0&&lng===0))return null;
 const liveLat=liveLatitude==null?NaN:Number(liveLatitude);
 const liveLng=liveLongitude==null?NaN:Number(liveLongitude);
 const hasLive=Number.isFinite(liveLat)&&Number.isFinite(liveLng)&&liveLat>=-90&&liveLat<=90&&liveLng>=-180&&liveLng<=180&&!(liveLat===0&&liveLng===0);
 return <View style={s.map}><Text style={s.mapText}>📍 {serviceLabel||"Service location"}{hasLive?"  •  🟢 Professional location live":""}</Text></View>;
}
const s=StyleSheet.create({map:{height:200,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},mapText:{backgroundColor:"#fff",paddingHorizontal:12,paddingVertical:7,borderRadius:10,fontWeight:"800"}});
