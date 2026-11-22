import React,{useEffect,useRef,useState} from "react";
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {getCurrentKamproLocation,searchKamproLocations,setKamproLocation,type KamproLocation,type LocationSuggestion} from "../lib/kamproLocation";

type Props={visible:boolean;onClose:()=>void;onSelect:(location:KamproLocation)=>void|Promise<void>;title?:string};

export function KamproLocationPicker({visible,onClose,onSelect,title="Change location"}:Props){
 const[query,setQuery]=useState("");const[rows,setRows]=useState<LocationSuggestion[]>([]);const[selected,setSelected]=useState<LocationSuggestion|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState("");const[searching,setSearching]=useState(false);const requestRef=useRef(0);
 useEffect(()=>{if(!visible){requestRef.current++;return;}setQuery("");setRows([]);setSelected(null);setError("");setBusy(false);setSearching(false);},[visible]);
 useEffect(()=>{const value=query.trim();const request=++requestRef.current;if(value.length<2){setRows([]);setSearching(false);return;}if(selected&&selected.label===value)return;const timer=setTimeout(async()=>{setSearching(true);try{const results=await searchKamproLocations(value);if(request===requestRef.current){setRows(results);setSearching(false);}}catch{if(request===requestRef.current){setRows([]);setSearching(false);}}},300);return()=>clearTimeout(timer);},[query,selected]);
 async function choose(location:KamproLocation){if(busy)return;setBusy(true);setError("");try{await setKamproLocation(location);await onSelect(location);onClose();}catch(e:any){setError(e?.message||"Could not save this location. Please try again.");}finally{setBusy(false);}}
 async function useGps(){if(busy)return;setBusy(true);setError("");try{const point=await getCurrentKamproLocation();await setKamproLocation({...point,manual:false});await onSelect({...point,manual:false});onClose();}catch(e:any){setError(e?.message||"Could not detect GPS location. Search manually.");}finally{setBusy(false);}}
 return <Modal visible={visible} transparent animationType="none" hardwareAccelerated statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
  <View style={styles.backdrop}><View style={styles.sheet}>
   <View style={styles.header}><Text style={styles.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close location picker" hitSlop={12} onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
   <Text style={styles.hint}>Choose where you need the service. Professionals nearby will be shown.</Text>
   <Pressable style={styles.gps} disabled={busy} onPress={useGps}>{busy?<ActivityIndicator color="#10233F"/>:<Text style={styles.gpsText}>⌖  Use current GPS location</Text>}</Pressable>
   <TextInput value={query} onChangeText={value=>{setQuery(value);setSelected(null);setError("");}} placeholder="Search city, locality or area" placeholderTextColor="#8B93A1" style={styles.input} returnKeyType="search" autoCorrect={false} autoCapitalize="words" blurOnSubmit={false} onSubmitEditing={()=>setError(rows.length?"Please select an address suggestion.":"Wait for matching suggestions or try a nearby locality.")}/>
   <ScrollView style={styles.results} contentContainerStyle={styles.resultsContent} keyboardShouldPersistTaps="always" keyboardDismissMode="none" nestedScrollEnabled={false}>
    {searching?<Text style={styles.status}>Searching locations…</Text>:null}
    {!searching&&query.trim().length>=2&&rows.length===0?<Text style={styles.status}>No matching locations yet. Try adding your city or district.</Text>:null}
    {rows.map((place,index)=><Pressable key={place.latitude+":"+place.longitude+":"+index} style={[styles.result,selected?.latitude===place.latitude&&selected?.longitude===place.longitude&&styles.resultSelected]} onPress={()=>{setSelected(place);setQuery(place.label);setError("");}}><Text style={styles.resultTitle}>{place.label}</Text><Text style={styles.resultDetail} numberOfLines={2}>{place.detail}</Text></Pressable>)}
   </ScrollView>
   {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
   <Pressable style={[styles.apply,(!selected||busy)&&styles.applyDisabled]} disabled={!selected||busy} onPress={()=>void choose(selected!)}><Text style={styles.applyText}>{busy?"Please wait…":"Use selected location"}</Text></Pressable>
  </View></View>
 </Modal>;
}
const styles=StyleSheet.create({
 backdrop:{flex:1,backgroundColor:"rgba(16,35,63,.38)",justifyContent:"flex-end"},
 sheet:{backgroundColor:"#fff",borderTopLeftRadius:24,borderTopRightRadius:24,paddingHorizontal:20,paddingTop:18,paddingBottom:16,maxHeight:"88%",flexShrink:1},
 header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:20,fontWeight:"900",color:"#10233F"},close:{fontSize:28,color:"#10233F",paddingHorizontal:4},
 hint:{fontSize:13,color:"#667085",marginTop:6,lineHeight:19},gps:{height:48,borderRadius:12,backgroundColor:"#F4F8FE",borderWidth:1,borderColor:"#DCE8F7",alignItems:"center",justifyContent:"center",marginTop:14},gpsText:{fontWeight:"800",color:"#10233F"},
 input:{height:50,borderWidth:1,borderColor:"#E7EAF0",borderRadius:12,paddingHorizontal:14,fontSize:15,color:"#172033",marginTop:12},results:{flexGrow:0,flexShrink:1,maxHeight:230,marginTop:8},resultsContent:{paddingBottom:2},status:{padding:12,color:"#667085",fontSize:13},
 result:{paddingHorizontal:12,paddingVertical:11,borderBottomWidth:1,borderBottomColor:"#EEF2F6",borderRadius:8},resultSelected:{backgroundColor:"#F0F8F5"},resultTitle:{fontSize:14,fontWeight:"800",color:"#10233F"},resultDetail:{fontSize:12,color:"#475467",marginTop:3},
 error:{marginTop:8,color:"#B42318",fontSize:12,fontWeight:"700"},apply:{height:50,borderRadius:12,backgroundColor:"#FF4B1F",alignItems:"center",justifyContent:"center",marginTop:14},applyDisabled:{opacity:.45},applyText:{color:"#fff",fontWeight:"900",fontSize:15}
});
