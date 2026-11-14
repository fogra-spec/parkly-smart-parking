# Mobile verification record

Date: 23 October 2026 (Asia/Almaty). Branch: feature/mobile-app. Website baseline:0d09da98957d0a27eb4c71f44dbb5a1d5a5f4b65.

| Check | Outcome |
|---|---|
| Mobile TypeScript | Passed, strict mode |
| Mobile tests | 11 passed,0 failed |
| Concurrency | Eight requests for five slots: five success, three rejected; availability never negative |
| Persistence | New repository instance restores booking; browser reload restores signed-in profile and history |
| Pricing | Two hours ×400KZT =800KZT, using existing website calculation |
| Cancellation | Confirmed before-start cancellation; record remains as cancelled; capacity released |
| Validation | Past/fractional/non-hour/over-24h/over-90day requests, pending listing and stale quote rejected |
| Profile boundaries | Other local profile cannot cancel a booking; sign-out hides profile bookings |
| Storage errors | Failed save does not leave ghost booking; queue recovers; corrupt data is reported without overwrite |
| API contract | Existing login/availability/history fields and credentials reused through injected fetcher |
| Public URL rejection | Hosted endpoints, public hosts, misleading127/10hostnames, credentials and paths rejected |
| Expo SDK dependencies | Installed compatibility-map check passed offline; registry-backed doctor was not run |
| Android export | Hermes bundle generated,978 modules in checked export |
| iOS export | Hermes bundle generated,1008 modules in checked export |
| Web export | JS/assets/index generated,602 modules in checked export |
| Browser UI | Welcome → Sign Up → Map → Filters → Details → Reservation → My Bookings → Profile → Sign Out → Sign In passed |
| Browser errors | No error entries in checked browser log |
| Website TypeScript/tests | Passed; all four prior tests passed |
| Website build | Passed with existing routes `/`, `/api/demo`, `/api/availability` |
| Production systems | No deployment, hosted API request, migration, EAS build or store upload performed |

Browser reservation example: Botanical Garden Garage, two hours,800KZT, reference `PK-M-MVL7X4VP-2-BXPWU`. This was fictional, persisted in browser local storage and then cancelled. A25-hour duration showed a validation message and disabled review. Price400KZT and Covered filters reduced the results from five to one.

Native runtime, native maps, physical-device cookie behavior and signed APK/IPA builds are not verified. No iOS simulator/Xcode or Android SDK was available. The browser uses the labeled schematic map. Local API tests used a fake transport, with no production connection. Cancellation/inventory tests use an isolated in-memory storage adapter; browser flow additionally exercised AsyncStorage’s web persistence.

## Subsequent authorized cloud build

After this local MVP verification, the user separately requested EAS login, configuration and cloud builds. The unsigned iOS Simulator build compiled successfully on EAS. Android remains pending explicit signing-key approval. See [BUILD_STATUS.md](BUILD_STATUS.md) for the build ID and artifact. The local-verification table above describes the earlier snapshot; native device/UI execution and app-store submission still have not been performed.
