import { View, Text, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";
export default function JobTrackingLocationMap({serviceLatitude,serviceLongitude,serviceLabel,liveLatitude,liveLongitude}:{serviceLatitude?:number|null;serviceLongitude?:number|null;serviceLabel?:string|null;liveLatitude?:number|null;liveLongitude?:number|null}){
 if(serviceLatitude==null||serviceLongitude==null)return null;
 return <View style={s.map}><MapView style={{flex:1}} initialRegion={{latitude:Number(serviceLatitude),longitude:Number(serviceLongitude),latitudeDelta:0.01,longitudeDelta:0.01}}><Marker coordinate={{latitude:Number(serviceLatitude),longitude:Number(serviceLongitude)}} title="Service location" description={serviceLabel||undefined}/>{liveLatitude!=null&&liveLongitude!=null?<Marker coordinate={{latitude:Number(liveLatitude),longitude:Number(liveLongitude)}} title="Professional live location" pinColor="#087D65"/>:null}</MapView></View>;
}
const s=StyleSheet.create({map:{height:200,borderRadius:18,marginTop:14,overflow:"hidden",backgroundColor:"#e9f3ef",alignItems:"center",justifyContent:"center"}});
