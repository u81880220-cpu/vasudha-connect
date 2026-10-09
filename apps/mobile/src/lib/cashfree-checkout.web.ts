export async function startCashfreeCheckout(
  data: { payment_session_id: string; environment?: string },
  _description: string,
  onSuccess: () => void,
  onFailure: (message: string) => void
) {
  try {
    const w = window as any;
    if (!w.Cashfree) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Cashfree checkout could not be loaded."));
        document.head.appendChild(script);
      });
    }
    const cashfree = (window as any).Cashfree({ mode: data.environment === "production" ? "production" : "sandbox" });
    await cashfree.checkout({ paymentSessionId: data.payment_session_id, redirectTarget: "_self" });
    onSuccess();
  } catch (error: any) {
    onFailure(error?.message || "Unable to open Cashfree checkout.");
  }
}
