# Security

## Google Workspace OAuth

Naravi uses Firebase Authentication for app sign-in and a separate server-side Google OAuth 2.0 authorization-code flow for Workspace access. Firebase Google sign-in requests only `openid`, `email`, and `profile`; it does not start Workspace OAuth.

The Google callback is always derived from `APP_URL`:

```text
${APP_URL}/api/oauth/google/callback
```

Workspace authorization accepts only allowlisted integration keys from the browser: `tasks`, `calendar`, and `drive_docs`. The server maps those keys to Google Tasks, Calendar, `drive.file`, and Documents scopes, signs the requested integrations and scopes into OAuth state, and never accepts raw scopes from clients. The authorization URL requests offline access, PKCE, and `include_granted_scopes`; consent is requested only when there is no existing usable refresh token.

## Refresh Token Vault

Google refresh tokens are never returned to the browser. The server encrypts refresh tokens with Cloud KMS using `KMS_KEY_NAME` and stores only ciphertext plus safe metadata in Firestore database `FIRESTORE_DATABASE_ID`, keyed by Firebase `uid`.

Vault metadata may include Google subject, email, display name, picture URL, granted scopes, timestamps, KMS key name, and token expiry metadata. Plaintext refresh tokens and Google access tokens must not be logged.

## Runtime Requirements

Required production environment variables:

```text
APP_URL
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
OAUTH_STATE_SECRET
KMS_KEY_NAME
FIRESTORE_DATABASE_ID
GEMINI_API_KEY
```

The runtime service account needs:

```text
firebaseauth.users.get
datastore.entities.*
cloudkms.cryptoKeyVersions.useToEncrypt
cloudkms.cryptoKeyVersions.useToDecrypt
```

Use the narrowest IAM roles that provide those permissions for the target Firebase project, Firestore database, and KMS key.

## Disconnect

`DELETE /api/oauth/google/disconnect` verifies the Firebase ID token, attempts to revoke the stored Google refresh token, and deletes the local vault record. If Google revocation fails because the remote grant is already invalid, the local vault record is still removed.
