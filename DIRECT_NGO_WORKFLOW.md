# Lawn–NGO workflow — 18 October 2026

Current product priority: mobile use by lawns/food donors and NGOs. Volunteer assignment and push notifications are not required for direct collection/distribution.

Implemented:
- Migration 0019 applied to hosted Supabase: verified claiming NGO can collect directly, then record actual servings, people reached and distribution area.
- Collection and distribution are separate explicit confirmations. Distribution writes the delivery, terminal status and audit events in one transaction.
- Same batch QR opens the food label, lets a signed-in NGO claim an available batch, and lets the claiming NGO record collection/distribution. A repeat scan does not increment counts.
- Anonymous scanners cannot change status. Wrong NGO, expired food, invalid counts and duplicate completion rejected.
- QR login returns to the scanned trace page.
- Placeholder food4all.example origin removed; links follow configured site URL or current request origin. Public HTTPS hosting is required before printing labels for use outside the local network.
- Label times explicitly use IST. One QR identifies one donation batch; packet-level serialization and partial distribution across multiple NGOs are not implemented.
- Signup prioritises lawn/food donor and NGO.

Verification: scripts/direct-ngo-test.mjs — 15 isolated PostgreSQL checks passed (auth and storage schemas stubbed). Hosted migration success confirmed. No new live sample listings or direct-distribution test records created in this change.

Food4All India Android pilot APK 0.2.0 is built at `artifacts/Food4All-India-Pilot-0.2.0.apk`, with bundled screens, the existing Supabase backend and assigned-admin login/reviews/reports. Its build/signature/package checks pass; emulator installation was verified for the 0.1.0 baseline. See `mobile/VERIFICATION.md` for exact checks. Public hosting, release signing/Play Store publication and physical-phone camera/printed-label checks remain unfinished.
