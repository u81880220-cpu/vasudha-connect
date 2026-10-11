# MSG91 OTP integration — KAMPRO

Work branch: `feature/msg91-widget-integration`

## Current step
The official package `@msg91comm/sendotp-react-native` has been added to `apps/mobile/package.json`. This is a native React Native module; use an Expo development/EAS build rather than Expo Go for device testing.

## Client configuration
Configure these as Expo public environment variables for the mobile build:
- `EXPO_PUBLIC_MSG91_WIDGET_ID`: Widget ID from the MSG91 widget dashboard.
- `EXPO_PUBLIC_MSG91_TOKEN_AUTH`: the widget-specific token selected/generated in MSG91's OTP Widget integration settings.

The widget token is not the account Auth Key. Never put `MSG91_AUTH_KEY`, Supabase service-role keys, or any server secret in an `EXPO_PUBLIC_*` variable or mobile app.

## Server verification
The mobile SDK's successful completion returns an access token. Send that token to the Supabase Edge Function `verify-msg91-otp`, which validates it with MSG91 using the server-only `MSG91_AUTH_KEY`. Do not treat the client callback alone as proof of verification.

## Important remaining work
- Implement the widget UI in `apps/mobile/app/auth.tsx` for mobile signup and PIN recovery only.
- Preserve phone + PIN login and email auth.
- Complete a secure backend flow to bind verified phone identity to the right Supabase account and create/update credentials. A verified MSG91 token alone does not establish a Supabase Auth session.
- Test on an Android development build, including failed OTP, resend, duplicate registration, recovery for unknown numbers, and session creation.
- Review package compatibility and native build output before producing a release APK/AAB.

## MSG91 widget settings
- Mobile Integration: enabled
- CAPTCHA: disable for mobile if required by the selected SDK/widget configuration
- Country restriction: India
- Keep SMS as primary channel; avoid changing other settings until device testing.
