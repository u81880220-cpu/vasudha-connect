# VASUDHA CONNECT

**Find Skills Around You**

VASUDHA CONNECT is a single mobile marketplace app connecting customers with trusted professionals nearby.

## Product
- One app with Customer and Professional modes
- Nearby skill discovery
- Professional verification and profiles
- Connection packages
- Direct connections, chat and hiring (no quotation/bidding flow)
- Job tracking
- Reviews and VASUDHA Trust
- Professional subscriptions
- Separate Admin web dashboard

## Backend
Supabase project: `vasudha-connect`
Region: Mumbai (ap-south-1)

## Repository
This repository is the fresh VASUDHA CONNECT codebase. VASUDHA CARE is intentionally excluded and will be developed separately later.

## Planned apps
- `apps/mobile` — Expo/React Native mobile app
- `apps/admin` — Next.js admin dashboard

## Development principles
- TypeScript
- Supabase Auth + PostgreSQL + RLS
- Secure server-side privileged operations
- Role-based access
- Customer and Professional modes in one mobile app

## Deployment
- Vercel production deployment trigger verified for the main branch.

## Current QA baseline
- Production web deployment is verified on Vercel.
- Real-user Playwright QA covers customer discovery, connection unlock, chat, direct job request, professional acceptance/tracking, customer completion, reviews, admin access controls, RLS guardrails and account isolation.
- Job-value quotation/bidding is intentionally disabled at the database boundary.
