# App Store & Play Store listing checklist

## Privacy

- **Camera** — expense receipts and social media attachments
- **Photo library** — attach images to expenses/posts
- **Face ID / biometrics** — optional app unlock
- **Push notifications** — operational alerts (invoices, tasks, etc.)
- **No advertising tracking** — do not set `NSUserTrackingUsageDescription` unless you add ATT later

Privacy Policy URL (set in both stores): `https://hirdanmarketing.com/privacy` (update if different)

## App Store Connect

- Name: **Hirdan Agency**
- Subtitle: Agency workspace on the go
- Category: Business
- Age rating: 4+
- Review notes: Staff demo account credentials; settings live on web dashboard at app.hirdanmarketing.com
- Screenshots: iPhone 6.7", iPhone 6.1", iPad 13" — Home, Clients, Money, Social, More

## Google Play

- Title: Hirdan Agency
- Short description: Run your agency from your phone — clients, invoices, social, and more.
- Full description: Staff app for Hirdan Marketing agency system. Manage clients, invoices, expenses (camera receipts), social publishing, email, calendar, team, and file transfers. Agency settings remain on the web dashboard.
- Content rating: Everyone
- Data safety: collect email for account; tokens stored in device secure storage; push tokens for notifications

## Build / submit

1. Set real `extra.eas.projectId` after `eas init`
2. Fill `eas.json` submit block
3. `eas build --profile production --platform all`
4. `eas submit --profile production --platform ios|android`

## Review credentials

Provide a non-production staff user with READ access to clients/invoices for App Review.
