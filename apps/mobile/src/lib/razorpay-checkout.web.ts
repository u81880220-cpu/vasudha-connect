export async function startRazorpayCheckout(options: any): Promise<any> {
  await new Promise<void>((resolve, reject) => {
    const w = window as any;
    if (w.Razorpay) return resolve();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded."));
    document.head.appendChild(script);
  });
  return await new Promise((resolve, reject) => {
    const Razorpay = (window as any).Razorpay;
    const checkout = new Razorpay({ ...options, handler: (response: any) => resolve(response), modal: { ondismiss: () => reject(new Error("Payment was cancelled.")) } });
    checkout.on("payment.failed", (response: any) => reject(new Error(response?.error?.description || "Payment failed.")));
    checkout.open();
  });
}
