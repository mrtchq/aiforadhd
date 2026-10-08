# Security Specification & Test Matrix

## 1. Data Invariants
1. A user profile document `/users/{userId}` can only be read, created, updated, or deleted by the authenticated user matching `{userId}`.
2. User profile writes require verified email (`email_verified == true`).
3. User profile cannot spoof `userId` — `incoming().userId` must equal `request.auth.uid`.
4. Creation timestamp `createdAt` is immutable and must equal server timestamp `request.time`.
5. Updates can only modify non-immutable fields (`displayName`, `photoURL`, `role`, `lastLoginAt`).
6. Waitlist submissions cannot be modified or deleted once created, preventing tampering.
7. Unauthenticated users cannot read user profiles or private waitlist documents.
8. Document IDs must conform to regex `^[a-zA-Z0-9_\-]+$` and length `<= 128`.

## 2. The Dirty Dozen Payloads (Negative Test Payloads)
1. **Ghost Field Injection**: User attempts to save `{ isSuperAdmin: true }` in `/users/{userId}`. (Blocked by `hasOnly`).
2. **Identity Spoofing**: User A attempts to write document `/users/{userB_id}` with `userB` data. (Blocked by `isOwner(userId)`).
3. **Internal UID Spoofing**: User A writes to `/users/{userA_id}` but sets `userId: "userB"`. (Blocked by `data.userId == request.auth.uid`).
4. **CreatedAt Forgery**: Client sends client-generated timestamp instead of `request.time`. (Blocked by temporal integrity rule).
5. **CreatedAt Mutation**: Client attempts an update mutating `createdAt`. (Blocked by `incoming().createdAt == existing().createdAt`).
6. **Unverified Email Write**: User with unverified email attempts write. (Blocked by `isVerified()`).
7. **PII Scraping via List**: Attempting `collection('users').get()` query. (Blocked by `allow list: if false`).
8. **Document ID Path Poisoning**: Attempting write to `/users/../../etc/passwd` or oversized ID. (Blocked by `isValidId()`).
9. **Oversized String Payload Attack (Denial of Wallet)**: Client sends 1MB string in `displayName`. (Blocked by `displayName.size() <= 100`).
10. **Waitlist Tampering (Update Attack)**: Client attempts to update an existing waitlist doc. (Blocked by `allow update: if false`).
11. **Waitlist Deletion Attack**: Client attempts to delete another user's waitlist submission. (Blocked by `allow delete: if false`).
12. **Waitlist Identity Spoofing**: Signed-in user attempts to insert someone else's `userId` into a waitlist doc. (Blocked by `incoming().userId == request.auth.uid`).
