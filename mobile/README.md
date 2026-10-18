# Food4All India Android pilot

The Android client bundles its React screens inside the APK and connects to the same Supabase backend as the website. It does not load a laptop's localhost website. Internet is required for sign-in, records and handover confirmations; there is no offline write queue.

## Included workflow

Version 0.2.0 adds three login choices (Lawn / donor, NGO, Admin). The server-stored profile role determines access; the selector grants no privileges. Admin signup is not offered. Assigned admins have current status counts, NGO review with a confirmation step, batch monitoring, paginated distribution reports including reported people reached, per-page CSV export, and batch-event history. Reviews update only still-pending requests and record reviewer ID/time. This panel does not suspend accounts, delete records or silently edit distribution counts.

- Donor / NGO login and signup; contact and organisation profiles.
- Vegetarian, vegan and Jain draft batches with preparation/use-before times, storage, pickup point and optional private food photo.
- Donor declaration excludes meat, fish, eggs and non-vegetarian ingredients and confirms separate packing and never-served food. These are declarations, not independent certification.
- Publish → verified NGO claim → direct NGO collection → actual distribution counts and area → completed record.
- Native QR camera scanner, manual batch ID fallback, GPS pickup location, camera/gallery photo selection.
- Locally generated packing label PNG, Android print sheet and native sharing; private batch journey and CSV register export.
- Administrator NGO review screen. Database RLS, triggers and atomic RPCs remain the authority for access and transitions.

One QR identifies one batch. Scanning opens its record; it does not automatically declare a distribution. Only the claiming NGO can confirm it, and repeat completion is rejected by the database. Partial distribution across multiple NGOs and individual packet tracking are not implemented. Older volunteer-assigned handovers should be finished on the website.

## QR links

Until a public HTTPS website is configured, labels encode `food4all://batch/<uuid>`. The installed app handles this deep link and its own QR scanner. A phone without the app cannot open this custom link. Configure `VITE_PUBLIC_TRACE_ORIGIN` to the actual deployed HTTPS website before rebuilding if public browser trace links are needed. Existing printed labels keep their original links.

## Rebuild on Windows

Requires Node, JDK 21 and Android SDK platform 36 / build tools. The barcode scanner requires Android 8.0 (API 26) or later on the phone.

1. From `mobile`, run `npm ci`.
2. Copy `.env.example` to `.env.local`, set the existing project's public Supabase URL and anon key only. Never put a service-role key in `VITE_*` variables.
3. Run `powershell -ExecutionPolicy Bypass -File tools/build-android.ps1`. Optional parameters: `-JavaHome`, `-AndroidSdk`.
4. The script builds the bundled web assets, synchronises plugins, compiles a debug-signed APK and copies it to `../artifacts/Food4All-India-Pilot-0.2.0.apk`.

The first build downloads official Gradle/Maven dependencies. Android SDK licences must already have been accepted by the developer. The script uses a project-local temporary directory because excessively long Windows sandbox TEMP paths break JDK Unix sockets.

## Distribution status

This is a pilot/debug build for direct installation and evaluation, not a Play Store release. Release signing, an owner-controlled signing-key backup, Play Console setup, a published privacy policy and device field testing are separate release tasks. A debug signing key is local build state and must never be committed. To upgrade without uninstalling, retain the original signing identity.

The app requests camera and location at the feature that uses them. Location is optional: a donor can enter pickup coordinates manually. Android app backup and cleartext HTTP are disabled. Private storage uses short-lived signed URLs, and recipient names are not collected in the distribution form.

See `VERIFICATION.md` for the actual build and verification results, including anything not tested on a physical device.
