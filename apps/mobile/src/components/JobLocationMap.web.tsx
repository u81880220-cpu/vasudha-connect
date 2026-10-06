import { View, Text, StyleSheet } from "react-native";
export default function JobLocationMap({latitude,longitude,label}:{latitude?:number|null;longitude?:number|null;label?:string|null}){
 if(latitude==null||longitude==null)return <View style={s.map}><View style={s.route}/><Text style={s.mapText}>{label||"Service location"}</Text></View>;
 return <View style={s.map}><View style={s.route}/><Text style={s.mapText}>📍 {label||"Service location"} · {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</Text></View>;
}
const s=StyleSheet.create({map:{height:180,borderRadius:18,marginTop:14,backgroundColor:"#e9f3ef",overflow:"hidden",alignItems:"center",justifyContent:"center"},route:{width:"70%",height:3,backgroundColor:"#087D65",transform:[{rotate:"-18deg"}]},mapText:{position:"absolute",bottom:12,backgroundColor:"#fff",paddingHorizontal:10,paddingVertical:6,borderRadius:10,fontWeight:"800"}});
