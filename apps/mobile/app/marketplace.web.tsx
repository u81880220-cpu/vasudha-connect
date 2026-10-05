import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { ServicePicker, ServiceSelection } from "../src/components/ServicePicker";

type Professional={professional_id:string;display_name:string;headline:string|null;trust_score:number;verification_status:string;is_available:boolean;distance_km:number;city:string|null;state:string|null};

const QA_LOCATION={latitude:25.3176,longitude:82.9739};

export default function MarketplaceWeb(){
  const [selection,setSelection]=useState<ServiceSelection>({categoryId:null,categoryName:null,serviceId:null,serviceName:null,subServiceId:null,subServiceName:null});
  const [items,setItems]=useState<Professional[]>([]);
  const [loading,setLoading]=useState(true);
  const [radius,setRadius]=useState(10);

  useEffect(()=>{search();},[selection.serviceId,selection.subServiceId,radius]);

  async function search(){
    setLoading(true);
    const {data,error}=await supabase.rpc("nearby_professionals_map",{
      p_latitude:QA_LOCATION.latitude,
      p_longitude:QA_LOCATION.longitude,
      p_radius_km:radius,
      p_skill_id:selection.legacySkillId||null,
      p_sub_service_id:selection.subServiceId||null
    });
    if(error){console.error(error);setItems([]);}
    else setItems((data??[]) as Professional[]);
    setLoading(false);
  }

  return <SafeAreaView style={s.safe}>
    <View style={s.container}>
      <View style={s.header}>
        <View style={{flex:1}}>
          <VasudhaLogo compact/>
          <Text style={s.title}>Find Skills Around You</Text>
          <Text style={s.subtitle}>{items.length} professionals nearby</Text>
        </View>
        <Pressable style={s.refresh} onPress={search}><Text style={s.refreshText}>↻</Text></Pressable>
      </View>

      <View style={s.picker}><ServicePicker value={selection} optionalSubService onChange={setSelection} title="What service do you need?"/></View>

      <View style={s.radiusRow}>
        <Text style={s.label}>Nearby</Text>
        {[5,10,25,50].map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radius,radius===x&&s.radiusSelected]}>
          <Text style={radius===x?s.radiusTextSelected:s.radiusText}>{x} km</Text>
        </Pressable>)}
      </View>

      <View style={s.info}>
        <Text style={s.infoTitle}>Nearby professionals</Text>
        <Text style={s.infoText}>Showing verified marketplace professionals around the Varanasi QA location. On mobile, your live location is used.</Text>
      </View>

      {loading?<View style={s.loading}><ActivityIndicator/><Text style={s.muted}>Finding nearby professionals…</Text></View>:null}

      <Text style={s.listTitle}>{selection.serviceName||"All professionals"}</Text>
      <FlatList data={items} keyExtractor={x=>x.professional_id} contentContainerStyle={s.list}
        ListEmptyComponent={!loading?<Text style={s.empty}>No professionals found in this area.</Text>:null}
        renderItem={({item})=><Pressable style={s.card} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:item.professional_id,subServiceId:selection.subServiceId||"",serviceId:selection.serviceId||"",serviceName:selection.serviceName||"",subServiceName:selection.subServiceName||""}})}>
          <View style={s.cardTop}>
            <View style={s.avatar}><Text style={s.avatarText}>{item.display_name.slice(0,1).toUpperCase()}</Text></View>
            <View style={{flex:1}}>
              <Text style={s.name}>{item.display_name}</Text>
              <Text style={s.headline}>{item.headline||"Verified professional"}</Text>
            </View>
            <Text style={s.verified}>✓</Text>
          </View>
          <Text style={s.distance}>⌖ {item.distance_km} km away</Text>
          <Text style={s.trust}>Trust {Math.round(item.trust_score)}/100</Text>
          <Text style={s.view}>View profile →</Text>
        </Pressable>}/>
    </View>
    <AppBottomNav active="map"/>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff"},container:{flex:1,paddingHorizontal:14},
  header:{paddingTop:8,flexDirection:"row",alignItems:"center",gap:10},title:{fontSize:22,fontWeight:"800",marginTop:6},subtitle:{opacity:.6,marginTop:2},
  refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},refreshText:{fontSize:24},
  picker:{paddingTop:8},radiusRow:{flexDirection:"row",alignItems:"center",gap:7,paddingVertical:10},label:{fontWeight:"800",marginRight:3},
  radius:{paddingHorizontal:11,paddingVertical:6,borderRadius:14,backgroundColor:"#f3f5f5"},radiusSelected:{backgroundColor:"#d8f4eb"},radiusText:{fontSize:12},radiusTextSelected:{fontSize:12,fontWeight:"800"},
  info:{borderWidth:1,borderColor:"#dfe8e4",borderRadius:16,padding:16,backgroundColor:"#f4faf8"},infoTitle:{fontSize:18,fontWeight:"800"},infoText:{marginTop:5,lineHeight:19,opacity:.68},
  loading:{padding:16,alignItems:"center"},muted:{opacity:.6,marginTop:6},listTitle:{fontSize:18,fontWeight:"800",marginTop:14},list:{paddingTop:8,paddingBottom:80,gap:10},empty:{padding:20,opacity:.6},
  card:{borderRadius:16,borderWidth:1,borderColor:"#e2e7e6",padding:14,backgroundColor:"#fff"},cardTop:{flexDirection:"row",alignItems:"center",gap:10},avatar:{width:44,height:44,borderRadius:22,backgroundColor:"#edf1f5",alignItems:"center",justifyContent:"center"},avatarText:{fontWeight:"900"},name:{fontSize:16,fontWeight:"800"},headline:{fontSize:12,opacity:.6,marginTop:2},verified:{color:"#0b8f72",fontSize:20},distance:{marginTop:10,opacity:.65},trust:{marginTop:7,fontWeight:"800",color:"#087d65"},view:{marginTop:9,fontWeight:"800",color:"#087d65"}
});