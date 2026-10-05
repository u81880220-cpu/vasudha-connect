import Svg,{Path,Circle,Rect} from "react-native-svg";
import {View,Text,StyleSheet} from "react-native";

const glyphs:Record<string,string>={
  Electrician:"⚡",Plumber:"🔧",Carpenter:"▱",Painter:"◈","AC Technician":"❄",Cook:"♨",Driver:"▣",
  Beautician:"✦",Photographer:"◉",Accountant:"₹",Tutor:"Aa",Helper:"+",Loader:"▤",Mover:"⇢","Security Guard":"✓"
};
export function ServiceIcon({name,size=38}:{name:string;size?:number}){
 const glyph=glyphs[name]||"✦";
 return <View style={[s.box,{width:size,height:size,borderRadius:size*.28}]}><Text style={[s.glyph,{fontSize:size*.42}]}>{glyph}</Text></View>
}
const s=StyleSheet.create({box:{backgroundColor:"#E7F7F2",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#CBEDE3"},glyph:{color:"#087D65",fontWeight:"900"}});
