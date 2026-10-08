import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { supabase } from "../lib/supabase";

type Props = { userId?: string; avatarUrl?: string | null; onUploaded?: (url: string) => void };

export function ProfilePhotoPicker({ userId, avatarUrl, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);

  async function pickPhoto() {
    if (!userId) return;
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const body = await fetch(asset.uri).then(r => r.arrayBuffer());
      const ext = (asset.name?.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/profile.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, body, {
        contentType: asset.mimeType || "image/jpeg", upsert: true, cacheControl: "3600"
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      const { error: profileError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (profileError) throw profileError;
      onUploaded?.(url);
      Alert.alert("Photo updated", "Profile photo changed successfully.");
    } catch (e: any) {
      Alert.alert("Photo upload failed", e?.message || "Please try again.");
    } finally { setUploading(false); }
  }

  return <View style={s.wrap}>
    {avatarUrl ? <Image source={{ uri: avatarUrl }} style={s.photo} /> :
      <View style={s.placeholder}><Text style={s.placeholderText}>Photo</Text></View>}
    <Pressable disabled={uploading} onPress={pickPhoto} style={s.button}>
      <Text style={s.buttonText}>{uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Add profile photo"}</Text>
    </Pressable>
    <Text style={s.hint}>Optional. Use a clear profile photo.</Text>
  </View>;
}
const s=StyleSheet.create({
 wrap:{alignItems:"center",paddingVertical:8},
 photo:{width:96,height:96,borderRadius:48,backgroundColor:"#F3F4F6"},
 placeholder:{width:96,height:96,borderRadius:48,backgroundColor:"#FFF0EA",alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:"#FFD2C6"},
 placeholderText:{color:"#FF4B1F",fontWeight:"900"},
 button:{marginTop:10,borderWidth:1,borderColor:"#FF4B1F",borderRadius:12,paddingHorizontal:16,paddingVertical:10},
 buttonText:{color:"#FF4B1F",fontWeight:"900"},
 hint:{fontSize:11,color:"#6B7280",marginTop:6}
});