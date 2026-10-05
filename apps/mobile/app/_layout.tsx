import { Stack } from "expo-router";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { AuthProvider } from "../src/auth/AuthProvider";

export const unstable_settings = { anchor: "index" };

export default function RootLayout(){
  return (
    <AuthProvider>
      <KeyboardAvoidingView
        style={{flex:1}}
        behavior={Platform.OS==="ios"?"padding":"height"}
        keyboardVerticalOffset={Platform.OS==="ios"?0:0}
      >
        <View style={{flex:1,backgroundColor:"#fff"}}>
          <Stack screenOptions={{headerShown:false,animation:"slide_from_right"}} />
        </View>
      </KeyboardAvoidingView>
    </AuthProvider>
  );
}