import { Alert } from "react-native";
import { CFPaymentGatewayService } from "react-native-cashfree-pg-sdk";
import { CFEnvironment, CFSession } from "cashfree-pg-api-contract";

export function startCashfreeCheckout(
  data: { payment_session_id: string; cashfree_order_id: string; environment?: string },
  _description: string,
  onSuccess: () => void,
  onFailure: (message: string) => void
) {
  try {
    CFPaymentGatewayService.setCallback({
      onVerify: (_orderId: string) => onSuccess(),
      onError: (error: any, _orderId: string) => onFailure(error?.getMessage?.() || error?.message || "Payment was not completed.")
    });
    const environment = data.environment === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
    const session = new CFSession(data.payment_session_id, data.cashfree_order_id, environment);
    CFPaymentGatewayService.doWebPayment(session);
  } catch (error: any) {
    onFailure(error?.message || "Unable to open Cashfree checkout.");
  }
}
