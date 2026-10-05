import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import MapView, { Callout, Marker } from "react-native-maps";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";

type Skill={id:string;name:string;category:string};
type Professional={
  professional_id:string;
  display_name:string;
  headline:string|null;
  city:string|null;
  state:string|null;
  avatar_url:string|null;
  trust_score:number;
  verification_status:string;
  is_available:boolean;
  distance_km:number;
  latitude:number;
  longitude:number;
  profile_completion:number;
  skills:{id:string;name:string;category:string;primary:boolean}[]
};
type Coords={latitude:number;longitude:number};

export default function Marketplace(){
  const[skills,setSkills]=useState<Skill[]>([]);
  const[selected,setSelected]=useState<string|null>(null);
  const[items,setItems]=useState<Professional[]>([]);
  const[loading,setLoading]=useState(true);
  const[locationReady,setLocationReady]=useState(false);
  const[userCoords,setUserCoords]=useState<Coords|null>(null);
  const[radius,setRadius]=useState(10);

  useEffect(()=>{loadSkills();requestLocation();},[]);

  async function loadSkills(){
    const{data}=await supabase.from("skills").select("id,name,category").eq("is_active",true).order("category").order("name");
    setSkills(data??[]);
  }

  async function requestLocation(){
    setLoading(true);
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=="granted"){
      setLoading(false);
      Alert.alert("Location needed","Allow location access to find professionals around you.");
      return;
    }

    const pos=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    const coords={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
    setUserCoords(coords);

    const{data,error}=await supabase.rpc("nearby_professionals_map",{
      p_latitude:coords.latitude,
      p_longitude:coords.longitude,
      p_radius_km:radius,
      p_skill_id:selected
    });

    if(error) Alert.alert("Search failed",error.message);
    else{
      setItems((data??[]) as Professional[]);
      setLocationReady(true);
    }
    setLoading(false);
  }

  return <SafeAreaView style={s.safe}>
    <View style={s.container}>
      <Text style={s.title}>Find Skills Around You</Text>
      <Text style={s.subtitle}>Every verified and available professional in your search area is shown on the map.</Text>

      <View style={s.radiusRow}>
        <Text style={s.label}>Within</Text>
        {[5,10,25,50].map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radius,radius===x&&s.selected]}>
          <Text>{x} km</Text>
        </Pressable>)}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{id:"all",name:"All",category:""} as Skill,...skills]}
        keyExtractor={x=>x.id}
        contentContainerStyle={s.skills}
        renderItem={({item})=><Pressable
          onPress={()=>setSelected(item.id==="all"?null:(selected===item.id?null:item.id))}
          style={[s.skill,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillSelected]}
        >
          <Text>{item.name}</Text>
        </Pressable>}
      />

      <Pressable onPress={requestLocation} style={s.search}>
        <Text style={s.searchText}>{loading?"Finding...":"Refresh map & professionals"}</Text>
      </Pressable>

      {!locationReady&&!loading&&<Text style={s.hint}>Turn on location to discover professionals around you.</Text>}

      {loading?<ActivityIndicator style={{marginTop:30}}/>:
        <>
          {userCoords&&<View style={s.mapWrap}>
            <MapView
              style={s.map}
              initialRegion={{...userCoords,latitudeDelta:0.12,longitudeDelta:0.12}}
              showsUserLocation
              showsMyLocationButton
            >
              {items.map(worker=><Marker
                key={worker.professional_id}
                coordinate={{latitude:worker.latitude,longitude:worker.longitude}}
                title={worker.display_name}
                description={`${worker.headline||"Verified professional"} • ${worker.distance_km} km away`}
              >
                <View style={s.marker}>
                  <Text style={s.markerText}>{worker.display_name.slice(0,1).toUpperCase()}</Text>
                </View>
                <Callout onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:worker.professional_id}})}>
                  <View style={s.callout}>
                    <Text style={s.calloutName}>{worker.display_name}</Text>
                    <Text>{worker.headline||"Verified professional"}</Text>
                    <Text>{worker.distance_km} km • Trust {Math.round(worker.trust_score)}/100</Text>
                    <Text style={s.calloutLink}>View professional</Text>
                  </View>
                </Callout>
              </Marker>)}
            </MapView>
            <View style={s.mapBadge}>
              <Text style={s.mapBadgeText}>{items.length} professionals on map</Text>
            </View>
          </View>}

          <FlatList
            data={items}
            keyExtractor={x=>x.professional_id}
            ListEmptyComponent={<Text style={s.empty}>No verified professionals found in this area yet.</Text>}
            renderItem={({item})=><View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.avatar}><Text>{item.display_name.slice(0,1).toUpperCase()}</Text></View>
                <View style={{flex:1}}>
                  <Text style={s.name}>{item.display_name}</Text>
                  <Text style={s.headline}>{item.headline||"Professional on VASUDHA CONNECT"}</Text>
                  <Text>{item.distance_km} km away</Text>
                </View>
                <View>
                  <Text style={s.trust}>{Math.round(item.trust_score)}/100</Text>
                  <Text style={s.complete}>{Math.round(item.profile_completion||0)}% profile</Text>
                  <Text style={s.verified}>✓ Verified</Text>
                </View>
              </View>
              <View style={s.chips}>{item.skills.slice(0,3).map(k=><Text key={k.id} style={s.chip}>{k.name}</Text>)}</View>
              <Pressable style={s.connect} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:item.professional_id}})}>
                <Text style={s.connectText}>View professional</Text>
              </Pressable>
            </View>}
          />
        </>
      }
    </View>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1},
  container:{flex:1,padding:18},
  title:{fontSize:26,fontWeight:"800"},
  subtitle:{marginTop:4,opacity:.65},
  radiusRow:{flexDirection:"row",alignItems:"center",gap:8,marginTop:18},
  label:{fontWeight:"700",marginRight:4},
  radius:{borderWidth:1,borderColor:"#ccc",paddingHorizontal:10,paddingVertical:7,borderRadius:10},
  selected:{borderWidth:2},
  skills:{gap:8,paddingVertical:15},
  skill:{borderWidth:1,borderColor:"#ccc",paddingHorizontal:14,paddingVertical:9,borderRadius:18},
  skillSelected:{borderWidth:2},
  search:{borderRadius:12,borderWidth:1,padding:14,alignItems:"center"},
  searchText:{fontWeight:"800"},
  hint:{marginTop:20,opacity:.65},
  mapWrap:{height:300,marginTop:14,borderRadius:16,overflow:"hidden",borderWidth:1,borderColor:"#ddd"},
  map:{flex:1},
  mapBadge:{position:"absolute",top:10,left:10,backgroundColor:"white",paddingHorizontal:10,paddingVertical:7,borderRadius:14},
  mapBadgeText:{fontWeight:"800"},
  marker:{width:38,height:38,borderRadius:19,borderWidth:2,borderColor:"white",backgroundColor:"#0b8f72",alignItems:"center",justifyContent:"center"},
  markerText:{color:"white",fontWeight:"900"},
  callout:{width:190,padding:6},
  calloutName:{fontWeight:"800",fontSize:15},
  calloutLink:{fontWeight:"800",marginTop:5},
  empty:{marginTop:30,textAlign:"center",opacity:.65},
  card:{borderWidth:1,borderRadius:16,padding:16,marginTop:14},
  cardTop:{flexDirection:"row",gap:12,alignItems:"center"},
  avatar:{width:48,height:48,borderRadius:24,borderWidth:1,alignItems:"center",justifyContent:"center"},
  name:{fontSize:17,fontWeight:"800"},
  headline:{opacity:.7,marginVertical:3},
  trust:{fontWeight:"800",textAlign:"right"},
  verified:{fontSize:11,marginTop:3},
  chips:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:12},
  chip:{borderWidth:1,borderRadius:12,paddingHorizontal:9,paddingVertical:5,fontSize:12},
  connect:{marginTop:12,borderWidth:1,borderRadius:10,padding:11,alignItems:"center"},
  connectText:{fontWeight:"700"},
  complete:{fontSize:11,opacity:.6,marginTop:3}
});