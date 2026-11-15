import RazorpayCheckout from "react-native-razorpay";

export async function startRazorpayCheckout(options: any): Promise<any> {
  return await RazorpayCheckout.open(options);
}
