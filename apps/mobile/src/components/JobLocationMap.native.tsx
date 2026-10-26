import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function JobLocationMap({latitude,longitude,label}:{latitude?:number|null;longitude?:number|null;label?:string|null}){
 const lat=latitude==null?NaN:Number(latitude),lng=longitude==null?NaN:Number(longitude);
 const valid=Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180&&!(lat===0&&lng===0);
 if(!valid)return <View style={s.map}><View style={s.route}/><Text style={s.mapText}>{label||"Service location"} · Map coordinates unavailable</Text></View>;
 return <View style={s.map}><MapView style={{flex:1}} initialRegion={{latitude:lat,longitude:lng,latitudeDelta:0.01,longitudeDelta:0.01}}><Marker coordinate={{latitude:lat,longitude:lng}} title="Service location" description={label||undefined}/></MapView></View>;
}
const s=StyleSheet.create({map:{height:180,borderRadius:18,marginTop:14,backgroundColor:"#e9f3ef",overflow:"hidden",alignItems:"center",justifyContent:"center"},route:{width:"70%",height:3,backgroundColor:"#087D65",transform:[{rotate:"-18deg"}]},mapText:{position:"absolute",bottom:12,backgroundColor:"#fff",paddingHorizontal:10,paddingVertical:6,borderRadius:10,fontWeight:"800"}});
