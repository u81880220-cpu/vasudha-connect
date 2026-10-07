import * as Location from "expo-location";
import React,{ useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Modal, Platform, Pressable, SafeAreaView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../src/lib/supabase";
import { VasudhaLogo } from "../src/components/VasudhaLogo";
import { AppBottomNav } from "../src/components/AppBottomNav";
import { ServicePicker, ServiceSelection } from "../src/components/ServicePicker";

type Professional={
  professional_id:string; display_name:string; headline:string|null; city:string|null; state:string|null;
  avatar_url:string|null; trust_score:number; verification_status:string; is_available:boolean;
  distance_km:number; latitude:number; longitude:number; profile_completion:number;
  skills:{id:string;name:string;category:string;primary:boolean}[]
};
type Coords={latitude:number;longitude:number};

const MAP_HEIGHT=Math.min(Math.max(Math.round(Dimensions.get("window").height*0.42),300),460);

export default function Marketplace(){ return <MarketplaceErrorBoundary><MarketplaceScreen/></MarketplaceErrorBoundary>; }

class MarketplaceErrorBoundary extends React.Component<any,{error:Error|null}>{
 state={error:null};
 static getDerivedStateFromError(error:Error){ return {error}; }
 render(){ if(this.state.error) return <SafeAreaView style={s.safe}><View style={s.errorBox}><Text style={s.errorTitle}>Find a Pro could not open</Text><Text style={s.errorText}>{this.state.error.message}</Text><Pressable style={s.locationButton} onPress={()=>this.setState({error:null})}><Text style={s.locationButtonText}>Try again</Text></Pressable></View><AppBottomNav active="map"/></SafeAreaView>; return this.props.children; }
}

function MarketplaceScreen(){
  const[marketplaceConfig,setMarketplaceConfig]=useState<any>(null);
  const[selection,setSelection]=useState<ServiceSelection>({categoryId:null,categoryName:null,serviceId:null,serviceName:null,subServiceId:null,subServiceName:null});
  const[query,setQuery]=useState("");
  const[selectedMapPro,setSelectedMapPro]=useState<Professional|null>(null);
  const[items,setItems]=useState<Professional[]>([]);
  const[loading,setLoading]=useState(true);
  const[searchError,setSearchError]=useState("");
  const[userCoords,setUserCoords]=useState<Coords|null>(null);
  const[radius,setRadius]=useState(25);
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[verifiedOnly,setVerifiedOnly]=useState(true);
  const[availableOnly,setAvailableOnly]=useState(true);
  const[minRating,setMinRating]=useState(0);
  const searchedItems=items.filter((item)=>{const q=query.trim().toLowerCase();if(!q)return true;return [item.display_name,item.headline,item.city,item.state,...(item.skills||[]).map((s:any)=>s.name)].filter(Boolean).some((v)=>String(v).toLowerCase().includes(q));});
  const visibleItems=[...searchedItems].filter(x=>(!verifiedOnly||x.verification_status==="verified")&&(!availableOnly||x.is_available)&&(Math.round(x.trust_score)/20)>=minRating).sort((a,b)=>{const tw=Number(marketplaceConfig?.trust_weight??0.5),dw=Number(marketplaceConfig?.distance_weight??0.3),aw=Number(marketplaceConfig?.availability_weight??0.2);const score=(x:any)=>tw*(Number(x.trust_score||0)/100)+dw*(1/(1+Number(x.distance_km||0)))+aw*(x.is_available?1:0);return score(b)-score(a)});

  useEffect(()=>{(async()=>{const{data}=await supabase.rpc("marketplace_configuration");const cfg=data||{};setMarketplaceConfig(cfg);setRadius(Math.min(Number(cfg.default_radius_km||25),Number(cfg.max_radius_km||50)));setVerifiedOnly(cfg.verified_only_default!==false);setAvailableOnly(cfg.available_only_default!==false);setMinRating(Number(cfg.min_rating||0));})();},[]);
  useEffect(()=>{requestLocation();},[]);
  useEffect(()=>{if(userCoords) searchProfessionals(userCoords);},[selection.serviceId,selection.subServiceId,radius]);

  async function requestLocation(){
    setLoading(true);
    // Browser QA uses the KAMPRO demo location (Varanasi) so laptop geolocation
    // permissions or inaccurate browser location never block marketplace testing.
    if(Platform.OS==="web"){
      const demoCoords={latitude:25.3176,longitude:82.9739};
      setUserCoords(demoCoords);
      await searchProfessionals(demoCoords);
      return;
    }
    const permission=await Location.requestForegroundPermissionsAsync();
    if(permission.status!=="granted"){
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
    setSearchError("");
    const{data,error}=await supabase.rpc("nearby_professionals_map",{
      p_latitude:coords.latitude,p_longitude:coords.longitude,p_radius_km:radius,p_skill_id:selection.legacySkillId||null,p_sub_service_id:selection.subServiceId||null
    });
    if(error){
      setItems([]);
      setSearchError("We couldn't load professionals right now. Please try again.");
    } else {
      setItems((data??[]) as Professional[]);
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

      <View style={s.searchBox}><Text style={s.searchIcon}>⌕</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search a Pro or skill" placeholderTextColor="#8B93A1" style={s.searchInput}/>{query?<Pressable onPress={()=>setQuery("")}><Text style={s.clear}>×</Text></Pressable>:null}</View>
      <View style={{paddingHorizontal:14,paddingTop:10}}>
        <ServicePicker value={selection} optionalSubService onChange={setSelection} title="Filter by service"/>
      </View>

      <View style={s.radiusRow}>
        <Text style={s.label}>Nearby</Text>
        {[5,10,25,50].filter(x=>x<=Number(marketplaceConfig?.max_radius_km||50)).map(x=><Pressable key={x} onPress={()=>setRadius(x)} style={[s.radius,radius===x&&s.radiusSelected]}>
          <Text style={radius===x?s.radiusTextSelected:s.radiusText}>{x} km</Text>
        </Pressable>)}
      </View>

      <View style={[s.mapWrap,{height:MAP_HEIGHT}]}>
        {userCoords && (Platform.OS==="web"
          ? <WebMap userCoords={userCoords} items={visibleItems} selection={selection} selectedMapPro={selectedMapPro} onSelect={setSelectedMapPro}/>
          : <NativeMap userCoords={userCoords} items={visibleItems} selection={selection}/>
        )}
        {!userCoords&&!loading&&<View style={s.locationEmpty}><Text style={s.locationTitle}>Location required</Text><Text>Allow location to see nearby professionals on the map.</Text><Pressable style={s.locationButton} onPress={requestLocation}><Text style={s.locationButtonText}>Enable location</Text></Pressable></View>}
        {loading&&<View style={s.loadingOverlay}><ActivityIndicator size="large"/><Text style={s.loadingText}>Finding nearby professionals…</Text></View>}
        <View style={s.mapBadge}><Text style={s.mapBadgeText}>{visibleItems.length} on map</Text></View>
      </View>

      <View style={s.listHeader}>
        <Text style={s.listTitle}>{query.trim()?`Results for "${query.trim()}"`:selection.serviceName||"All professionals"}</Text>
        <Text style={s.listHint}>Swipe to view list</Text>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={visibleItems}
        keyExtractor={x=>x.professional_id}
        contentContainerStyle={s.workerRow}
        ListEmptyComponent={!loading?(searchError?<View style={s.empty}><Text style={s.empty}>{searchError}</Text><Pressable style={s.locationButton} onPress={requestLocation}><Text style={s.locationButtonText}>Try again</Text></Pressable></View>:<Text style={s.empty}>No professionals found in this area.</Text>):null}
        renderItem={({item})=><Pressable style={s.card} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:item.professional_id,subServiceId:selection.subServiceId||"",serviceId:selection.serviceId||"",serviceName:selection.serviceName||"",subServiceName:selection.subServiceName||""}})}>
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
            <View style={s.filterRow}><Text style={s.filterLabel}>Verified only</Text><Switch value={verifiedOnly} onValueChange={setVerifiedOnly} trackColor={{false:"#CBD0D8",true:"#FF4B1F"}} /></View>
            <View style={s.filterRow}><Text style={s.filterLabel}>Available now</Text><Switch value={availableOnly} onValueChange={setAvailableOnly} trackColor={{false:"#CBD0D8",true:"#FF4B1F"}} /></View>
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

function WebMap({userCoords,items,selection,selectedMapPro,onSelect}:{userCoords:Coords;items:Professional[];selection:ServiceSelection;selectedMapPro:Professional|null;onSelect:(worker:Professional)=>void}) {
  return <View style={s.webMap}>
    <View style={s.mapRoadA}/><View style={s.mapRoadB}/><View style={s.mapRoadC}/>
    <View style={s.mapArea}><Text style={s.mapAreaText}>NEARBY AREA</Text></View>
    <View style={s.youMarker}><Text style={s.youMarkerText}>●</Text></View>
    {items.slice(0,8).map((worker,i)=>
      <Pressable key={worker.professional_id}
        onPress={()=>onSelect(worker)}
        style={[s.webMarker,{left:`${15+(i*17)%72}%`,top:`${22+(i*29)%58}%`}]}>
        <Text style={s.webMarkerText}>{worker.display_name.slice(0,1).toUpperCase()}</Text>
      </Pressable>
    )}
    {selectedMapPro?<View style={s.mapPreview}><View style={{flex:1}}><Text style={s.mapPreviewName}>{selectedMapPro.display_name}</Text><Text style={s.mapPreviewMeta}>{selectedMapPro.headline||"Verified professional"} • {selectedMapPro.distance_km} km</Text><Text style={s.mapPreviewTrust}>Trust {Math.round(selectedMapPro.trust_score)}/100</Text></View><View style={s.mapPreviewActions}><Pressable style={s.mapPreviewSecondary} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:selectedMapPro.professional_id,subServiceId:selection.subServiceId||"",serviceId:selection.serviceId||"",serviceName:selection.serviceName||"",subServiceName:selection.subServiceName||""}})}><Text style={s.mapPreviewSecondaryText}>View Profile</Text></Pressable><Pressable style={s.mapPreviewPrimary} onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:selectedMapPro.professional_id,subServiceId:selection.subServiceId||"",serviceId:selection.serviceId||"",serviceName:selection.serviceName||"",subServiceName:selection.subServiceName||""}})}><Text style={s.mapPreviewPrimaryText}>Connect</Text></Pressable></View></View>:null}
    <View style={s.mapLegend}>
      <Text style={s.mapLegendTitle}>Nearby professionals</Text>
      <Text style={s.mapLegendText}>{items.length} verified professionals found</Text>
    </View>
  </View>;
}

function NativeMap({userCoords,items,selection}:{userCoords:Coords;items:Professional[];selection:ServiceSelection}) {
  // react-native-maps is intentionally required only on native; importing it at module scope crashes Expo Web.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Maps=require("react-native-maps");
  const MapView=Maps.default||Maps;
  const Marker=Maps.Marker;
  const Callout=Maps.Callout;
  return <MapView style={s.map} initialRegion={{...userCoords,latitudeDelta:0.12,longitudeDelta:0.12}} showsUserLocation showsMyLocationButton>
    {items.map(worker=><Marker key={worker.professional_id} coordinate={{latitude:worker.latitude,longitude:worker.longitude}} title={worker.display_name} description={`${worker.headline||"Verified professional"} • ${worker.distance_km} km away`}>
      <View style={s.marker}><Text style={s.markerText}>{worker.display_name.slice(0,1).toUpperCase()}</Text></View>
      <Callout onPress={()=>router.push({pathname:"/professional-public",params:{professionalId:worker.professional_id,subServiceId:selection.subServiceId||"",serviceId:selection.serviceId||"",serviceName:selection.serviceName||"",subServiceName:selection.subServiceName||""}})}>
        <View style={s.callout}><Text style={s.calloutName}>{worker.display_name}</Text><Text>{worker.headline||"Verified professional"}</Text><Text>{worker.distance_km} km • Trust {Math.round(worker.trust_score)}/100</Text><Text style={s.calloutLink}>View profile</Text></View>
      </Callout>
    </Marker>)}
  </MapView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:"#fff"}, container:{flex:1}, header:{paddingHorizontal:14,paddingTop:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:10},headerText:{flex:1},headerActions:{flexDirection:"row",alignItems:"center",gap:8},filterButton:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},filterButtonText:{fontSize:21,color:"#FF4B1F"},
  title:{fontSize:22,fontWeight:"800"},subtitle:{marginTop:2,opacity:.6},refresh:{width:40,height:40,borderRadius:20,backgroundColor:"#f1f5f4",alignItems:"center",justifyContent:"center"},refreshText:{fontSize:24},
  skills:{paddingHorizontal:14,paddingVertical:10,gap:8},skill:{paddingHorizontal:12,paddingVertical:7,borderRadius:16,backgroundColor:"#f3f5f5",alignItems:"center",minWidth:66},skillSelected:{backgroundColor:"#FF4B1F"},skillText:{fontWeight:"700"},skillTextSelected:{color:"#fff"},
  searchBox:{marginHorizontal:14,marginTop:8,minHeight:52,borderWidth:1,borderColor:"#E7EAF0",borderRadius:16,backgroundColor:"#fff",flexDirection:"row",alignItems:"center",paddingHorizontal:14},searchIcon:{fontSize:22,color:"#FF4B1F"},searchInput:{flex:1,fontSize:15,color:"#172033",paddingHorizontal:9,paddingVertical:10},clear:{fontSize:24,color:"#6B7280",paddingHorizontal:4},radiusRow:{flexDirection:"row",alignItems:"center",gap:7,paddingHorizontal:16,paddingBottom:10},label:{fontWeight:"800",marginRight:3},radius:{paddingHorizontal:11,paddingVertical:6,borderRadius:14,backgroundColor:"#f3f5f5"},radiusSelected:{backgroundColor:"#d8f4eb"},radiusText:{fontSize:12},radiusTextSelected:{fontSize:12,fontWeight:"800"},
  mapWrap:{marginHorizontal:12,overflow:"hidden",backgroundColor:"#e8eeee",borderRadius:18,borderWidth:1,borderColor:"#dbe7e3"},map:{flex:1},webMap:{flex:1,backgroundColor:"#e9f3ef",position:"relative",overflow:"hidden"},webMapTitle:{fontSize:18,fontWeight:"900",color:"#10233F"},webMapText:{marginTop:5,color:"#6B7280"},webMapWorker:{marginTop:12,backgroundColor:"#fff",borderRadius:12,padding:10,flexDirection:"row",alignItems:"center",gap:10},mapRoadA:{position:"absolute",width:"140%",height:24,backgroundColor:"#fff",top:"42%",left:"-20%",transform:[{rotate:"-8deg"}]},mapRoadB:{position:"absolute",width:"130%",height:18,backgroundColor:"#fff",top:"65%",left:"-15%",transform:[{rotate:"18deg"}]},mapRoadC:{position:"absolute",width:18,height:"120%",backgroundColor:"#fff",left:"54%",top:"-10%",transform:[{rotate:"22deg"}]},mapArea:{position:"absolute",left:"34%",top:"35%",padding:10,borderRadius:12,backgroundColor:"rgba(255,255,255,.75)"},mapAreaText:{fontSize:11,fontWeight:"900",color:"#6B7280",letterSpacing:1},webMarker:{position:"absolute",width:38,height:38,borderRadius:19,backgroundColor:"#FF4B1F",borderWidth:3,borderColor:"#fff",alignItems:"center",justifyContent:"center",elevation:5},webMarkerText:{color:"#fff",fontWeight:"900"},youMarker:{position:"absolute",left:"48%",top:"48%",width:18,height:18,borderRadius:9,backgroundColor:"#1976d2",borderWidth:4,borderColor:"#fff",alignItems:"center",justifyContent:"center"},youMarkerText:{color:"#1976d2",fontSize:8},mapLegend:{position:"absolute",left:12,bottom:12,backgroundColor:"#fff",borderRadius:14,padding:12,elevation:4},mapLegendTitle:{fontWeight:"900",color:"#10233F"},mapLegendText:{fontSize:11,color:"#6B7280",marginTop:3},mapBadge:{position:"absolute",top:12,left:12,backgroundColor:"#fff",paddingHorizontal:11,paddingVertical:7,borderRadius:16,elevation:3},mapBadgeText:{fontWeight:"800"},
  marker:{width:42,height:42,borderRadius:21,borderWidth:3,borderColor:"#fff",backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",elevation:4},markerText:{color:"#fff",fontWeight:"900",fontSize:15},
  callout:{width:190,padding:6},calloutName:{fontWeight:"800",fontSize:15},calloutLink:{fontWeight:"800",marginTop:5,color:"#087d65"},loadingOverlay:{position:"absolute",inset:0,backgroundColor:"rgba(255,255,255,.72)",alignItems:"center",justifyContent:"center"},loadingText:{marginTop:8,fontWeight:"700"},
  locationEmpty:{flex:1,alignItems:"center",justifyContent:"center",padding:30},locationTitle:{fontSize:18,fontWeight:"800",marginBottom:6},locationButton:{marginTop:14,backgroundColor:"#FF4B1F",paddingHorizontal:18,paddingVertical:11,borderRadius:12},locationButtonText:{color:"#fff",fontWeight:"800"},
  modalBackdrop:{flex:1,backgroundColor:"rgba(19,32,28,.28)",justifyContent:"flex-end"},filterSheet:{backgroundColor:"#fff",borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:30},sheetHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},sheetTitle:{fontSize:21,fontWeight:"900",color:"#10233F"},close:{fontSize:28,color:"#10233F"},filterRow:{minHeight:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:"#eef2f0"},filterLabel:{fontSize:15,fontWeight:"800",color:"#10233F",marginTop:16},ratingRow:{flexDirection:"row",gap:8,marginTop:10},ratingChip:{borderWidth:1,borderColor:"#CBD0D8",borderRadius:18,paddingHorizontal:14,paddingVertical:9},ratingChipOn:{backgroundColor:"#FF4B1F",borderColor:"#FF4B1F"},ratingText:{color:"#10233F",fontWeight:"700"},ratingOn:{color:"#fff",fontWeight:"800"},filterHint:{color:"#6B7280",marginTop:15},apply:{height:50,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:18},applyText:{color:"#fff",fontWeight:"900",fontSize:16},listHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingHorizontal:16,paddingTop:12},listTitle:{fontSize:17,fontWeight:"800"},listHint:{fontSize:12,opacity:.55},workerRow:{paddingHorizontal:12,paddingBottom:10,gap:10},card:{width:250,borderRadius:16,borderWidth:1,borderColor:"#e2e7e6",padding:12,marginTop:8,backgroundColor:"#fff",elevation:2},cardTop:{flexDirection:"row",alignItems:"center",gap:9},avatar:{width:42,height:42,borderRadius:21,backgroundColor:"#edf1f5",alignItems:"center",justifyContent:"center"},name:{fontSize:15,fontWeight:"800"},headline:{fontSize:12,opacity:.6,marginTop:2},verified:{color:"#FF4B1F",fontSize:18},distance:{marginTop:10,fontSize:12,opacity:.65},rate:{marginTop:8,alignSelf:"flex-start",paddingHorizontal:9,paddingVertical:5,borderRadius:10,backgroundColor:"#e9f8f2"},rateText:{fontSize:12,fontWeight:"800",color:"#087d65"},view:{marginTop:9,fontWeight:"800",color:"#087d65"},empty:{padding:20,opacity:.6}
});