# Firebase setup for OOTSS

OOTSS follows [Stronger](https://github.com/natoverse/stronger)'s Firebase
pattern: Google sign-in, persistent authentication, Cloud Firestore, and a
private `/users/{firebaseUid}/settings/ootss` document for each user.
Create a **separate Firebase project for OOTSS**. Do not copy Stronger's
configuration or connect OOTSS to Stronger's database.
The document is named `ootss` rather than Stronger's `app` as an additional
safeguard against accidentally overwriting Stronger settings.

## 1. Create the project and database

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

## 2. Enable Google sign-in

1. Open **Authentication > Sign-in method**.
2. Enable **Google**, select a project support email, and save.
3. In **Authentication > Settings > Authorized domains**, add
   **`natoverse.github.io`**.

Enter the hostname only, not `https://natoverse.github.io/ootss/`.
Every user signs in with their own Google account; Firebase supplies the UID.
There is no separate Google Calendar authorization or Google client ID to
configure for this app.

## 3. Publish the database security rules

1. In **Firestore Database > Rules**, replace the rules with the contents of
   [`firestore.rules`](firestore.rules) from this repository.
2. Select **Publish**.

Publish these rules **before enabling the Firebase-backed deployment**.
They allow an authenticated user to access only their own settings document,
validate its outer structure, and deny all other database paths. They do not
allow public reads or writes. No custom indexes are needed.

The project needs the **Cloud Firestore API** (`firestore.googleapis.com`) and
**Identity Toolkit API** (`identitytoolkit.googleapis.com`). If either is
disabled, enable it in **Google Cloud Console > APIs & Services > Library**,
with the new OOTSS project selected.

## 4. Register the web app

1. Open **Project settings > General > Your apps**.
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

## 5. Configure GitHub Actions and deploy

1. In **natoverse/ootss > Settings > Secrets and variables > Actions**,
   create the six **repository secrets** above.
2. In **Actions > Deploy GitHub Pages**, choose **Run workflow**, with
   **main** selected.
3. Wait for the deployment to succeed, then refresh
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

## 6. Use and verify the new database

1. Open OOTSS and use the top-right **sign in with Google** button.
2. Your Google profile starts with fresh settings unless this account already
   has a cloud save. Guest settings remain untouched in localStorage; there is
   no automatic import.
3. Reveal a screen or change a setting and wait for **synced**.
4. In **Firestore Database > Data**, find
   **users > your Firebase UID > settings > ootss**.
5. Refresh the app, or sign in with the same account on another device, and
   verify the saved state loads.
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
| Firebase setup is still pending | Add all six secrets to **natoverse/ootss**, rerun Actions, and refresh. |
| Sign-in reports an unauthorized domain | Add `natoverse.github.io` to this project's Authentication authorized domains. |
| Sign-in popup is blocked or closed | Allow the popup for the app and retry sign-in. |
| Sign-in reports that the operation is not allowed | Enable the Google provider in Authentication. |
| Authentication API rejects the key | Check that all six configuration values come from the same OOTSS web app. |
| Firestore returns permission denied | Publish this repository's rules in the OOTSS project and sign in again. |
| Firestore database is not found | Create the Standard **`(default)`** database, not a named database. |
| An error names `SERVICE_DISABLED` | Enable the named API in the OOTSS Google Cloud project and allow time for activation. |
| Cloud settings cannot load | Retry after checking the database/rules; sign out only if you want to return to the separate guest save. |
| Status stays offline or saving | Reconnect and wait for acknowledgment before signing out; export a JSON backup if needed. |

Official references: [Google sign-in](https://firebase.google.com/docs/auth/web/google-signin),
[Firestore rules](https://firebase.google.com/docs/firestore/security/rules-conditions),
and [offline caching](https://firebase.google.com/docs/firestore/manage-data/enable-offline).
