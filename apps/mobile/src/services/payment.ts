import { supabase } from "../lib/supabase";

export type PaymentProvider="test"|"razorpay";
export type ConnectionPaymentResult={orderId:string;provider:PaymentProvider;status:"paid"|"pending"};

export async function createConnectionPayment(packageCode:string,provider:PaymentProvider):Promise<ConnectionPaymentResult>{
  const{data,error}=await supabase.rpc("create_connection_payment_order",{p_package:packageCode});
  if(error)throw error;
  if(!data?.id)throw new Error("Payment order was not created");
  if(provider==="test"){
    const{data:paid,error:paymentError}=await supabase.rpc("finalize_test_connection_payment",{p_order_id:data.id});
    if(paymentError)throw paymentError;
    return {orderId:data.id,provider:"test",status:paid?.status==="paid"?"paid":"pending"};
  }
  return {orderId:data.id,provider:"razorpay",status:"pending"};
}
