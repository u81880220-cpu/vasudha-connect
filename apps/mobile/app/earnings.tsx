import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";

const rows=[
  ["Electrical repair","₹2,500","Completed"],
  ["Fan installation","₹1,800","Completed"],
  ["Lighting repair","₹2,200","Completed"],
  ["Switch repair","₹1,500","Completed"],
];

export default function Earnings(){
  return <SafeAreaView style={s.safe}>
    <ScrollView contentContainerStyle={s.c} showsVerticalScrollIndicator={false}>
      <VasudhaLogo compact/>
      <View style={s.head}><View><Text style={s.title}>My Earnings</Text><Text style={s.sub}>Track your completed work and earnings.</Text></View><View style={s.period}><Text style={s.periodText}>This Month⌄</Text></View></View>
      <View style={s.hero}><Text style={s.heroLabel}>Total Earnings</Text><Text style={s.heroValue}>₹24,850</Text><Text style={s.heroMeta}>This month</Text></View>
      <View style={s.stats}><View style={s.stat}><Text style={s.num}>12</Text><Text style={s.label}>Completed</Text></View><View style={s.stat}><Text style={s.num}>₹2,071</Text><Text style={s.label}>Avg. job</Text></View><View style={s.stat}><Text style={s.num}>4.8</Text><Text style={s.label}>Rating</Text></View></View>
      <Text style={s.section}>Recent earnings</Text>
      {rows.map(([job,amount,status])=><View style={s.row} key={job}><View style={{flex:1}}><Text style={s.job}>{job}</Text><Text style={s.status}>{status}</Text></View><Text style={s.amount}>+{amount}</Text></View>)}
    </ScrollView>
    <AppBottomNav active="profile"/>
  </SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:"#fff"},c:{padding:20,paddingBottom:100},title:{fontSize:28,fontWeight:"900",color:"#13201c"},sub:{color:"#66736e",marginTop:5},head:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:20},period:{borderWidth:1,borderColor:"#cfdad6",borderRadius:12,paddingHorizontal:12,paddingVertical:9},periodText:{fontSize:12,fontWeight:"800"},hero:{marginTop:18,borderRadius:18,backgroundColor:"#087D65",padding:20},heroLabel:{color:"#dff8f1",fontWeight:"800"},heroValue:{color:"#fff",fontSize:34,fontWeight:"900",marginTop:5},heroMeta:{color:"#dff8f1",marginTop:2},stats:{flexDirection:"row",gap:10,marginTop:12},stat:{flex:1,borderWidth:1,borderColor:"#e2e8e5",borderRadius:15,padding:14},num:{fontSize:19,fontWeight:"900",color:"#087D65"},label:{fontSize:11,color:"#66736e",marginTop:4},section:{fontSize:19,fontWeight:"900",marginTop:24,color:"#13201c"},row:{flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:"#e2e8e5",borderRadius:15,padding:14,marginTop:10},job:{fontWeight:"800",color:"#13201c"},status:{fontSize:11,color:"#66736e",marginTop:3},amount:{fontWeight:"900",color:"#087D65"}});
