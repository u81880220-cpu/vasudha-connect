import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth/AuthProvider";
export default function Index(){const{session,loading}=useAuth();if(loading)return <View style={{flex:1,alignItems:"center",justifyContent:"center"}}><ActivityIndicator size="large"/></View>;return <Redirect href={session?"/home":"/auth"}/>;}