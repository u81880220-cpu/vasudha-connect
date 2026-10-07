# KAMPRO UI/UX Design Handoff

## Product
**KAMPRO** — "Kam hai? Pro bulaiye."

This document is the visual source-of-truth brief for the KAMPRO UI redesign.

## Non-negotiable rule
This redesign changes **presentation only**.

Do NOT change:
- Supabase schema, queries, RPCs, RLS or backend logic
- Authentication or authorization
- Customer/professional/admin roles
- Existing routes
- Connection/unlock rules
- Chat behavior
- Request/accept workflow
- Job state machine
- Review logic
- Existing business model

Do NOT add:
- work requests
- 
- Maintenance plans
- Stay & Earn
- Property health/inspection
- Job payment/commission flows

## Core user journey
Find → Connect → Chat/Call → Request Work → Accept → Navigate → Work → Complete → Review

## Frozen primary navigation
The existing KAMPRO primary navigation is **exactly four options** and must not be redesigned into a different information architecture.

### Customer / Professional primary navigation
1. **Home** — `/home`
2. **Find a Pro / Marketplace** — `/marketplace`
3. **Chat** — `/connections`
4. **Profile** — `/profile`

Chat/Connections is intentionally one of the four primary navigation destinations. **Do not create a separate Jobs tab or replace Chat/Connections with Jobs.** Jobs remain accessible through the existing screens and workflow.

Desktop and mobile may present these four destinations differently (for example, bottom navigation on mobile and header/sidebar navigation on desktop), but the information architecture and routes remain unchanged.

## Design direction
Create a consistent, professional Indian service marketplace experience for desktop and mobile.

### Brand
- Name: KAMPRO
- Tagline: Kam hai? Pro bulaiye.
- Primary: #FF4B1F
- Primary dark: #D93812
- Accent: #FFB11B
- Navy: #10233F
- Ink: #172033
- Muted: #6B7280
- Background: #F7F8FA
- Surface: #FFFFFF
- Border: #E7EAF0
- Success: #18A66A
- Warning: #F59E0B
- Danger: #E53935
- Info: #2563EB

### Shape
- Small radius: 8px
- Medium radius: 12px
- Large radius: 18px
- Extra large radius: 24px
- Use generous, consistent spacing.
- Cards should feel clean and trustworthy rather than overly decorative.

## Screens to design
1. Authentication
2. Onboarding
3. Mode selection
4. Home
5. Marketplace / Find a Pro
6. Professional public profile
7. Chat
8. Service request
9. Jobs
10. Job details
11. Job tracking
12. Customer dashboard
13. Professional dashboard
14. Customer profile
15. Professional profile
16. Notifications
17. Review
18. Professional verification
19. Professional subscription
20. Connection packages
21. Earnings
22. Complaints
23. Admin console
24. Terms
25. Privacy
26. Delete account

## Responsive requirement
Every design should have:
- Desktop layout
- Mobile layout
- Clear touch targets
- Consistent header/navigation
- Consistent cards, buttons, forms and status indicators
- The same four primary navigation destinations

## Implementation rule
Stitch designs are references for the existing React/Expo implementation. The production application remains the GitHub codebase. Implement the visual system without replacing working business logic.

## QA gate
After implementation:
1. GitHub build must pass.
2. Automated web QA must pass.
3. Vercel production deployment.
4. Live web QA.
5. Android build and emulator QA.
6. Final release.

## Definition of done
The KAMPRO interface must look like one coherent product across all screens, rather than individual pages receiving isolated color changes.


## KAMPRO final UI/UX freeze — 2026-10-07

### Primary navigation
Home | Find a Pro | Chat | Profile. Jobs are not a primary navigation item.

### Find a Pro
The screen must have a Pro/skill search above the live map. Search results must drive both the map markers and the professional list. Map markers are tappable and open a professional preview with View Profile and Connect. The complete professional list remains below the map.

### Frozen product journey
Find → Connect → Chat / Call → Request Work → Professional Accepts → Navigate → Work → Complete → Review.

### Presentation-only rule
Stitch is the visual blueprint. GitHub implementation must preserve existing Supabase, authentication, RLS, routes, roles, APIs/RPCs, connection/unlock logic, chat logic, request/accept flow, job states and reviews. Do not add quotes, bidding, booking, payment/commission flows, maintenance plans, Stay & Earn, property health/inspection, insurance or invented guarantees/fees.
