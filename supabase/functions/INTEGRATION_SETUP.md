# KAMPRO provider setup (sandbox first)

## Supabase Edge Function secrets
Configure these in Supabase Edge Function Secrets; never put server secrets in the app or Git:
- `CASHFREE_APP_ID`: Cashfree sandbox App ID first.
- `CASHFREE_SECRET_KEY`: matching Cashfree sandbox secret.
- `CASHFREE_ENV=sandbox` until sandbox order creation and verified webhook settlement are tested.
- `CASHFREE_API_VERSION=2025-01-01`
- `CASHFREE_RETURN_URL`: HTTPS URL in the app/web deployment that can verify payment status with the backend.
- `GOOGLE_MAPS_API_KEY`: server-side key restricted to Routes API for the Google Routes Edge Function.

Enable Google Maps Platform billing and Routes API. For native map tiles, create a separate Android-restricted Maps SDK for Android key and inject it at native build time. Do not reuse the server Routes key in the client.

## Cashfree webhook
Configure the Cashfree payment webhook to the deployed `payment-webhook` function. It must validate Cashfree's `x-webhook-signature` against `x-webhook-timestamp + raw request body` using HMAC-SHA256 and the Cashfree secret before marking any order paid. The webhook implementation must handle successful payments idempotently, finalize both connection-package and professional-subscription orders, and credit the connection wallet only after successful verification. Do not rely on the browser redirect to mark a payment paid.

## Safety and rollout
1. Keep `EXPO_PUBLIC_PAYMENT_PROVIDER=test` for screen QA; this deliberately avoids charging real money.
2. Use Cashfree sandbox and test cards/UPI first. Do not switch to production until the webhook and database settlement tests pass.
3. Deploy the Cashfree order functions and Google Routes function only after setting their server secrets.
4. Android native checkout requires the Cashfree-supported native SDK or a verified secure redirect flow; the web checkout SDK alone is not a native integration.
