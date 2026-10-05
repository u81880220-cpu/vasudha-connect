import { Stack } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { AuthProvider } from "../src/auth/AuthProvider";

export const unstable_settings = { anchor: "index" };

export default function RootLayout(){
  const web=Platform.OS==="web";
  return (
    <AuthProvider>
      <View style={web?s.webViewport:s.nativeViewport}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS==="ios"?"padding":"height"}
          keyboardVerticalOffset={0}
        >
          <View style={web?s.webPhone:s.nativeApp}>
            <Stack screenOptions={{headerShown:false,animation:"slide_from_right"}} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </AuthProvider>
  );
}

const s=StyleSheet.create({
 flex:{flex:1},
 nativeViewport:{flex:1,backgroundColor:"#fff"},
 nativeApp:{flex:1,backgroundColor:"#fff"},
 webViewport:{
   flex:1,
   minHeight:"100vh",
   backgroundColor:"#f4f0f7",
   alignItems:"center",
   justifyContent:"flex-start",
   paddingVertical:24,
 },
 webPhone:{
   width:"100%",
   maxWidth:393,
   minHeight:852,
   flex:1,
   backgroundColor:"#fff",
   overflow:"hidden",
   borderRadius:4,
   shadowColor:"#13201c",
   shadowOpacity:0.12,
   shadowRadius:18,
   shadowOffset:{width:0,height:6},
   elevation:6,
 },
});
