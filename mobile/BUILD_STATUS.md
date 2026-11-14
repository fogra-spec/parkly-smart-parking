# EAS build status — 23 October 2026

Expo account: `damil12` (Personal), explicitly selected by the user.

Project: [@damil12/parkly-mobile-demo](https://expo.dev/accounts/damil12/projects/parkly-mobile-demo)

EAS project ID: `0b3e0154-22b0-4efe-833c-7b097d02c9d4`.

## iOS Simulator — finished

- Build ID: `6a20be2b-fa13-4d68-b574-4d87e3f40ede`.
- Profile: `preview`, with `ios.simulator:true`.
- [Build details](https://expo.dev/accounts/damil12/projects/parkly-mobile-demo/builds/6a20be2b-fa13-4d68-b574-4d87e3f40ede).
- [Download Simulator artifact](https://expo.dev/artifacts/eas/9kK-JCghJcYnKXBnFrBUUGFQODbvM1zWLaW7baMxZtc.tar.gz).
- Completed: 23 October 2026,22:44:52 Asia/Almaty.
- Bundle identifier: `kz.parkly.classroom`.

This is an unsigned iOS Simulator artifact, selected by the user. It is not an iPhone installation file, TestFlight release or App Store submission. No Apple signing credentials were created. Native cloud compilation succeeded; UI execution in a local simulator remains untested because Xcode/Simulator is not installed here.

## Android — awaiting signing-key approval

EAS requested permission to generate and store a new Android signing keystore. Automatic approval review blocked that consequential credential change until the user explicitly authorizes it. The Android build was not submitted and no signing key was created during this run. Resume the pending approval, then run `pnpm dlx eas-cli@latest build --platform android` for the production App Bundle, or explicitly choose the preview profile for an installable APK.

## Source and security checks

The upload archive was locally inspected before submission. It contained the mobile app and two shared pure TypeScript modules, with no Git metadata, website source, local database/runtime data, environment files or signing credentials. The root `.easignore` controls that archive. No Git commit or push was performed. The existing website and its production deployment were not changed.

Mobile TypeScript and all11 basic tests passed after the standalone Android map fallback was added. Android uses the labeled schematic until an authorized native Maps configuration exists. The iOS build uses Apple Maps with an optional schematic fallback.
