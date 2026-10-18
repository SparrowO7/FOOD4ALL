# Food4All India 0.2.0 — Android pilot

Food4All India now supports the direct lawn-to-NGO food-sharing workflow on
both the website and a bundled Android client using the same Supabase backend.

## Included

- Food4All India branding in the website, Android launcher/app and QR labels.
- Lawn / donor, NGO and assigned Admin login. Public signup cannot create admins.
- Vegetarian-only donation forms and database enforcement, including vegan/Jain
  choices, separate-packing and never-served declarations.
- Private food photos with validation/resizing and short-lived signed URLs.
- Locally generated batch QR labels, native scanner, sharing and printing.
- Verified NGO claim, direct collection and atomic distribution recording with
  actual reported servings, people reached and distribution area.
- Admin NGO reviews with confirmation, batch monitoring, reported distributions,
  per-page CSV export and batch-event history.
- Database migrations through `0020_vegetarian_only.sql` and security tests.

## Install and configuration

Download `Food4All-India-Pilot-0.2.0.apk` from the release assets. Requires Android
8.0+ and internet. The app is debug-signed for pilot evaluation. Application ID
and signing identity are unchanged from pilot 0.1.0, with version code increased
to 2, so existing installations can be updated in place.

Until a public HTTPS website is configured, labels use `food4all://batch/<uuid>`
and open in the installed app. The app's scanner also understands website
trace links. Public browser QR links require rebuilding with
`VITE_PUBLIC_TRACE_ORIGIN` set to the deployed website.

Deploy migrations in filename order for a new Supabase project. Existing
projects should apply only unapplied migrations after a backup and staging
check. See `supabase/README.md` and `mobile/README.md` for setup.

## Verified and remaining work

Website and mobile production builds passed; the APK signature, version,
launcher name and bundled screens were verified. The database security suite
passed 38 checks; direct NGO workflow, vegetarian-only rules and QR parsing
have additional tests. Admin screens were checked against existing demo data.
Emulator install/launch checks were performed on the 0.1.0 baseline; the update
retains its signing identity and native integration.

Physical-phone camera, printed-QR, location, sharing and printer field checks
remain pending. Production signing, Play Store publication, public hosting and
owner account setup are separate release tasks. Demo counts are not evidence
of real meals distributed. Replace seeded test access before a real pilot.
