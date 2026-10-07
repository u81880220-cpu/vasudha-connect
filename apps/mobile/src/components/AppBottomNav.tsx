import { router,usePathname } from "expo-router";
import { Pressable,StyleSheet,Text,View } from "react-native";
import { KAMPRO } from "./kamproTheme";

const tabs=[
  ["/home","⌂","Home"],
  ["/marketplace","⌖","Find a Pro"],
  ["/connections","◌","Chat"],
  ["/profile","◉","Profile"],
] as const;

export function AppBottomNav(){
  const path=usePathname();
  return (
    <View style={s.bar}>
      {tabs.map(([href,icon,label])=>{
        const active=path===href;
        return (
          <Pressable
            key={href}
            accessibilityRole="button"
            accessibilityState={{selected:active}}
            onPress={()=>router.replace(href)}
            style={({pressed})=>[s.item,pressed&&s.pressed]}
          >
            <View style={[s.iconPill,active&&s.iconPillActive]}>
              <Text style={[s.icon,active&&s.active]}>{icon}</Text>
            </View>
            <Text style={[s.label,active&&s.active]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const s=StyleSheet.create({
  bar:{
    height:76,
    flexDirection:"row",
    borderTopWidth:1,
    borderTopColor:KAMPRO.border,
    backgroundColor:KAMPRO.surface,
    paddingBottom:8,
    paddingTop:8,
    shadowColor:"#000",
    shadowOpacity:.06,
    shadowRadius:10,
    shadowOffset:{width:0,height:-3},
    elevation:8
  },
  item:{flex:1,alignItems:"center",justifyContent:"center",minWidth:52},
  pressed:{opacity:.65},
  iconPill:{width:38,height:30,borderRadius:15,alignItems:"center",justifyContent:"center"},
  iconPillActive:{backgroundColor:"#FFF0EA"},
  icon:{fontSize:20,color:KAMPRO.muted,lineHeight:25},
  label:{fontSize:11,fontWeight:"800",color:KAMPRO.muted,marginTop:3},
  active:{color:KAMPRO.brand},
});
