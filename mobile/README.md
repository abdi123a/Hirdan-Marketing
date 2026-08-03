# Hirdan Agency Mobile

Native iOS / Android staff app (Expo SDK 57) for the Hirdan agency system.

## Configuration

The only required env var:

```bash
EXPO_PUBLIC_API_URL=https://api.hirdanmarketing.com/api
```

Optional:

```bash
EXPO_PUBLIC_DASHBOARD_URL=https://app.hirdanmarketing.com
```

Copy `.env.example` to `.env` (already set for production API).

## Develop

```bash
cd mobile
npm install
npm start
```

## EAS builds (TestFlight / Play internal)

```bash
npm install -g eas-cli
eas login
eas build:configure   # link projectId in app.json extra.eas.projectId
eas build --profile preview --platform ios
eas build --profile preview --platform android
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

Update `eas.json` submit credentials (`appleId`, `ascAppId`, `appleTeamId`, Google service account) before production submit.

## Architecture

- Talks to the existing Express API with `Authorization: Bearer` + `X-Client-Platform: mobile`
- Refresh tokens returned in JSON for mobile (cookie still used by web)
- Settings / users / plugins remain on the web dashboard
- Shared permissions/types live in `../shared`

## Store listing notes

See [STORE_LISTING.md](./STORE_LISTING.md).
