import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Switch, Text, View } from "react-native";
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
  skills:{id:string;name:string;category:string;primary:boolean}[]
};
type Coords={latitude:number;longitude:number};

const MAP_HEIGHT=Math.min(Math.max(Math.round(Dimensions.get("window").height*0.42),300),460);

export default function Marketplace(){
  const[skills,setSkills]=useState<Skill[]>([]);
  const[selected,setSelected]=useState<string|null>(null);
  const[items,setItems]=useState<Professional[]>([]);
  const[loading,setLoading]=useState(true);
  const[userCoords,setUserCoords]=useState<Coords|null>(null);
  const[radius,setRadius]=useState(10);
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[verifiedOnly,setVerifiedOnly]=useState(true);
  const[availableOnly,setAvailableOnly]=useState(true);
  const[minRating,setMinRating]=useState(4);
  const visibleItems=items.filter(x=>(!verifiedOnly||x.verification_status==="verified")&&(!availableOnly||x.is_available)&&(Math.round(x.trust_score)/20)>=minRating);

  useEffect(()=>{loadSkills();requestLocation();},[]);
  useEffect(()=>{if(userCoords) searchProfessionals(userCoords);},[selected,radius]);

  async function loadSkills(){
    const{data}=await supabase.from("skills").select("id,name,category").eq("is_active",true).order("category").order("name");
    setSkills(data??[]);
  }

  async function requestLocation(){
    setLoading(true);
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=="granted"){
      // Laptop/browser visual testing: use a safe demo location instead of blocking the UI.
      if(Platform.OS==="web"){
        const demoCoords={latitude:25.3176,longitude:82.9739};
        setUserCoords(demoCoords);
        await searchProfessionals(demoCoords);
      }
      setLoading(false);
      return;
    }
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
    if(!error && (data??[]).length){
      setItems((data??[]) as Professional[]);
    } else if(Platform.OS==="web"){
      // Visual preview fallback only; Android/production remains database-driven.
      const demoNames=["Ramesh Kumar","Amit Singh","Vikram Rao","Suresh Yadav","Priya Sharma"];
      const demoSkills=["Electrician","Plumber","Carpenter","Painter","AC Technician"];
      const demo=(selected ? demoNames.slice(0,3) : demoNames).map((name,i)=>({
        professional_id:`demo-${i}`,
        display_name:name,
        headline:`${demoSkills[i%demoSkills.length]} • Verified professional`,
        city:"Varanasi",state:"Uttar Pradesh",avatar_url:null,
        trust_score:92-i*4,verification_status:"verified",is_available:true,
        distance_km:1.2+i*1.7,latitude:25.3176+(i-2)*0.006,longitude:82.9739+(i-2)*0.007,
        profile_completion:100,
        skills:[{id:`demo-skill-${i}`,name:demoSkills[i%demoSkills.length],category:"service",primary:true}]
      }));
      setItems(demo as Professional[]);
    } else {
      setItems([]);
    }
    setLoading(false);
  }

  return <SafeAreaView style={s.safe}>
    <View style={s.container}>
      <View style={s.header}>
        <VasudhaLogo compact/>
        <View style={s.headerText}>
          <Text style={s.title}>Find Skills Around You</Text>
          <Text style={s.subtitle}>{items.length} professionals nearby</Text>
        </View>
        <View style={s.headerActions}><Pressable style={s.filterButton} onPress={()=>setFiltersOpen(true)}><Text style={s.filterButtonText}>☷</Text></Pressable><Pressable style={s.refresh} onPress={requestLocation}><Text style={s.refreshText}>↻</Text></Pressable></View>
      </View>

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={[{id:"all",name:"All",category:""} as Skill,...skills]}
        keyExtractor={x=>x.id}
        contentContainerStyle={s.skills}
        renderItem={({item})=><Pressable
          onPress={()=>setSelected(item.id==="all"?null:item.id)}
          style={[s.skill,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillSelected]}>
          <ServiceIcon name={item.name} size={30}/><Text style={[s.skillText,((item.id==="all"&&selected===null)||selected===item.id)&&s.skillTextSelected]}>{item.name}</Text>
        </Pressable>}
      />

      <View style={s.radiusRow}>
        <Text style={s.label}>Nearby</Text>
        {[5,10,25,50].map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radius,radius===x&&s.radiusSelected]}>
          <Text style={radius===x?s.radiusTextSelected:s.radiusText}>{x} km</Text>
        </Pressable>)}
      </View>

      <View style={[s.mapWrap,{height:MAP_HEIGHT}]}>
        {userCoords && (Platform.OS==="web"
          ? <WebMap userCoords={userCoords} items={visibleItems}/>
          : <NativeMap userCoords={userCoords} items={visibleItems}/>
        )}
        {!userCoords&&!loading&&<View style={s.locationEmpty}><Text style={s.locationTitle}>Location required</Text><Text>Allow location to see nearby professionals on the map.</Text><Pressable style={s.locationButton} onPress={requestLocation}><Text style={s.locationButtonText}>Enable location</Text></Pressable></View>}
        {loading&&<View style={s.loadingOverlay}><ActivityIndicator size="large"/><Text style={s.loadingText}>Finding nearby professionals…</Text></View>}
        <View style={s.mapBadge}><Text style={s.mapBadgeText}>{visibleItems.length} on map</Text></View>
      </View>

      <View style={s.listHeader}>
        <Text style={s.listTitle}>{selected?skills.find(x=>x.id===selected)?.name:"All professionals"}</Text>
        <Text style={s.listHint}>Swipe to view list</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={visibleItems}
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
<Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={()=>setFiltersOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.filterSheet}>
            <View style={s.sheetHead}><Text style={s.sheetTitle}>Filter Professionals</Text><Pressable onPress={()=>setFiltersOpen(false)}><Text style={s.close}>×</Text></Pressable></View>
            <View style={s.filterRow}><Text style={s.filterLabel}>Verified only</Text><Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{false:"#cfdad6",true:"#087D65"}} /></View>
            <View style={s.filterRow}><Text style={s.filterLabel}>Available now</Text><Switch value={availableOnly} onValueChange={setAvailableOnly} trackColor={{false:"#cfdad6",true:"#087D65"}} /></View>
            <Text style={s.filterLabel}>Minimum rating</Text>
            <View style={s.ratingRow}>{[0,4,4.5,5].map(x=><Pressable key={x} onPress={()=>setMinRating(x)} style={[s.ratingChip,minRating===x&&s.ratingChipOn]}><Text style={minRating===x?s.ratingOn:s.ratingText}>{x===0?"Any":x.toFixed(1)+"+"}</Text></Pressable>)}</View>
            <Text style={s.filterHint}>Distance: {radius} km</Text>
            <Pressable style={s.apply} onPress={()=>setFiltersOpen(false)}><Text style={s.applyText}>Apply Filters</Text></Pressable>
          </View>
        </View>
      </Modal>
      <AppBottomNav active="map"/>
  </SafeAreaView>;
}

function WebMap({userCoords,items}:{userCoords:Coords;items:Professional[]}) {
  return <View style={s.webMap}>
    <View style={s.mapRoadA}/><View style={s.mapRoadB}/><View style={s.mapRoadC}/>
    <View style={s.mapArea}><Text style={s.mapAreaText}>NEARBY AREA</Text></View>
    <View style={s.youMarker}><Text style={s.youMarkerText}>●</Text></View>
    {items.slice(0,8).map((worker,i)=>
      <Pressable key={worker.professional_id}
        onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:worker.professional_id}})}
        style={[s.webMarker,{left:`${15+(i*17)%72}%`,top:`${22+(i*29)%58}%`}]}>
        <Text style={s.webMarkerText}>{worker.display_name.slice(0,1).toUpperCase()}</Text>
      </Pressable>
    )}
    <View style={s.mapLegend}>
      <Text style={s.mapLegendTitle}>Nearby professionals</Text>
      <Text style={s.mapLegendText}>{items.length} verified professionals found</Text>
    </View>
  </View>;
}

function NativeMap({userCoords,items}:{userCoords:Coords;items:Professional[]}) {
  // react-native-maps is intentionally required only on native; importing it at module scope crashes Expo Web.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Maps=require("react-native-maps");
  const MapView=Maps.default||Maps;
  const Marker=Maps.Marker;
  const Callout=Maps.Callout;
  return <MapView style={s.map} initialRegion={{...userCoords,latitudeDelta:0.12,longitudeDelta:0.12}} showsUserLocation showsMyLocationButton>
    {items.map(worker=><Marker key={worker.professional_id} coordinate={{latitude:worker.latitude,longitude:worker.longitude}} title={worker.display_name} description={`${worker.headline||"Verified professional"} • ${worker.distance_km} km away`}>
      <View style={s.marker}><Text style={s.markerText}>{worker.display_name.slice(0,1).toUpperCase()}</Text></View>
      <Callout onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:worker.professional_id}})}>
        <View style={s.callout}><Text style={s.calloutName}>{worker.display_name}</Text><Text>{worker.headline||"Verified professional"}</Text><Text>{worker.distance_km} km • Trust {Math.round(worker.trust_score)}/100</Text><Text style={s.calloutLink}>View profile</Text></View>
      </Callout>
    </Marker>)}
  </MapView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff"}, container:{flex:1}, header:{paddingHorizontal:14,paddingTop:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},headerText:{flex:1},headerActions:{flexDirection:"row",alignItems:"center",gap:8},filterButton:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},filterButtonText:{fontSize:21,color:"#087D65"},
  title:{fontSize:22,fontWeight:"800"},subtitle:{marginTop:2,opacity:.6},refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},refreshText:{fontSize:24},
  skills:{paddingHorizontal:14,paddingVertical:10,gap:8},skill:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,backgroundColor:"#f3f5f5",alignItems:"center",minWidth:66},skillSelected:{backgroundColor:"#0b8f72"},skillText:{fontWeight:"700"},skillTextSelected:{color:"#fff"},
  radiusRow:{flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:16,paddingBottom:10},label:{fontWeight:"800",marginRight:3},radius:{paddingHorizontal:11,paddingVertical:6,borderRadius:14,backgroundColor:"#f3f5f5"},radiusSelected:{backgroundColor:"#d8f4eb"},radiusText:{fontSize:12},radiusTextSelected:{fontSize:12,fontWeight:"800"},
  mapWrap:{marginHorizontal:12,overflow:"hidden",backgroundColor:"#e8eeee",borderRadius:18,borderWidth:1,borderColor:"#dbe7e3"},map:{flex:1},webMap:{flex:1,backgroundColor:"#e9f3ef",position:"relative",overflow:"hidden"},webMapTitle:{fontSize:18,fontWeight:"900",color:"#13201c"},webMapText:{marginTop:5,color:"#66736e"},webMapWorker:{marginTop:12,backgroundColor:"#fff",borderRadius:12,padding:10,flexDirection:"row",alignItems:"center",gap:10},mapRoadA:{position:"absolute",width:"140%",height:24,backgroundColor:"#fff",top:"42%",left:"-20%",transform:[{rotate:"-8deg"}]},mapRoadB:{position:"absolute",width:"130%",height:18,backgroundColor:"#fff",top:"65%",left:"-15%",transform:[{rotate:"18deg"}]},mapRoadC:{position:"absolute",width:18,height:"120%",backgroundColor:"#fff",left:"54%",top:"-10%",transform:[{rotate:"22deg"}]},mapArea:{position:"absolute",left:"34%",top:"35%",padding:10,borderRadius:12,backgroundColor:"rgba(255,255,255,.75)"},mapAreaText:{fontSize:11,fontWeight:"900",color:"#66736e",letterSpacing:1},webMarker:{position:"absolute",width:38,height:38,borderRadius:19,backgroundColor:"#087D65",borderWidth:3,borderColor:"#fff",alignItems:"center",justifyContent:"center",elevation:5},webMarkerText:{color:"#fff",fontWeight:"900"},youMarker:{position:"absolute",left:"48%",top:"48%",width:18,height:18,borderRadius:9,backgroundColor:"#1976d2",borderWidth:4,borderColor:"#fff",alignItems:"center",justifyContent:"center"},youMarkerText:{color:"#1976d2",fontSize:8},mapLegend:{position:"absolute",left:12,bottom:12,backgroundColor:"#fff",borderRadius:14,padding:12,elevation:4},mapLegendTitle:{fontWeight:"900",color:"#13201c"},mapLegendText:{fontSize:11,color:"#66736e",marginTop:3},mapBadge:{position:"absolute",top:12,left:12,backgroundColor:"#fff",paddingHorizontal:11,paddingVertical:7,borderRadius:16,elevation:3},mapBadgeText:{fontWeight:"800"},
  marker:{width:42,height:42,borderRadius:21,borderWidth:3,borderColor:"#fff",backgroundColor:"#0b8f72",alignItems:"center",justifyContent:"center",elevation:4},markerText:{color:"#fff",fontWeight:"900",fontSize:15},
  callout:{width:190,padding:6},calloutName:{fontWeight:"800",fontSize:15},calloutLink:{fontWeight:"800",marginTop:5,color:"#087d65"},loadingOverlay:{position:"absolute",inset:0,backgroundColor:"rgba(255,255,255,.72)",alignItems:"center",justifyContent:"center"},loadingText:{marginTop:8,fontWeight:"700"},
  locationEmpty:{flex:1,alignItems:"center",justifyContent:"center",padding:30},locationTitle:{fontSize:18,fontWeight:"800",marginBottom:6},locationButton:{marginTop:14,backgroundColor:"#0b8f72",paddingHorizontal:18,paddingVertical:11,borderRadius:12},locationButtonText:{color:"#fff",fontWeight:"800"},
  modalBackdrop:{flex:1,backgroundColor:"rgba(19,32,28,.28)",justifyContent:"flex-end"},filterSheet:{backgroundColor:"#fff",borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:30},sheetHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},sheetTitle:{fontSize:21,fontWeight:"900",color:"#13201c"},close:{fontSize:28,color:"#13201c"},filterRow:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#eef2f0"},filterLabel:{fontSize:15,fontWeight:"800",color:"#13201c",marginTop:16},ratingRow:{flexDirection:"row",gap:8,marginTop:10},ratingChip:{borderWidth:1,borderColor:"#cfdad6",borderRadius:18,paddingHorizontal:14,paddingVertical:9},ratingChipOn:{backgroundColor:"#087D65",borderColor:"#087D65"},ratingText:{color:"#13201c",fontWeight:"700"},ratingOn:{color:"#fff",fontWeight:"800"},filterHint:{color:"#66736e",marginTop:15},apply:{height:50,borderRadius:12,backgroundColor:"#087D65",alignItems:"center",justifyContent:"center",marginTop:18},applyText:{color:"#fff",fontWeight:"900",fontSize:16},listHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:12},listTitle:{fontSize:17,fontWeight:"800"},listHint:{fontSize:12,opacity:.55},workerRow:{paddingHorizontal:12,paddingBottom:10,gap:10},card:{width:250,borderRadius:16,borderWidth:1,borderColor:"#e2e7e6",padding:12,marginTop:8,backgroundColor:"#fff",elevation:2},cardTop:{flexDirection:"row",alignItems:"center",gap:9},avatar:{width:42,height:42,borderRadius:21,backgroundColor:"#edf1f5",alignItems:"center",justifyContent:"center"},name:{fontSize:15,fontWeight:"800"},headline:{fontSize:12,opacity:.6,marginTop:2},verified:{color:"#0b8f72",fontSize:18},distance:{marginTop:10,fontSize:12,opacity:.65},rate:{marginTop:8,alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:"#e9f8f2"},rateText:{fontSize:12,fontWeight:"800",color:"#087d65"},view:{marginTop:9,fontWeight:"800",color:"#087d65"},empty:{padding:20,opacity:.6}
});