# KAMPRO Maestro Tests

This workspace contains KAMPRO Android UI automation flows.

## Security

Test credentials are NOT stored in this repository.

Provide these values through Maestro/GitHub Actions environment variables:

- CUSTOMER_EMAIL
- CUSTOMER_PASSWORD
- PROFESSIONAL_EMAIL
- PROFESSIONAL_PASSWORD

The flows use the accessibility labels added to the KAMPRO login fields:

- KAMPRO email address
- KAMPRO password

## Planned test coverage

### Smoke
1. Customer login → Customer Home
2. Professional login → Professional Home

### Navigation
3. Customer Home → Find a Pro
4. Professional Home basic landing verification

### Next regression flows

After the first APK passes smoke testing, expand coverage to:

- Customer Find a Pro → professional profile
- Customer connection → My Chats
- Customer chat → message → Request Job
- Customer job request → professional acceptance
- Professional job lifecycle
- Customer tracking
- Customer confirmation
- Customer review
- Notifications
- Profile
- Subscription screen
- Terms / Privacy

Run only smoke tests with the smoke tag when needed.
