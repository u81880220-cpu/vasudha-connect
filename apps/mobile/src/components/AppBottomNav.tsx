import { router,usePathname } from "expo-router";
import { Pressable,StyleSheet,Text,View } from "react-native";
const tabs=[["/home","⌂","Home"],["/marketplace","⌖","Map"],["/jobs","▣","Jobs"],["/connections","◌","Messages"],["/profile","◉","Profile"]] as const;
export function AppBottomNav(){
 const path=usePathname();
 return <View style={s.bar}>{tabs.map(([href,icon,label])=>{const active=path===href;return <Pressable key={href} onPress={()=>router.replace(href)} style={s.item}><Text style={[s.icon,active&&s.active]}>{icon}</Text><Text style={[s.label,active&&s.active]}>{label}</Text></Pressable>})}</View>
}
const s=StyleSheet.create({bar:{height:70,flexDirection:"row",borderTopWidth:1,borderTopColor:"#e5ece9",backgroundColor:"#fff",paddingBottom:8,paddingTop:7},item:{flex:1,alignItems:"center",justifyContent:"center"},icon:{fontSize:20,color:"#68736f",lineHeight:25},label:{fontSize:11,fontWeight:"700",color:"#68736f",marginTop:2},active:{color:"#087D65"}});
