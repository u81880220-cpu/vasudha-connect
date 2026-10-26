import { View, Text, StyleSheet, Pressable, Linking } from "react-native";

type Props = {
 serviceLatitude?: number | null;
 serviceLongitude?: number | null;
 serviceLabel?: string | null;
 liveLatitude?: number | null;
 liveLongitude?: number | null;
};

/**
 * Crash-safe native tracking panel.
 * We intentionally do not mount react-native-maps here: native MapView can
 * terminate older/device-specific Android builds when Google Maps SDK/API
 * configuration is missing. Tracking/status must remain usable regardless
 * of map SDK availability; Google Maps is opened externally for navigation.
 */
export default function JobTrackingLocationMap({serviceLatitude,serviceLongitude,serviceLabel,liveLatitude,liveLongitude}:Props){
 const lat=serviceLatitude==null?NaN:Number(serviceLatitude);
 const lng=serviceLongitude==null?NaN:Number(serviceLongitude);
 const hasService=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(lat===0&&lng===0);
 const liveLat=liveLatitude==null?NaN:Number(liveLatitude);
 const liveLng=liveLongitude==null?NaN:Number(liveLongitude);
 const hasLive=Number.isFinite(liveLat)&&Number.isFinite(liveLng)&&liveLat>=-90&&liveLat<=90&&liveLng>=-180&&liveLng<=180&&!(liveLat===0&&liveLng===0);
 const openMaps=()=> {
  const destination=hasService?lat+","+lng:(serviceLabel||"Raebareli, Uttar Pradesh");
  const url=hasLive&&hasService
   ? "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(liveLat+","+liveLng)+"&destination="+encodeURIComponent(destination)+"&travelmode=driving"
   : "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(destination);
  void Linking.openURL(url).catch(()=>{});
 };
 return <View style={s.panel}>
  <Text style={s.title}>{hasLive?"Professional GPS location received":"Live map is waiting for GPS coordinates"}</Text>
  <Text style={s.address}>{serviceLabel||"Service location"}</Text>
  {hasService?<Text style={s.coordinate}>Service coordinates: {lat.toFixed(5)}, {lng.toFixed(5)}</Text>:<Text style={s.note}>Exact service coordinates are not available yet.</Text>}
  {hasLive?<Text style={s.coordinate}>Professional coordinates: {liveLat.toFixed(5)}, {liveLng.toFixed(5)}</Text>:<Text style={s.note}>Waiting for the professional to share their latest GPS location.</Text>}
  <Pressable accessibilityRole="button" onPress={openMaps} style={s.button}><Text style={s.buttonText}>{hasLive&&hasService?"Navigate to professional / service in Google Maps":"Open service location in Google Maps"}</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({
 panel:{minHeight:120,borderRadius:18,marginTop:14,padding:16,backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},
 title:{fontWeight:"900",color:"#10233F",textAlign:"center",fontSize:15},
 address:{marginTop:6,color:"#475467",textAlign:"center"},
 coordinate:{marginTop:8,color:"#087D65",fontSize:12,fontWeight:"700",textAlign:"center"},
 note:{marginTop:8,color:"#475467",textAlign:"center"},
 button:{marginTop:12,paddingHorizontal:14,paddingVertical:11,borderRadius:10,backgroundColor:"#FF4B1F",alignSelf:"stretch"},
 buttonText:{color:"#fff",fontWeight:"800",textAlign:"center"}
});
