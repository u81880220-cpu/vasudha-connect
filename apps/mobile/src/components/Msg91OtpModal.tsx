import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { DefaultWidget } from "@msg91comm/sendotp-react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onVerified: (accessToken: string, identifier: string) => void;
};

/**
 * MSG91 OTP widget wrapper. The callback is not trusted until the access token
 * is checked by the server-side msg91-register function.
 */
export function Msg91OtpModal({ visible, onClose, onVerified }: Props) {
  const [checking, setChecking] = useState(false);
  const widgetId = process.env.EXPO_PUBLIC_MSG91_WIDGET_ID ?? "";
  const tokenAuth = process.env.EXPO_PUBLIC_MSG91_TOKEN_AUTH ?? "";
  const missingConfig = !widgetId || !tokenAuth;

  useEffect(() => {
    if (visible && missingConfig) {
      Alert.alert("OTP setup incomplete", "Configure EXPO_PUBLIC_MSG91_WIDGET_ID and EXPO_PUBLIC_MSG91_TOKEN_AUTH in the mobile build environment before testing.");
    }
  }, [visible, missingConfig]);

  async function handleCompletion(result: {
    success: boolean;
    identifier?: string;
    message?: string;
  }) {
    if (!result.success || !result.message) {
      Alert.alert("OTP verification failed", result.message || "Please try again.");
      onClose();
      return;
    }

    setChecking(true);
    try {
      // The access token is sent to the server together with the intended
      // account details. The server verifies it with MSG91 before creating
      // any Supabase account.
      onVerified(result.message, result.identifier ?? "");
    } finally {
      setChecking(false);
      onClose();
    }
  }

  if (missingConfig) {
    return visible ? <View><Text>OTP setup incomplete. Configure the MSG91 widget ID and widget token in the mobile build environment.</Text></View> : null;
  }

  return (
    <View>
      {checking ? <Text>Securing OTP verification…</Text> : null}
      <DefaultWidget
        visible={visible}
        onClose={onClose}
        onCompletion={handleCompletion}
        widgetId={widgetId}
        tokenAuth={tokenAuth}
        theme="light"
        primaryColor="#FF4B1F"
        primaryButtonTextColor="#FFFFFF"
      />
    </View>
  );
}
