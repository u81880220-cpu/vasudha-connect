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
 const openMaps=()=> {
  const destination=hasService?lat+","+lng:(serviceLabel||"Raebareli, Uttar Pradesh");
  const url=hasLive&&hasService
   ? "https://www.google.com/maps/dir/?api=1&origin="+encodeURIComponent(liveLat+","+liveLng)+"&destination="+encodeURIComponent(destination)+"&travelmode=driving"
   : "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(destination);
  void Linking.openURL(url).catch(()=>{});
 };

 // Avoid initializing react-native-maps until valid coordinates exist.
 if(!hasService&&!hasLive)return <View style={s.mapFallback}>
  <Text style={s.fallbackTitle}>Live map is waiting for GPS coordinates</Text>
  <Text style={s.fallbackText}>{serviceLabel||"Service location"}{!hasLive?" · Waiting for the professional to share location.":""}</Text>
  <Pressable accessibilityRole="button" onPress={openMaps} style={s.mapsButton}><Text style={s.mapsButtonText}>Open service location in Google Maps</Text></Pressable>
 </View>;

 let MapView:any, Marker:any;
 try {
  const maps=require("react-native-maps");
  MapView=maps.default||maps;
  Marker=maps.Marker;
 } catch(e) {
  return <View style={s.mapFallback}>
   <Text style={s.fallbackTitle}>Map unavailable on this device</Text>
   <Text style={s.fallbackText}>Your job status is still available. Open the location in Google Maps to navigate.</Text>
   <Pressable accessibilityRole="button" onPress={openMaps} style={s.mapsButton}><Text style={s.mapsButtonText}>Open in Google Maps</Text></Pressable>
  </View>;
 }
 const centerLat=hasService&&hasLive?(lat+liveLat)/2:hasService?lat:liveLat;
 const centerLng=hasService&&hasLive?(lng+liveLng)/2:hasService?lng:liveLng;
 const region={latitude:centerLat,longitude:centerLng,latitudeDelta:hasService&&hasLive?Math.max(0.01,Math.abs(lat-liveLat)*1.5):0.01,longitudeDelta:hasService&&hasLive?Math.max(0.01,Math.abs(lng-liveLng)*1.5):0.01};
 return <View style={s.map}><MapView style={{flex:1}} region={region}>{hasService?<Marker coordinate={{latitude:lat,longitude:lng}} title="Service location" description={serviceLabel||undefined}/>:null}{hasLive?<Marker coordinate={{latitude:liveLat,longitude:liveLng}} title="Professional live location" pinColor="#087D65"/>:null}</MapView></View>;
}
const s=StyleSheet.create({
 map:{height:220,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},
 mapFallback:{minHeight:100,borderRadius:18,marginTop:14,padding:16,backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"},
 fallbackTitle:{fontWeight:"900",color:"#10233F",textAlign:"center"},
 fallbackText:{marginTop:6,color:"#475467",textAlign:"center"},
 mapsButton:{marginTop:12,paddingHorizontal:14,paddingVertical:10,borderRadius:10,backgroundColor:"#FF4B1F"},
 mapsButtonText:{color:"#fff",fontWeight:"800",textAlign:"center"}
});
