# Firebase setup for OOTSS

OOTSS follows [Stronger](https://github.com/natoverse/stronger)'s Firebase
pattern: Google sign-in, persistent authentication, Cloud Firestore, and a
private `/users/{firebaseUid}/settings/ootss` document for each user.
Create a **separate Firebase project for OOTSS**. Do not copy Stronger's
configuration or connect OOTSS to Stronger's database.
The document is named `ootss` rather than Stronger's `app` as an additional
safeguard against accidentally overwriting Stronger settings.

## Which console do I use?

These are separate websites, but **the Firebase project and its underlying
Google Cloud project share the same Project ID**. Create the OOTSS project
once in Firebase; do not create a second project when switching to Google
Cloud Console.

| Website | What you do there |
|---|---|
| [Firebase Console](https://console.firebase.google.com/) | Create the project and Firestore database, enable the Google sign-in provider, add authorized domains, publish Firestore rules, register the web app, copy `firebaseConfig`, and inspect saved users/data. |
| [Google Cloud Console](https://console.cloud.google.com/) | Check or enable underlying APIs only if needed. Select the same OOTSS Project ID you created in Firebase. |
| [GitHub: natoverse/ootss](https://github.com/natoverse/ootss) | Add repository secrets and run the deployment workflow. |
| [Deployed OOTSS app](https://natoverse.github.io/ootss/) | Sign in, change settings, and verify cloud synchronization. |

**Google sign-in is configured in Firebase Console**, even though the
provider is Google. For this Firebase SDK flow, you do not need to create a
separate OAuth client in Google Cloud Console. Copy the web configuration
from Firebase, not from Google Cloud's **APIs & Services > Credentials** page.

## 1. Firebase Console: create the project and database

1. Open the [Firebase console](https://console.firebase.google.com/).
2. Create a project, for example **OOTSS**. Analytics is not required.
3. Record its **Project ID** in **Project settings > General**.
4. Open **Firestore Database > Create database**.
5. Select **Standard edition**, the database ID **`(default)`**, a suitable
   region, and **Production mode**. Do not select test mode or create a named
   database.

You do not need to create collections or documents manually. The app creates
each user's settings document after sign-in. Firebase Hosting is not needed;
the web app remains on GitHub Pages.

## 2. Firebase Console: enable Google sign-in

1. Stay in **Firebase Console**, with the OOTSS project selected.
2. Open **Build > Authentication > Sign-in method**. If prompted, select
   **Get started** first.
3. Enable **Google**, select a project support email, and save.
4. In **Authentication > Settings > Authorized domains**, add
   **`natoverse.github.io`**.

Enter the hostname only, not `https://natoverse.github.io/ootss/`.
Every user signs in with their own Google account; Firebase supplies the UID.
There is no separate Google Calendar authorization or Google client ID to
configure for this app.

## 3. Firebase Console: publish the database security rules

1. In **Firebase Console > Build > Firestore Database > Rules**, replace the
   rules with the contents of [`firestore.rules`](firestore.rules) from this
   repository.
2. Select **Publish**.

Publish these rules **before enabling the Firebase-backed deployment**.
They allow an authenticated user to access only their own settings document,
validate its outer structure, and deny all other database paths. They do not
allow public reads or writes. No custom indexes are needed.

## Optional: Google Cloud Console API checks

**This is the only setup section that uses Google Cloud Console rather than
Firebase Console.** Use it if an error names `SERVICE_DISABLED` or reports
that a required API is disabled.

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Use the project selector at the top to select the **existing OOTSS
   project**. Match its **Project ID** to the one recorded in step 1, not
   just its display name. Do not select Stronger or create another project.
3. Open **APIs & Services > Library**.
4. Search for **Cloud Firestore API** (`firestore.googleapis.com`).
   Open its page and select **Enable** if it is disabled.
5. Repeat for **Identity Toolkit API** (`identitytoolkit.googleapis.com`).
6. Return to **Firebase Console** for the remaining Firebase steps.

## 4. Firebase Console: register the web app

1. In **Firebase Console**, open the project settings gear, then
   **Project settings > General > Your apps**.
2. Select the web icon **`</>`**, name the app **OOTSS**, and register it.
3. Under **SDK setup and configuration**, select **Config**.
4. Copy the six fields from the displayed `firebaseConfig` object.

Use this project's values, not Stronger's:

| Firebase field | OOTSS repository secret |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `storageBucket` | `VITE_FIREBASE_STORAGE_BUCKET` |
| `messagingSenderId` | `VITE_FIREBASE_MESSAGING_SENDER_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

## 5. GitHub: configure Actions and deploy

1. Switch to [the natoverse/ootss repository on GitHub](https://github.com/natoverse/ootss).
2. In **Settings > Secrets and variables > Actions**,
   create the six **repository secrets** above.
3. In **Actions > Deploy GitHub Pages**, choose **Run workflow**, with
   **main** selected.
4. Wait for the deployment to succeed, then refresh
   [OOTSS](https://natoverse.github.io/ootss/).

The secret names deliberately match Stronger. OOTSS is a static app, not a
Vite app: its Actions workflow generates `js/firebase_config.js` from these
values when preparing the site. They are intentionally public in the deployed
browser configuration. Authentication and Firestore rules protect the data,
not secrecy of the Firebase web API key.

**Do not add a service-account key, `FIREBASE_USER_ID`, or
`VITE_GOOGLE_CLIENT_ID`.** OOTSS needs none of Stronger's administrative health
sync credentials. Never commit a service-account key or expose one in browser
configuration.

After changing configuration secrets, redeploy; refreshing alone cannot update
the generated configuration. A deployment with only some of the six secrets
fails explicitly instead of enabling a misconfigured client.

## 6. OOTSS app and Firebase Console: verify the new database

1. In the **deployed OOTSS app**, use the top-right **sign in with Google**
   button.
2. Your Google profile starts with fresh settings unless this account already
   has a cloud save. Guest settings remain untouched in localStorage; there is
   no automatic import.
3. Reveal a screen or change a setting and wait for **synced**.
4. Switch to **Firebase Console**, select the OOTSS project, and open
   **Build > Firestore Database > Data**. Find
   **users > your Firebase UID > settings > ootss**.
5. Return to **the OOTSS app**. Refresh it, or sign in with the same account
   on another device, and verify the saved state loads.
6. Sign out and verify the browser's original guest state returns.

The document contains `values` (settings fields encoded as JSON strings, as in
Stronger) and a server-generated `updatedAt` timestamp. All map preferences,
completed-level flags, and per-layer fog state belong to that profile.

**Settings > Save Settings** exports whichever profile is active, including
unsynced in-memory changes. **Settings > Load Settings** is an explicit import
into the active guest or signed-in profile. Reset also affects only that profile.
An authenticated profile never silently falls back to guest data if its cloud
document fails to load; retry or explicitly sign out instead.

Authentication remains signed in using Firebase's persistent browser session.
Firestore caches data and pending writes in IndexedDB; this cache is not cleared
automatically between sessions. Use a trusted browser/device. Guest saves still
use localStorage, but signed-in map settings are written only to Firestore.

Writes are coalesced to limit requests. **saving...** means changes are pending;
**synced** means the current settings were acknowledged by Firestore. On failure,
the app displays **sync error** and retains the current draft for retry or export.
Reconnect and sync pending edits before signing out. Other devices read the
latest profile on refresh; concurrently editing multiple devices can result in
last-write-wins replacement.

## Troubleshooting

| Symptom | What to check |
|---|---|
| Firebase setup is still pending | **GitHub:** add all six secrets to **natoverse/ootss**, rerun Actions, and refresh the app. |
| Sign-in reports an unauthorized domain | **Firebase Console:** add `natoverse.github.io` under **Authentication > Settings > Authorized domains**. |
| Sign-in popup is blocked or closed | Allow the popup for the app and retry sign-in. |
| Sign-in reports that the operation is not allowed | **Firebase Console:** enable the Google provider under **Authentication > Sign-in method**. |
| Authentication API rejects the key | **Firebase Console:** copy all six values from the same OOTSS web app's config. **GitHub:** update the secrets and redeploy. |
| Firestore returns permission denied | **Firebase Console:** publish this repository's rules under **Firestore Database > Rules**, then sign in again. |
| Firestore database is not found | **Firebase Console:** create the Standard **`(default)`** database, not a named database. |
| An error names `SERVICE_DISABLED` | **Google Cloud Console:** select the same OOTSS Project ID, enable the named API under **APIs & Services > Library**, and allow time for activation. |
| Cloud settings cannot load | Retry after checking the database/rules; sign out only if you want to return to the separate guest save. |
| Status stays offline or saving | Reconnect and wait for acknowledgment before signing out; export a JSON backup if needed. |

Official references: [Firebase and Google Cloud project relationship](https://firebase.google.com/docs/projects/learn-more),
[enabling Google Cloud APIs](https://docs.cloud.google.com/service-usage/docs/enable-disable),
[Google sign-in](https://firebase.google.com/docs/auth/web/google-signin),
[Firestore rules](https://firebase.google.com/docs/firestore/security/rules-conditions),
and [offline caching](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
