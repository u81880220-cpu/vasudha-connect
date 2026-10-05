import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Skill={id:string;name:string;category:string};
type Professional={
  professional_id:string; display_name:string; headline:string|null; city:string|null; state:string|null;
  avatar_url:string|null; trust_score:number; verification_status:string; is_available:boolean;
  distance_km:number; latitude:number; longitude:number; profile_completion:number;
  skills:{id:string;name:string;category:string;primary:boolean}[]
};
type Coords={latitude:number;longitude:number};

const MAP_HEIGHT=Math.min(Math.round(Dimensions.get("window").height*0.58),560);

export default function Marketplace(){
  const[skills,setSkills]=useState<Skill[]>([]);
  const[selected,setSelected]=useState<string|null>(null);
  const[items,setItems]=useState<Professional[]>([]);
  const[loading,setLoading]=useState(true);
  const[userCoords,setUserCoords]=useState<Coords|null>(null);
  const[radius,setRadius]=useState(10);

  useEffect(()=>{loadSkills();requestLocation();},[]);
  useEffect(()=>{if(userCoords) searchProfessionals(userCoords);},[selected,radius]);

  async function loadSkills(){
    const{data}=await supabase.from("skills").select("id,name,category").eq("is_active",true).order("category").order("name");
    setSkills(data??[]);
  }

  async function requestLocation(){
    setLoading(true);
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=="granted"){setLoading(false);return;}
    const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    const coords={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
    setUserCoords(coords);
    await searchProfessionals(coords);
  }

  async function searchProfessionals(coords:Coords){
    setLoading(true);
    const{data,error}=await supabase.rpc("nearby_professionals_map",{
      p_latitude:coords.latitude,p_longitude:coords.longitude,p_radius_km:radius,p_skill_id:selected
    });
    if(!error)setItems((data??[]) as Professional[]);
    setLoading(false);
  }

  return <SafeAreaView style={s.safe}>
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Find Skills Around You</Text>
          <Text style={s.subtitle}>{items.length} professionals nearby</Text>
        </View>
        <Pressable style={s.refresh} onPress={requestLocation}><Text style={s.refreshText}>↻</Text></Pressable>
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={[{id:"all",name:"All",category:""} as Skill,...skills]}
        keyExtractor={x=>x.id}
        contentContainerStyle={s.skills}
        renderItem={({item})=><Pressable
          onPress={()=>setSelected(item.id==="all"?null:item.id)}
          style={[s.skill,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillSelected]}>
          <Text style={[s.skillText,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillTextSelected]}>{item.name}</Text>
        </Pressable>}
      />

      <View style={s.radiusRow}>
        <Text style={s.label}>Nearby</Text>
        {[5,10,25,50].map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radius,radius===x&&s.radiusSelected]}>
          <Text style={radius===x?s.radiusTextSelected:s.radiusText}>{x} km</Text>
        </Pressable>)}
      </View>

      <View style={[s.mapWrap,{height:MAP_HEIGHT}]}>
        {userCoords&&<MapView
          style={s.map}
          initialRegion={{...userCoords,latitudeDelta:0.12,longitudeDelta:0.12}}
          showsUserLocation showsMyLocationButton>
          {items.map(worker=><Marker
            key={worker.professional_id}
            coordinate={{latitude:worker.latitude,longitude:worker.longitude}}
            title={worker.display_name}
            description={`${worker.headline||"Verified professional"} • ${worker.distance_km} km away`}>
            <View style={s.marker}><Text style={s.markerText}>{worker.display_name.slice(0,1).toUpperCase()}</Text></View>
            <Callout onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:worker.professional_id}})}>
              <View style={s.callout}>
                <Text style={s.calloutName}>{worker.display_name}</Text>
                <Text>{worker.headline||"Verified professional"}</Text>
                <Text>{worker.distance_km} km • Trust {Math.round(worker.trust_score)}/100</Text>
                <Text style={s.calloutLink}>View profile</Text>
              </View>
            </Callout>
          </Marker>)}
        </MapView>}
        {!userCoords&&!loading&&<View style={s.locationEmpty}><Text style={s.locationTitle}>Location required</Text><Text>Allow location to see nearby professionals on the map.</Text><Pressable style={s.locationButton} onPress={requestLocation}><Text style={s.locationButtonText}>Enable location</Text></Pressable></View>}
        {loading&&<View style={s.loadingOverlay}><ActivityIndicator size="large"/><Text style={s.loadingText}>Finding nearby professionals…</Text></View>}
        <View style={s.mapBadge}><Text style={s.mapBadgeText}>{items.length} on map</Text></View>
      </View>

      <View style={s.listHeader}>
        <Text style={s.listTitle}>{selected?skills.find(x=>x.id===selected)?.name:"All professionals"}</Text>
        <Text style={s.listHint}>Swipe to view list</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={x=>x.professional_id}
        contentContainerStyle={s.workerRow}
        ListEmptyComponent={!loading?<Text style={s.empty}>No professionals found in this area.</Text>:null}
        renderItem={({item})=><Pressable style={s.card} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:item.professional_id}})}>
          <View style={s.cardTop}>
            <View style={s.avatar}><Text>{item.display_name.slice(0,1).toUpperCase()}</Text></View>
            <View style={{flex:1}}>
              <Text style={s.name} numberOfLines={1}>{item.display_name}</Text>
              <Text style={s.headline} numberOfLines={1}>{item.headline||"Verified professional"}</Text>
            </View>
            <Text style={s.verified}>✓</Text>
          </View>
          <Text style={s.distance}>⌖ {item.distance_km} km away</Text>
          <View style={s.rate}><Text style={s.rateText}>Trust {Math.round(item.trust_score)}/100</Text></View>
          <Text style={s.view}>View profile →</Text>
        </Pressable>}
      />
    </View>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff"}, container:{flex:1}, header:{paddingHorizontal:16,paddingTop:10,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  title:{fontSize:22,fontWeight:"800"},subtitle:{marginTop:2,opacity:.6},refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},refreshText:{fontSize:24},
  skills:{paddingHorizontal:14,paddingVertical:12,gap:8},skill:{paddingHorizontal:16,paddingVertical:9,borderRadius:20,backgroundColor:"#f3f5f5"},skillSelected:{backgroundColor:"#0b8f72"},skillText:{fontWeight:"700"},skillTextSelected:{color:"#fff"},
  radiusRow:{flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:16,paddingBottom:10},label:{fontWeight:"800",marginRight:3},radius:{paddingHorizontal:11,paddingVertical:6,borderRadius:14,backgroundColor:"#f3f5f5"},radiusSelected:{backgroundColor:"#d8f4eb"},radiusText:{fontSize:12},radiusTextSelected:{fontSize:12,fontWeight:"800"},
  mapWrap:{marginHorizontal:0,overflow:"hidden",backgroundColor:"#e8eeee"},map:{flex:1},mapBadge:{position:"absolute",top:12,left:12,backgroundColor:"#fff",paddingHorizontal:11,paddingVertical:7,borderRadius:16,elevation:3},mapBadgeText:{fontWeight:"800"},
  marker:{width:42,height:42,borderRadius:21,borderWidth:3,borderColor:"#fff",backgroundColor:"#0b8f72",alignItems:"center",justifyContent:"center",elevation:4},markerText:{color:"#fff",fontWeight:"900",fontSize:15},
  callout:{width:190,padding:6},calloutName:{fontWeight:"800",fontSize:15},calloutLink:{fontWeight:"800",marginTop:5,color:"#087d65"},loadingOverlay:{position:"absolute",inset:0,backgroundColor:"rgba(255,255,255,.72)",alignItems:"center",justifyContent:"center"},loadingText:{marginTop:8,fontWeight:"700"},
  locationEmpty:{flex:1,alignItems:"center",justifyContent:"center",padding:30},locationTitle:{fontSize:18,fontWeight:"800",marginBottom:6},locationButton:{marginTop:14,backgroundColor:"#0b8f72",paddingHorizontal:18,paddingVertical:11,borderRadius:12},locationButtonText:{color:"#fff",fontWeight:"800"},
  listHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:12},listTitle:{fontSize:17,fontWeight:"800"},listHint:{fontSize:12,opacity:.55},workerRow:{paddingHorizontal:12,paddingBottom:14,gap:10},card:{width:250,borderRadius:16,borderWidth:1,borderColor:"#e2e7e6",padding:12,marginTop:8,backgroundColor:"#fff",elevation:2},cardTop:{flexDirection:"row",alignItems:"center",gap:9},avatar:{width:42,height:42,borderRadius:21,backgroundColor:"#edf1f5",alignItems:"center",justifyContent:"center"},name:{fontSize:15,fontWeight:"800"},headline:{fontSize:12,opacity:.6,marginTop:2},verified:{color:"#0b8f72",fontSize:18},distance:{marginTop:10,fontSize:12,opacity:.65},rate:{marginTop:8,alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:"#e9f8f2"},rateText:{fontSize:12,fontWeight:"800",color:"#087d65"},view:{marginTop:9,fontWeight:"800",color:"#087d65"},empty:{padding:20,opacity:.6}
});