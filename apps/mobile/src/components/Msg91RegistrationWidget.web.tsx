import { Text, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompletion: (result: unknown) => void;
  widgetId: string;
  tokenAuth: string;
};

export function Msg91RegistrationWidget(props: Props) {
  if (!props.visible) return null;
  return (
    <View style={{ padding: 16, backgroundColor: "#FFF7F2", borderRadius: 12 }}>
      <Text style={{ color: "#10233F", fontWeight: "700" }}>
        Mobile OTP registration is available in the KAMPRO Android app. You can still sign in on the web with your existing account.
      </Text>
      <Text onPress={props.onClose} style={{ color: "#C43D1A", marginTop: 12, fontWeight: "700" }}>
        Close
      </Text>
    </View>
  );
}
