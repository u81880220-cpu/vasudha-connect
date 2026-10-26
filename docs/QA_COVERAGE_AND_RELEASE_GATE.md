# KAMPRO QA coverage and release gate

## Automated web smoke coverage

The GitHub Actions workflow `.github/workflows/web-qa.yml` runs Playwright against the production web URL. It currently checks:

- HTTP response status and non-empty app rendering for the major Expo Router screens.
- Uncaught browser JavaScript exceptions on each route.
- Customer-home horizontal overflow at a 360px viewport.
- Route reachability at a mobile-sized viewport.
- HTML and test-result artifacts for diagnosis.

## Important limitations

These are route/render smoke tests, not full end-to-end certification. Screens that require a signed-in user may show an authentication redirect or a sign-in view. The smoke suite does not prove that a user can successfully authenticate or perform protected actions.

## Full user-journey tests still required

Run in a dedicated test environment with disposable test accounts and test data:

1. Customer: register/sign in, choose a service, find professionals, view a profile, submit a service request.
2. Professional: sign in, complete onboarding, receive a request, accept/reject, update job state.
3. Customer job lifecycle: view request, cancel while allowed, track active job, mark complete, review.
4. Location: grant/deny GPS, fallback to manually selected area, distance ordering, routing/ETA.
5. Packages and billing: list enabled connection packages, unlock access, verify server-side authorization; use payment sandbox only.
6. Professional subscription: subscription state, expiry, renewal/failure behavior; use payment sandbox only.
7. Admin: service catalogue, package management, offers, identity review, and role-based authorization.
8. Security: customer A cannot read/update customer B's private records; professional cannot use admin operations; unauthenticated requests are rejected.
9. Resilience: offline/network failure, empty results, duplicate taps, loading states, and retry behavior.

## Release gate

Do not mark KAMPRO fully tested based only on the route smoke workflow. Before production release, record the test account role (never the password), environment, expected result, actual result, and evidence for each user journey. Do not use real payment credentials or real identity documents in QA.
