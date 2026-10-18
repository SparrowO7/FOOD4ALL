# Android pilot verification — 18 October 2026

## Version 0.2.0 — Food4All India and Admin panel

- Final artifact: `artifacts/Food4All-India-Pilot-0.2.0.apk` (40,916,720 bytes), package `org.food4all.pilot`, version code 2. Launcher/application label is **Food4All India**. The same India branding appears in the website header/footer/metadata, app header/title, packing labels and share/print text. Existing URL schemes and account identifiers remain compatible.
- SHA256: `93273212619982e89cd7d90a55cbb31e48386283f761eb4f68af1f64f6e883c0`.
- Mobile production build, native Android build and final `apksigner` / packaged-assets verification passed. The update uses the original pilot signing identity; no uninstall is required for an update from 0.1.0.
- Website TypeScript check and production build passed with Food4All India branding. The first sandboxed build hit a Windows EPERM on generated Next.js folders; the authorised build outside that filesystem restriction completed successfully.
- Three login options: Lawn / donor, NGO, Admin. Signup is only available for donors/NGOs. The authenticated server profile determines the role; no local developer-password bypass or privileged key was added.
- Existing seeded admin login was verified in browser, with exact overview status counts, organisation details, all batches and distribution reports. Legacy missing people/area fields display as not recorded. A donor login through the Admin option was explicitly rejected by the final branded build.
- 38 local database security checks passed, including admin assignment restrictions, NGO self-verification rejection, admin review attribution and protection against a stale second review overwriting an already processed pending request. The test fixture was updated to model Supabase Storage and current vegetarian requirements. An old migration's idempotency check now runs at that migration's schema version, before later migrations extend its views.
- Review write tests used local PGlite. No NGO decisions were changed in the live project for this verification. Native emulator install/launch results below belong to the 0.1.0 baseline; this update's admin UI was tested in browser, and its final binary signature/package/branding were verified.
- Admin features in this release: pending NGO approval/rejection with confirmation, food batch status monitoring, paginated reported distributions with people reached and per-page CSV export, and batch-event history. Suspension, record deletion and editing distribution counts are not exposed.

## Version 0.1.0 baseline

## Completed checks

- Mobile TypeScript and Vite production build passed. Warnings concern the shared Next.js `use client` directive and bundle splitting; no build errors remain.
- Existing website TypeScript check passed after excluding the standalone mobile project from its compilation.
- 15 local database tests passed for direct NGO collection/distribution, ownership, expiry, audit events and duplicate completion protection.
- 6 local database tests passed for vegetarian-only publication and vegan/Jain support.
- 3 QR parsing tests passed, covering raw batch IDs, app links, website labels, malformed input and executable payload rejection.
- `npm audit --omit=dev --prefix mobile` reported zero known runtime dependency vulnerabilities at verification time. This does not audit native Maven dependencies.
- Browser smoke checks with existing demo donor and NGO accounts passed: sign-in, organisation profile, private food photo, own batches, register records, vegetarian-only form, completed batch details, QR label generation and QR-text fallback navigation. No new live food listings were published by these mobile checks.
- Android merged manifest confirmed API 26 minimum / API 36 target, camera and optional location permissions, `food4all://batch` deep link, disabled backup and disabled cleartext HTTP.
- APK configuration uses only the project's public publishable key. No service-role key is included. The app bundles local screens and has no `server.url` pointing to a development machine.

## Native build and installation

- Initial Android build passed; final reproducible build through `tools/build-android.ps1` passed (`:app:assembleDebug`, 25 seconds with cached dependencies).
- Artifact: `artifacts/Food4All-Pilot-0.1.0.apk`, 40,912,548 bytes; package `org.food4all.pilot`, version 0.1.0 / code 1.
- Official Android `apksigner verify --verbose` passed, APK Signature Scheme v2, one debug signer. `aapt dump badging` confirmed minimum API 26, target API 36 and ARM64 / ARM32 / x86 / x86_64 libraries.
- APK ZIP inspection confirmed bundled `assets/public/index.html` and no development `server.url` in packaged Capacitor configuration.
- Installed into a disposable project-local Android 36.1 x86_64 emulator: `adb install -r` returned `Success`.
- First activity launch exceeded Android's wait timeout during first WebView initialisation; logs subsequently confirmed resumed Food4All activity, local HTTPS asset requests and registration of all six native plugins plus FoodPrint. No JavaScript or AndroidRuntime errors appeared in the inspected app logs.
- Cold launch from `food4all://batch/866f949f-2136-4e03-95dc-30fcafe82a45` passed: `Status: ok`, `LaunchState: COLD`, correct Food4All activity, total time 9,908 ms. This confirms native link routing; camera scanning is a separate field test.
- SHA256: `6093b6e2b9a054817f4e1fc32382ee05b11d0355a3c8a2e9c5191ac51e9991c7`.

## Remaining field checks

A real Android phone is still needed to check camera focus on printed labels, gallery/camera permissions on that phone, GPS accuracy at a venue, native share targets, physical printer output and the lawn-to-NGO handover in the field. Automated database tests are not evidence of real food distribution.

Public browser QR links need an actual HTTPS website deployment and `VITE_PUBLIC_TRACE_ORIGIN` configuration. The current app QR is an app deep link. A release signing identity and Play Store publishing have not been set up. Email-confirmation redirect URLs must be configured for the eventual public website before inviting external users.
