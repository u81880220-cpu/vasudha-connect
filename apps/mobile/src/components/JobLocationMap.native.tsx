import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

export default function JobLocationMap({latitude,longitude,label}:{latitude?:number|null;longitude?:number|null;label?:string|null}){
 if(latitude==null||longitude==null)return <View style={s.map}><View style={s.route}/><Text style={s.mapText}>{label||"Service location"}</Text></View>;
 return <View style={s.map}><MapView style={{flex:1}} initialRegion={{latitude:Number(latitude),longitude:Number(longitude),latitudeDelta:0.01,longitudeDelta:0.01}}><Marker coordinate={{latitude:Number(latitude),longitude:Number(longitude)}} title="Service location" description={label||undefined}/></MapView></View>;
}
const s=StyleSheet.create({map:{height:180,borderRadius:18,marginTop:14,backgroundColor:"#e9f3ef",overflow:"hidden",alignItems:"center",justifyContent:"center"},route:{width:"70%",height:3,backgroundColor:"#087D65",transform:[{rotate:"-18deg"}]},mapText:{position:"absolute",bottom:12,backgroundColor:"#fff",paddingHorizontal:10,paddingVertical:6,borderRadius:10,fontWeight:"800"}});
