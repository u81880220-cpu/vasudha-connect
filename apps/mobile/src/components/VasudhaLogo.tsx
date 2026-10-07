import Svg,{Path} from "react-native-svg";
import {View,Text,StyleSheet} from "react-native";

export function VasudhaLogo({compact=false}:{compact?:boolean}){
  return (
    <View style={s.wrap}>
      <Svg width={compact?42:54} height={compact?38:48} viewBox="0 0 54 48">
        <Path d="M3 29 27 10l24 19" fill="none" stroke="#FF4B1F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M9 27v15h36V27" fill="none" stroke="#10233F" strokeWidth="4" strokeLinejoin="round"/>
        <Path d="M20 42V29h14v13" fill="none" stroke="#10233F" strokeWidth="4"/>
        <Path d="M27 4v8" stroke="#FFB11B" strokeWidth="4" strokeLinecap="round"/>
      </Svg>
      {!compact&&(
        <View>
          <Text style={s.brand}>KAMPRO</Text>
          <Text style={s.tagline}>Kam hai? Pro bulaiye.</Text>
        </View>
      )}
    </View>
  );
}
const s=StyleSheet.create({
  wrap:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},
  brand:{fontSize:24,fontWeight:"900",letterSpacing:.6,color:"#10233F"},
  tagline:{fontSize:10,fontWeight:"800",color:"#FF4B1F",marginTop:-1},
});
