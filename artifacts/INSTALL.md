# Food4All India Android pilot 0.2.0

This update adds Lawn / donor, NGO and Admin login choices. Install over version 0.1.0; application ID/signing identity are unchanged and version code increased to 2. If already signed in, sign out from Profile to use another role.

Existing seeded test admin account: `demo.admin@food4all.dev`. Use the project's seeded demo password. This is an existing test account, not a newly created personal owner account. `demo@123` / `999` is not a live admin login. Owner admin accounts must be assigned through a trusted backend route; public signup cannot create admins.

1. Transfer `Food4All-India-Pilot-0.2.0.apk` to your Android phone (Android 8.0 or newer).
2. Open that file and permit installation from your file manager if Android asks. Install Food4All India.
3. Connect to the internet and sign in using your existing Food4All India lawn/donor or NGO account. Website and Android app share the same database.
4. Donor: complete your profile → Share food → save draft → review → publish → print/share its QR packing label.
5. Verified NGO: Food / Scan QR → claim → collect → scan/open again after serving → enter actual servings, people reached and area → confirm distribution.

Camera and location permissions are requested when you use those features. Manual batch IDs and manual pickup coordinates are available. Labels show donor-declared preparation/use-before times; food condition and storage must still be inspected at handover.

Current QR labels open in the installed app (`food4all://batch/...`). A public browser trace link can be configured when the website has a public HTTPS domain. This is a debug-signed pilot APK for testing and direct installation, not a Play Store release. Physical-phone camera, printed QR and printer checks remain to be done.

Rebuild instructions: `../mobile/README.md`. Verification details: `../mobile/VERIFICATION.md`. Checksum: `SHA256SUMS.txt`.
