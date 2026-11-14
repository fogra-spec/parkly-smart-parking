# Mobile architecture audit

Starting branch: feature/mobile-app. Website baseline: 0d09da98957d0a27eb4c71f44dbb5a1d5a5f4b65. Initial working tree clean.

| Existing asset | Finding | Mobile decision |
|---|---|---|
| Next.js/Vinext website | Functional app at repository root; React DOM UI, Worker runtime and D1 database | Preserve paths, package/lockfile, UI and API behavior. Add mobile/ with isolated dependencies. Exclude it from website TypeScript scanning. |
| lib/demo.ts | Six fictional lots; five approved; coordinates, owners, prices and allocated capacity | Import original fixture directly; no copied dataset. |
| lib/finance.ts | Pure bookingPrice function also used by server; whole-hour policy checked in API | Import price calculation directly; enforce same 1–24h, whole-hour, 90-day rules in mobile domain. |
| db/schema.ts | Drizzle SQLite users/lots/bookings/sessions/favorites | Mobile DTOs preserve names, identifiers and status semantics; do not bundle database/Cloudflare code on a phone. |
| GET/POST /api/demo | Existing shared driver login, booking, history, cancel/profile/favorite operations | Optional localhost/LAN adapter uses these routes unchanged. No hosted address is configured or called. |
| /api/availability | Counts overlapping confirmed bookings | Local API adapter reuses it; mock service uses matching conservative overlap semantics. |
| Authentication | Open demo role chooser, HTTP-only session, no password signup/token flow | Default local mock identities. No password is requested or stored. API mode supports only existing shared driver account; mock signup remains explicitly local. |
| Map | Browser OSM tile renderer | Native react-native-maps; labeled schematic fallback on preview/offline/configuration issues. No invented keys or location permission requests. |
| Branding | White/soft neutrals, charcoal, muted teal, rounded cards, KZT, Astana time | Shared visual direction through native StyleSheet components and accessible touch controls. |

## Boundaries

React Navigation native stack handles Welcome, Sign In, Sign Up, Parking Details and Reservation. Bottom tabs handle Parking Map, Search and Filters, My Bookings and Profile. Auth state controls available routes; logout removes protected navigation history.

The mock repository persists a versioned snapshot through AsyncStorage. Writes run through one queue and only update UI after storage succeeds. It validates allocation, pricing, owner identity and time range. This protects local concurrent requests, not multiple devices. A corrupt snapshot raises a visible recovery error rather than silently erasing records.

The optional API adapter allows only loopback or private LAN addresses. Production and public endpoints are rejected. Existing shared demo cookie sessions remain demo authentication. It requires a local server reachable from the phone, native cookie behavior and HTTP/network configuration verification. There are no production migrations, API edits, cloud builds, deployment calls or new environment files.

## Sources

- [Expo SDK documentation](https://docs.expo.dev/versions/latest/)
- [Expo native maps](https://docs.expo.dev/versions/latest/sdk/map-view/)
- [Expo repository TypeScript template](https://github.com/expo/expo/tree/main/templates/expo-template-blank-typescript)
- [React Navigation installation](https://reactnavigation.org/docs/getting-started/)

Exact installed versions and verification outcomes are recorded in the local lockfile and README. Native simulator/device execution needs an installed simulator or Expo Go; this computer initially had only Xcode Command Line Tools and no Android SDK.
