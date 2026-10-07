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
- Quotes
- Bidding
- Maintenance plans
- Stay & Earn
- Property health/inspection
- Job payment/commission flows

## Core user journey
Find → Connect → Chat/Call → Request Work → Accept → Navigate → Work → Complete → Review

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
7. Connections
8. Chat
9. Service request
10. Jobs
11. Job details
12. Job tracking
13. Customer dashboard
14. Professional dashboard
15. Customer profile
16. Professional profile
17. Notifications
18. Review
19. Professional verification
20. Professional subscription
21. Connection packages
22. Earnings
23. Complaints
24. Admin console
25. Terms
26. Privacy
27. Delete account

## Responsive requirement
Every design should have:
- Desktop layout
- Mobile layout
- Clear touch targets
- Consistent header/navigation
- Consistent cards, buttons, forms and status indicators

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
