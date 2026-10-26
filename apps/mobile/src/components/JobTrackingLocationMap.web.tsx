import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";

type Props = {
 serviceLatitude?: number | null;
 serviceLongitude?: number | null;
 serviceLabel?: string | null;
 liveLatitude?: number | null;
 liveLongitude?: number | null;
};

export default function JobTrackingLocationMap({serviceLatitude,serviceLongitude,serviceLabel,liveLatitude,liveLongitude}:Props){
 const lat=serviceLatitude==null?NaN:Number(serviceLatitude);
 const lng=serviceLongitude==null?NaN:Number(serviceLongitude);
 const hasService=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(lat===0&&lng===0);
 const liveLat=liveLatitude==null?NaN:Number(liveLatitude);
 const liveLng=liveLongitude==null?NaN:Number(liveLongitude);
 const hasLive=Number.isFinite(liveLat)&&Number.isFinite(liveLng)&&liveLat>=-90&&liveLat<=90&&liveLng>=-180&&liveLng<=180&&!(liveLat===0&&liveLng===0);

 if(!hasService&&!hasLive){
  return <View style={s.mapFallback}>
   <Text style={s.fallbackTitle}>Map waiting for location coordinates</Text>
   <Text style={s.fallbackText}>The job status remains available. The map will appear when a valid service or professional GPS location is available.</Text>
  </View>;
 }

 // Google Maps' embed endpoint displays the service pin or directions between
 // the professional's latest GPS point and the customer's service location.
 const embedUrl=hasLive&&hasService
  ? "https://maps.google.com/maps?saddr="+encodeURIComponent(liveLat+","+liveLng)+"&daddr="+encodeURIComponent(lat+","+lng)+"&output=embed"
  : "https://maps.google.com/maps?q="+encodeURIComponent((hasLive?liveLat+","+liveLng:lat+","+lng))+"&z=15&output=embed";
 const openUrl=hasLive&&hasService
  ? "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(liveLat+","+liveLng)+"&destination="+encodeURIComponent(lat+","+lng)+"&travelmode=driving"
  : "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent((hasService?lat+","+lng:liveLat+","+liveLng));

 return <View style={s.container}>
  {React.createElement("iframe" as any,{
   title:"KAMPRO job location map",
   src:embedUrl,
   width:"100%",
   height:"250",
   loading:"lazy",
   referrerPolicy:"no-referrer-when-downgrade",
   allowFullScreen:true,
   style:{border:0,display:"block",width:"100%",height:250}
  })}
  <View style={s.legend}>
   <Text style={s.legendText}>📍 {serviceLabel||"Service location"}</Text>
   <Text style={[s.liveText,!hasLive&&s.waitingText]}>{hasLive?"🟢 Professional GPS location available":"Waiting for professional GPS coordinates"}</Text>
  </View>
  <Pressable accessibilityRole="link" onPress={()=>{void Linking.openURL(openUrl)}} style={s.openButton}>
   <Text style={s.openButtonText}>{hasLive&&hasService?"Open route in Google Maps":"Open location in Google Maps"} ↗</Text>
  </Pressable>
 </View>;
}

const s=StyleSheet.create({
 container:{marginTop:14,borderRadius:18,overflow:"hidden",backgroundColor:"#e9f3ef"},
 mapFallback:{minHeight:110,borderRadius:18,marginTop:14,padding:18,backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},
 fallbackTitle:{fontWeight:"900",color:"#10233F",textAlign:"center"},
 fallbackText:{marginTop:7,color:"#475467",textAlign:"center",lineHeight:19},
 legend:{paddingHorizontal:12,paddingVertical:10,backgroundColor:"#f4f8f6",gap:5},
 legendText:{fontWeight:"800",color:"#10233F"},
 liveText:{fontSize:12,fontWeight:"800",color:"#087D65"},
 waitingText:{color:"#9A6700"},
 openButton:{padding:11,alignItems:"center",backgroundColor:"#fff0ea",borderTopWidth:1,borderTopColor:"#ffd5c8"},
 openButtonText:{color:"#FF4B1F",fontWeight:"900"}
});
