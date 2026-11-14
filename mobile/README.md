# Parkly mobile

React Native + Expo + TypeScript driver prototype, added beside the existing website on `feature/mobile-app`. No deployment or production-system changes were performed.

## Run

Requires Node >=22.13 (Node24.19 used here), pnpm and an Expo Go version compatible with SDK58, or an appropriately configured native development environment.

```bash
cd "/Users/dmp/Documents/codex tg/parkly/site/mobile"
pnpm install --frozen-lockfile
pnpm start
```

Open the QR code in a compatible Expo Go app on the same network. Use `pnpm ios` with a configured Xcode/iOS simulator or `pnpm android` with an Android SDK/emulator. Neither simulator environment is installed on this computer. Initial dependency installation requires network access.

For the browser preview:

```bash
pnpm web
```

The browser preview uses React Native Web and an explicitly labeled schematic map. It is useful for the demo flow; it does not prove native-device behavior. A local static preview of the checked export can also be served with:

```bash
pnpm export:check
python3 -m http.server 8082 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8082/`. These commands run locally and do not publish the app.

If Node/pnpm are not in this computer’s shell PATH:

```bash
export PATH="/Users/dmp/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/dmp/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"
```

## Screens and demonstrated behavior

1. Welcome — Parkly branding, demo notice and entry points.
2. Sign In — select a saved fictional email; seeded example `alex@parkly.demo`.
3. Sign Up — create a device-local fictional profile; duplicate email and invalid fields rejected.
4. Parking Map — Astana demo markers, search and location cards. iOS/Android use native maps; browser uses a schematic.
5. Search and Filters — destination, price, parking type, demo availability, empty results and reset.
6. Parking Details — location, type, allocated inventory, rate, operating assumptions and conditions.
7. Reservation — Astana date/hour, duration, selected-time availability, price review, confirmation and reference.
8. My Bookings — Upcoming/Active/Past/All, refresh, references, cancellation confirmation and persistent history.
9. Profile — demo identity, display-name editing, service/data explanation and sign-out.

The native stack and four bottom tabs use React Navigation. Logout removes protected screens. UI uses the website’s charcoal, muted teal, neutral backgrounds, rounded cards and KZT prices. Text inputs have accessible labels; loading, error, empty and retry states are included.

## Mock authentication and booking

Default mode is **mock**. All listings and allocation are fictional. No real space, identity verification, payment or refund is provided. Sign In and Sign Up deliberately do not ask for passwords: the website has no real credential API. Local profiles are demo identification; anyone with access to the device can choose a stored profile.

AsyncStorage holds only fictional profile/session and booking data under `parkly-mobile-demo-v1`. It is not encrypted credential storage. Use fictional details. Data survives reload/sign-out and is scoped by demo profile ID; there is no cloud sync. Removing app/browser storage removes local demo data. Corrupt storage is reported without silently clearing it.

Bookings use whole hours, 1–24-hour duration, future starts within90days, price snapshots and allocated inventory. Mutations are serialized and saved before the UI reports success. Overlapping requests cannot exceed capacity within one repository instance. Cancellation before start releases simulated inventory. This is not a multi-device reservation guarantee. Matching the website, overlap counting is conservative and can reject a long interval even when exact peak occupancy would permit it.

## Reuse and local API mode

Read [ARCHITECTURE.md](ARCHITECTURE.md) for the audit and decisions.

- Imports the original `../lib/demo.ts` fixtures through the domain/service layer.
- Imports `bookingPrice` from the original `../lib/finance.ts`, also used by the website backend.
- Preserves existing API field names, parking IDs, booking statuses and policy.
- Includes a `ParklyRepository` abstraction and `services/local-api.ts` adapter for the unchanged `/api/demo` and `/api/availability` routes.

To opt into API testing, edit `src/config.ts` to `mode:'local-api'` and a **local development** URL. Public/hosted URLs and redirects are rejected. No production address or key is configured. Start the existing website locally using its own README. The mobile adapter does not create database schemas or alter the website API.

On a physical phone, `localhost` means the phone: use the computer’s private LAN IP and an intentionally LAN-bound development server. On Android Emulator, the host is commonly `10.0.2.2`; iOS Simulator can use loopback. HTTP transport/ATS and cookie-session behavior must be verified on the actual target. Native Google Maps in a custom Android binary needs authorized Maps configuration; Expo Go supplies its own testing configuration. No API key was invented. The map includes an offline schematic option. iOS defaults to Apple Maps.

API mode reuses the website’s shared driver demo role and HTTP-only session via `credentials:'include'`; it is not a production account flow. The website has no sign-up endpoint, so API-mode Sign Up explains that limitation. Browser preview with a different-origin API server requires suitable local CORS/proxy configuration; none was added to the website. API-mode transport is contract-tested with a fake fetcher, not claimed verified on a device or against production.

## Isolation and website preservation

Mobile has a separate package manifest, lockfile, nested workspace and ignored build/runtime files. Website dependencies, lockfile, routes, UI, models and domain files are unchanged. The only existing tracked-file change is adding `mobile` to the website’s TypeScript `exclude` list. No website files were moved or deleted. No environment files, credentials or secrets were added or committed. No changes were committed or pushed.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm export:check
```

Verified locally:

- Mobile TypeScript check passed.
- Eleven basic domain/repository/API-contract tests passed: pricing, persistence, cancellation, concurrent capacity, owner separation, validation, storage failure recovery, corrupt data, filters, profile updates, local-only URL enforcement and server errors.
- Expo SDK dependency check passed against its installed compatibility map (offline validation).
- iOS and Android Hermes bundles plus web bundle exported successfully. This is bundling, not a signed native binary or native runtime test.
- Browser walkthrough passed all nine screens, including sign-up, sign-in, filters, invalid duration,800KZT confirmation, reload persistence, cancellation and history; no browser errors observed.
- Existing website TypeScript, four tests and Vinext build passed.

See [VERIFICATION.md](VERIFICATION.md) for the record.

## Incomplete / future work

Native iOS/Android runtime execution and native map behavior remain untested here. Production authentication/signup, secure token storage, real partner inventory, payments/refunds, push notifications, background tasks, cross-device sync and native E2E automation are not implemented. The local API adapter needs device integration testing. UI language is English. No app-store upload, website deployment, production migration or production API request was made.

## EAS cloud builds

Cloud build preparation was separately authorized after local MVP verification. `eas.json` contains a `production` profile for Android App Bundle and signed iOS store builds, plus a `preview` profile for an installable Android APK and an iOS Simulator build. A simulator build does not install on a physical iPhone. Store builds require the appropriate signing credentials; iOS store signing also requires an Apple Developer membership. Build submission does not submit the app to a store.

Use `pnpm dlx eas-cli@latest login`, `pnpm dlx eas-cli@latest build:configure --platform all`, then `pnpm dlx eas-cli@latest build --platform all` from this directory. `npx eas-cli@latest` is equivalent when npm/npx are installed. The login browser handles credentials; never put passwords or tokens in source files or chat. Credentials/environment files are excluded in `.gitignore` and `.easignore`. No automatic Git commit is required.

This project is linked to `@damil12/parkly-mobile-demo` (project ID `0b3e0154-22b0-4efe-833c-7b097d02c9d4`) under the personal account selected by the user. The separately selected iOS Simulator build uses `--platform ios --profile preview`; it avoids Apple signing credentials. Android signing-key creation requires the user's explicit approval before a first Android cloud build.

The repository-root `.easignore` is required because EAS packages from the Git root. Archive inspection confirmed only `mobile/` and `lib/demo.ts`/`lib/finance.ts` are included. It excludes Git metadata, website source, local database/runtime state, environment files and credentials. A bare `.git` rule is intentional: EAS checks that exact path when removing clone metadata; a directory-only trailing-slash rule did not remove it in this CLI version. The website is preserved locally. Before adding shared modules or changing the project layout, inspect the archive again.

Android uses the labeled interactive schematic by default, including in standalone builds, because an authorized Google Maps key has not been configured. The native map can be enabled through `nativeMapConfig` only after the corresponding native Google Maps setup is implemented. iOS defaults to Apple Maps and retains the offline schematic option. No map key was invented.
