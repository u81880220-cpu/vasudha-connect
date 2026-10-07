# KAMPRO

**Find the right person around you**

KAMPRO is a single mobile marketplace app connecting customers with trusted professionals nearby.

## Product
- One app with Customer and Professional modes
- Nearby professional discovery
- Professional verification and profiles
- Direct connections, chat and hiring
- Job tracking
- Reviews and trust/reputation
- Separate Admin web dashboard

## Backend
Supabase project: `vasudha-connect`
Region: Mumbai (ap-south-1)

## Repository
This repository contains the KAMPRO mobile marketplace and its Admin dashboard.

## Apps
- `apps/mobile` — Expo/React Native mobile app
- `apps/admin` — Next.js admin dashboard

## Development principles
- TypeScript
- Supabase Auth + PostgreSQL + RLS
- Secure server-side privileged operations
- Role-based access
- Customer and Professional modes in one mobile app
- No quotation/bidding flow

## Release / QA baseline
- Production web deployment is verified on Vercel.
- Latest verified production deployment is built from the `main` branch.
- QA covers customer discovery, connection unlock, chat, direct job request, professional acceptance/tracking, customer completion, reviews, admin access controls, RLS guardrails and account isolation.
- Job-value quotation/bidding is intentionally disabled at the database boundary.
- Android release uses Expo/EAS configuration in `apps/mobile/eas.json`.
