import { ReactNode } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "./VasudhaLogo";
import { KAMPRO } from "./kamproTheme";

export function KamproPage({children,scroll=true}:{children:ReactNode;scroll?:boolean}){
 const body=<View style={s.shell}><View style={s.content}>{children}</View></View>;
 return <SafeAreaView style={s.safe}>{scroll?<ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>{body}</ScrollView>:body}</SafeAreaView>;
}
export function KamproHeader({title,subtitle,back,onBack,action}:{title?:string;subtitle?:string;back?:boolean;onBack?:()=>void;action?:ReactNode}){
 return <View style={s.header}>{back?<Pressable onPress={onBack} style={s.back}><Text style={s.backText}>‹</Text></Pressable>:null}<View style={s.brand}><VasudhaLogo compact/></View>{action?<View style={s.headerAction}>{action}</View>:null}{title?<View style={s.headingWrap}><Text style={s.title}>{title}</Text>{subtitle?<Text style={s.subtitle}>{subtitle}</Text>:null}</View>:null}</View>;
}
export function KamproSection({title,children}:{title:string;children:ReactNode}){return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>}
export function KamproCard({children,accent=false}:{children:ReactNode;accent?:boolean}){return <View style={[s.card,accent&&s.accent]}>{children}</View>}
export function KamproPrimary({children,onPress,disabled=false}:{children:ReactNode;onPress?:()=>void;disabled?:boolean}){return <Pressable disabled={disabled} onPress={onPress} style={[s.primary,disabled&&s.disabled]}>{typeof children==="string"?<Text style={s.primaryText}>{children}</Text>:children}</Pressable>}
export function KamproSecondary({children,onPress}:{children:ReactNode;onPress?:()=>void}){return <Pressable onPress={onPress} style={s.secondary}>{typeof children==="string"?<Text style={s.secondaryText}>{children}</Text>:children}</Pressable>}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:KAMPRO.background},
 scroll:{paddingBottom:110},
 shell:{flex:1,alignItems:"center",backgroundColor:KAMPRO.background},
 content:{width:"100%",maxWidth:1180,alignSelf:"center",paddingHorizontal:18,paddingTop:14,paddingBottom:24},
 header:{minHeight:62,position:"relative",justifyContent:"center",marginBottom:8},
 brand:{alignItems:"flex-start"},
 headerAction:{position:"absolute",right:0,top:8},
 headingWrap:{marginTop:18},
 title:{fontSize:30,fontWeight:"900",color:KAMPRO.navy,letterSpacing:-.4},
 subtitle:{fontSize:13,color:KAMPRO.muted,marginTop:5,lineHeight:19},
 back:{position:"absolute",left:0,top:4,width:40,height:40,borderRadius:20,backgroundColor:KAMPRO.surface,alignItems:"center",justifyContent:"center",zIndex:2,borderWidth:1,borderColor:KAMPRO.border},
 backText:{fontSize:30,color:KAMPRO.navy,lineHeight:34},
 section:{marginTop:22},
 sectionTitle:{fontSize:18,fontWeight:"900",color:KAMPRO.navy,marginBottom:10},
 card:{borderWidth:1,borderColor:KAMPRO.border,borderRadius:KAMPRO.radius.lg,padding:18,backgroundColor:KAMPRO.surface,shadowColor:KAMPRO.navy,shadowOpacity:.05,shadowRadius:12,shadowOffset:{width:0,height:5},elevation:2},
 accent:{borderColor:"#FFD2C6",backgroundColor:"#FFF8F5"},
 primary:{minHeight:50,borderRadius:KAMPRO.radius.md,backgroundColor:KAMPRO.brand,alignItems:"center",justifyContent:"center",paddingHorizontal:18},
 primaryText:{color:"#fff",fontWeight:"900",fontSize:15},
 secondary:{minHeight:48,borderRadius:KAMPRO.radius.md,borderWidth:1,borderColor:KAMPRO.brand,backgroundColor:KAMPRO.surface,alignItems:"center",justifyContent:"center",paddingHorizontal:18},
 secondaryText:{color:KAMPRO.brand,fontWeight:"900",fontSize:15},
 disabled:{opacity:.55}
});