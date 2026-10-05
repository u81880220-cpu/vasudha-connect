import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { ServiceIcon } from "../src/components/ServiceIcon";

type Skill={id:string;name:string;category:string};
type Professional={
  professional_id:string; display_name:string; headline:string|null; city:string|null; state:string|null;
  avatar_url:string|null; trust_score:number; verification_status:string; is_available:boolean;
  distance_km:number; latitude:number; longitude:number; profile_completion:number;
  skills:{id:string;name:string;category:string;primary:boolean}[];
};

export default function MarketplaceWeb(){
  const [skills,setSkills]=useState<Skill[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [items,setItems]=useState<Professional[]>([]);
  const [loading,setLoading]=useState(true);
  const [radius,setRadius]=useState(10);
  const [locationMessage,setLocationMessage]=useState("");

  useEffect(()=>{loadSkills(); requestLocation();},[]);
  useEffect(()=>{requestLocation();},[selected,radius]);

  async function loadSkills(){
    const {data}=await supabase.from("skills").select("id,name,category").eq("is_active",true).order("category").order("name");
    setSkills(data??[]);
  }

  function requestLocation(){
    if(!navigator.geolocation){
      setLoading(false);
      setLocationMessage("Browser location is not available. Please use the Android app for the live map.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      position=>searchProfessionals(position.coords.latitude,position.coords.longitude),
      ()=>{setLoading(false);setLocationMessage("Allow browser location to find verified professionals near you.");},
      {enableHighAccuracy:false,timeout:10000,maximumAge:300000}
    );
  }

  async function searchProfessionals(latitude:number,longitude:number){
    setLocationMessage("");
    const {data,error}=await supabase.rpc("nearby_professionals_map",{
      p_latitude:latitude,p_longitude:longitude,p_radius_km:radius,p_skill_id:selected
    });
    if(error)setLocationMessage(error.message);
    setItems((data??[]) as Professional[]);
    setLoading(false);
  }

  return <SafeAreaView style={s.safe}>
    <View style={s.container}>
      <View style={s.header}>
        <View style={{flex:1}}>
          <VasudhaLogo compact />
          <Text style={s.title}>Find Skills Around You</Text>
          <Text style={s.subtitle}>{items.length} verified professionals nearby</Text>
        </View>
        <Pressable style={s.refresh} onPress={requestLocation}><Text style={s.refreshText}>↻</Text></Pressable>
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={[{id:"all",name:"All",category:""} as Skill,...skills]}
        keyExtractor={x=>x.id}
        contentContainerStyle={s.skills}
        renderItem={({item})=><Pressable onPress={()=>setSelected(item.id==="all"?null:item.id)} style={[s.skill,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillSelected]}>
          <ServiceIcon name={item.name} size={28}/>
          <Text style={[s.skillText,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillTextSelected]}>{item.name}</Text>
        </Pressable>}
      />

      <View style={s.radiusRow}>
        <Text style={s.label}>Nearby</Text>
        {[5,10,25,50].map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radius,radius===x&&s.radiusSelected]}>
          <Text style={radius===x?s.radiusTextSelected:s.radiusText}>{x} km</Text>
        </Pressable>)}
      </View>

      <View style={s.webMap}>
        <Text style={s.mapTitle}>Nearby professionals</Text>
        <Text style={s.mapText}>The live native map is available in the Android app. This browser preview uses your browser location and the same verified-professional search.</Text>
        <Pressable style={s.locationButton} onPress={requestLocation}><Text style={s.locationButtonText}>Refresh my location</Text></Pressable>
        {locationMessage?<Text style={s.error}>{locationMessage}</Text>:null}
        <View style={s.mapStats}><Text style={s.mapStatNumber}>{items.length}</Text><Text> professionals found within {radius} km</Text></View>
      </View>

      {loading?<View style={s.loading}><ActivityIndicator/><Text style={s.muted}>Finding nearby professionals…</Text></View>:null}

      <Text style={s.listTitle}>{selected?skills.find(x=>x.id===selected)?.name:"All professionals"}</Text>
      <FlatList
        data={items}
        keyExtractor={x=>x.professional_id}
        contentContainerStyle={s.list}
        ListEmptyComponent={!loading?<Text style={s.empty}>No professionals found in this area.</Text>:null}
        renderItem={({item})=><Pressable style={s.card} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:item.professional_id}})}>
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
        </Pressable>}
      />
    </View>
    <AppBottomNav />
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff"},container:{flex:1,paddingHorizontal:14},
  header:{paddingTop:8,flexDirection:"row",alignItems:"center",gap:10},title:{fontSize:22,fontWeight:"800",marginTop:6},subtitle:{opacity:.6,marginTop:2},
  refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},refreshText:{fontSize:24},
  skills:{paddingVertical:10,gap:8},skill:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,backgroundColor:"#f3f5f5",alignItems:"center",minWidth:66},skillSelected:{backgroundColor:"#0b8f72"},skillText:{fontWeight:"700"},skillTextSelected:{color:"#fff"},
  radiusRow:{flexDirection:"row",alignItems:"center",gap:7,paddingBottom:10},label:{fontWeight:"800",marginRight:3},radius:{paddingHorizontal:11,paddingVertical:6,borderRadius:14,backgroundColor:"#f3f5f5"},radiusSelected:{backgroundColor:"#d8f4eb"},radiusText:{fontSize:12},radiusTextSelected:{fontSize:12,fontWeight:"800"},
  webMap:{borderWidth:1,borderColor:"#dfe8e4",borderRadius:16,padding:18,backgroundColor:"#f4faf8"},mapTitle:{fontSize:18,fontWeight:"800",color:"#13201c"},mapText:{marginTop:6,lineHeight:19,opacity:.68},locationButton:{alignSelf:"flex-start",marginTop:12,backgroundColor:"#087D65",paddingHorizontal:14,paddingVertical:10,borderRadius:10},locationButtonText:{color:"#fff",fontWeight:"800"},mapStats:{flexDirection:"row",alignItems:"baseline",marginTop:14},mapStatNumber:{fontSize:28,fontWeight:"900",color:"#087D65"},error:{marginTop:8,color:"#b42318",fontSize:12},loading:{padding:16,alignItems:"center"},muted:{opacity:.6,marginTop:6},listTitle:{fontSize:18,fontWeight:"800",marginTop:14},list:{paddingTop:8,paddingBottom:80,gap:10},empty:{padding:20,opacity:.6},
  card:{borderRadius:16,borderWidth:1,borderColor:"#e2e7e6",padding:14,backgroundColor:"#fff"},cardTop:{flexDirection:"row",alignItems:"center",gap:10},avatar:{width:44,height:44,borderRadius:22,backgroundColor:"#edf1f5",alignItems:"center",justifyContent:"center"},avatarText:{fontWeight:"900"},name:{fontSize:16,fontWeight:"800"},headline:{fontSize:12,opacity:.6,marginTop:2},verified:{color:"#0b8f72",fontSize:20},distance:{marginTop:10,opacity:.65},trust:{marginTop:7,fontWeight:"800",color:"#087d65"},view:{marginTop:9,fontWeight:"800",color:"#087d65"}
});