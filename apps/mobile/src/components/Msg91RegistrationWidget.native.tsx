import { DefaultWidget } from "@msg91comm/sendotp-react-native";
import type { ReactNode } from "react";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCompletion: (result: unknown) => void;
  widgetId: string;
  tokenAuth: string;
};

export function Msg91RegistrationWidget(props: Props): ReactNode {
  return (
    <DefaultWidget
      visible={props.visible}
      onClose={props.onClose}
      onCompletion={props.onCompletion}
      widgetId={props.widgetId}
      tokenAuth={props.tokenAuth}
      theme="light"
      primaryColor="#FF4B1F"
      primaryButtonTextColor="#FFFFFF"
      defaultVerificationType="mobile"
      autoFocus
    />
  );
}
