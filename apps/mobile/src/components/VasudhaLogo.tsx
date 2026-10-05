import Svg,{Path,Circle} from "react-native-svg";
import {View,Text,StyleSheet} from "react-native";

export function VasudhaLogo({compact=false}:{compact?:boolean}){
 return <View style={s.wrap}>
   <Svg width={compact?34:44} height={compact?40:52} viewBox="0 0 44 52">
     <Path d="M22 2C12 8 7 17 9 27c2 10 8 16 13 21 5-5 11-11 13-21C37 17 32 8 22 2Z" fill="#087D65"/>
     <Path d="M22 11c-5 4-7 9-7 14 0 6 3 10 7 14 4-4 7-8 7-14 0-5-2-10-7-14Z" fill="#19B58B"/>
     <Circle cx="22" cy="24" r="4.5" fill="#fff"/>
     <Path d="M22 28v10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
   </Svg>
   {!compact&&<View><Text style={s.brand}>VASUDHA</Text><Text style={s.connect}>CONNECT</Text></View>}
 </View>
}
const s=StyleSheet.create({wrap:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},brand:{fontSize:24,fontWeight:"900",letterSpacing:.4,color:"#087D65"},connect:{fontSize:12,fontWeight:"900",letterSpacing:2,color:"#087D65",marginTop:-2}});
