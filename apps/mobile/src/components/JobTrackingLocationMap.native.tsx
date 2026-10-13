import { View, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
export default function JobTrackingLocationMap({serviceLatitude,serviceLongitude,serviceLabel,liveLatitude,liveLongitude}:{serviceLatitude?:number|null;serviceLongitude?:number|null;serviceLabel?:string|null;liveLatitude?:number|null;liveLongitude?:number|null}){
 const lat=serviceLatitude==null?NaN:Number(serviceLatitude);
 const lng=serviceLongitude==null?NaN:Number(serviceLongitude);
 const hasService=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(lat===0&&lng===0);
 if(!hasService)return null;
 const liveLat=liveLatitude==null?NaN:Number(liveLatitude);
 const liveLng=liveLongitude==null?NaN:Number(liveLongitude);
 const hasLive=Number.isFinite(liveLat)&&Number.isFinite(liveLng)&&liveLat>=-90&&liveLat<=90&&liveLng>=-180&&liveLng<=180&&!(liveLat===0&&liveLng===0);
 const region={latitude:hasLive?(lat+liveLat)/2:lat,longitude:hasLive?(lng+liveLng)/2:lng,latitudeDelta:hasLive?Math.max(0.01,Math.abs(lat-liveLat)*1.5):0.01,longitudeDelta:hasLive?Math.max(0.01,Math.abs(lng-liveLng)*1.5):0.01};
 return <View style={s.map}><MapView style={{flex:1}} region={region}><Marker coordinate={{latitude:lat,longitude:lng}} title="Service location" description={serviceLabel||undefined}/>{hasLive?<Marker coordinate={{latitude:liveLat,longitude:liveLng}} title="Professional live location" pinColor="#087D65"/>:null}</MapView></View>;
}
const s=StyleSheet.create({map:{height:200,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"}});
