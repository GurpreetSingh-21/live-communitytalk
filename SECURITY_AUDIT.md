# 🔐 CommunityTalk / Campustry — Security Audit Report
**Auditor:** AI AppSec Review
**Date:** 2026-06-15
**Scope:** Full backend codebase (`backend/`), deployment configuration, git history
**Stack:** Node.js / Express, Prisma / PostgreSQL, Redis, Socket.IO, ImageKit, Cloudinary, Firebase Admin

---

## Executive Summary

The application has solid foundational security in several areas: JWT algorithm is pinned to HS256, bcrypt is used for password hashing, DOMPurify is applied to Socket messages, email enumeration is mitigated on registration, and rate limiting exists globally. However, **3 Critical and 7 High severity issues** were found that require immediate attention before public launch. The most severe is a **Firebase private key committed to git** and tracked in remote history — this key must be revoked NOW regardless of any other fix.

---

## CRITICAL Issues

---

### CRIT-1 — Firebase Service Account Private Key Committed to Git & Tracked in Remote History

**Severity:** CRITICAL
**File:** `backend/serviceAccountKey.json`
**Code location:** Entire file (14 lines), also in git object `4c9cd71` (commit "push notification added")

**Problem:**
The Firebase Admin SDK private key is committed inside `serviceAccountKey.json`, which `git ls-files` confirms **is tracked in the repository index**, and was first committed in git object history. The `.gitignore` entry `serviceAccountKey.json` was added *after* the file was already committed — gitignore does not retroactively untrack a file.

**Why this is dangerous:**
A Firebase service account with Admin SDK credentials can:
- Send push notifications to *all* users (phishing, harassment)
- Read and write Firestore / Realtime Database if enabled
- Mint custom Firebase auth tokens, impersonating any user
- Access Firebase Storage buckets

**How someone could abuse it:**
Anyone with read access to the GitHub repo (public or leaked) can extract the private key and authenticate as your service account to perform all of the above.

**Safe way to test locally:**
```bash
git ls-files backend/serviceAccountKey.json   # Returns the file = it is tracked
git log --all -- backend/serviceAccountKey.json  # Shows every commit that touched it
```

**Exact fix (two-part):**

Step 1 — Revoke the key NOW (do this first, before any code change):
1. Go to Google Cloud Console → IAM → Service Accounts
2. Find `firebase-adminsdk-fbsvc@community-talk-9f8cd.iam.gserviceaccount.com`
3. Click Keys → Delete the key with ID `e992711f48c0bfd2467c732e0131fad2b6583938`
4. Create a new key and save it only to an environment variable — never to a file in the repo.

Step 2 — Remove the file from all git history:
```bash
git rm --cached backend/serviceAccountKey.json
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch backend/serviceAccountKey.json" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all
```

**Improved code — use env var instead of file:**
```javascript
// backend/firebase.js  (AFTER revoking old key and creating new one)
const admin = require("firebase-admin");

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
};

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
module.exports = admin;
```

Add to `.env`:
```
FIREBASE_PROJECT_ID=community-talk-9f8cd
FIREBASE_PRIVATE_KEY_ID=<new_key_id>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@community-talk-9f8cd.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=<new_client_id>
```

**Prevention rule:** Add a pre-commit hook with `gitleaks` or `trufflehog` to scan for secrets before every commit.

---

### CRIT-2 — FCM Token Save Endpoint is Completely Unauthenticated

**Severity:** CRITICAL
**File:** `backend/routes/tokenRoutes.js` lines 8–38
**Code location:** `router.post("/save-token", async (req, res) => {`
**Mounted at:** `server.js` line 183 → `app.use("/api", require("./routes/tokenRoutes"))`

**Problem:**
The `/api/save-token` endpoint stores a push notification token into any `Member` record by accepting `memberId` directly from the request body with zero authentication. Any attacker who knows or guesses a `memberId` UUID can overwrite that member's push token with their own device token.

```javascript
router.post("/save-token", async (req, res) => {
  const { memberId, fcmToken } = req.body;   // no auth, no ownership check
  await prisma.member.update({
    where: { id: memberId },
    data: { fcmToken }
  });
```

**Why this is dangerous:**
An attacker who hijacks a victim's push token receives every push notification sent to that member — including community message previews, DM notifications, and new-match alerts.

**How someone could abuse it:**
```bash
curl -X POST https://yourapi.com/api/save-token \
  -H "Content-Type: application/json" \
  -d '{"memberId":"<victim_member_uuid>","fcmToken":"ExponentPushToken[attacker_token]"}'
```

**Safe way to test locally:**
```bash
curl -X POST http://localhost:3000/api/save-token \
  -H "Content-Type: application/json" \
  -d '{"memberId":"any-uuid","fcmToken":"test"}'
# Should return 401 — but currently returns 200
```

**Exact fix:**
```javascript
// backend/routes/tokenRoutes.js
const authenticate = require("../middleware/authenticate");

router.post("/save-token", authenticate, async (req, res) => {
  try {
    const { fcmToken } = req.body;     // remove memberId from body
    const userId = req.user.id;        // derive from JWT

    if (!fcmToken) {
      return res.status(400).json({ error: "fcmToken is required" });
    }

    // Only allow user to update their own member records
    await prisma.member.updateMany({
      where: { userId: userId },
      data: { fcmToken }
    });

    res.json({ success: true, message: "FCM token saved" });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    res.status(500).json({ error: "Server error while saving token" });
  }
});
```

**Prevention rule:** Every endpoint that writes to the database must be behind `authenticate`. Only `/health`, `/api/public/*`, and a narrow set of auth endpoints should be public.

---

### CRIT-3 — `/api/upload/base64` Has No File Type Validation and Uses `resource_type: "auto"`

**Severity:** CRITICAL
**File:** `backend/routes/upload.js` lines 123–178
**Code location:** `router.post('/base64', async (req, res) => {`

**Problem:**
The base64 upload endpoint has no MIME type validation and uses `resource_type: "auto"` in Cloudinary:

```javascript
const uploadResponse = await cloudinary.uploader.upload(fileStr, {
  resource_type: "auto",  // accepts video, audio, PDF, HTML — anything
  public_id: `${Date.now()}-${path.parse(fileName || 'upload').name}`,
});
```

There is no file type check unlike the multipart endpoint.

**Why this is dangerous:**
- `resource_type: "auto"` allows uploading HTML files that Cloudinary serves publicly — enabling stored XSS
- No filename sanitization — `path.parse(fileName)` on attacker-controlled input
- 50MB JSON bodies are parsed before auth check runs (memory DoS risk)

**Exact fix:**
```javascript
router.post('/base64', async (req, res) => {
  try {
    const { image, fileName, folder } = req.body;
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorized" });
    if (!image) return res.status(400).json({ error: "No image data provided" });

    // Validate: only allow image types from data URI
    const dataUriMatch = image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
    if (!dataUriMatch) {
      return res.status(400).json({ error: "Only base64-encoded images are allowed" });
    }
    const mimeType = dataUriMatch[1];
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedMimes.includes(mimeType)) {
      return res.status(400).json({ error: "Invalid image type" });
    }

    // Sanitize fileName
    const safeName = (fileName || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
    const contextParam = req.query.context === 'dating' ? 'dating' : 'chat';
    const defaultFolder = `community_talk_${contextParam}_uploads`;

    const uploadResponse = await cloudinary.uploader.upload(image, {
      folder: folder || defaultFolder,
      resource_type: "image",   // Explicit — never 'auto'
      public_id: `${Date.now()}-${path.parse(safeName).name}`,
    });

    if (!uploadResponse?.secure_url) throw new Error("Failed to get URL from Cloudinary");

    return res.json({ url: uploadResponse.secure_url, type: "photo", name: safeName, fileId: uploadResponse.public_id });
  } catch (error) {
    console.error("Base64 Upload Error:", error.message);
    return res.status(500).json({ error: "Upload failed" });
  }
});
```

**Prevention rule:** Never use `resource_type: "auto"`. Validate MIME type server-side from a whitelist. Add a secondary explicit auth guard inside every route handler as defence-in-depth.

---

## HIGH Severity Issues

---

### HIGH-1 — Password Reset Does NOT Invalidate Existing Sessions

**Severity:** High
**File:** `backend/routes/loginNregRoutes.js` lines 697–713

**Problem:**
When a user resets their password, `tokenVersion` is not incremented. Any attacker with a stolen JWT continues using it for up to 24h after the victim resets their password.

```javascript
await prisma.user.update({
  where: { id: user.id },
  data: {
    password: hash,
    verificationCode: null,
    verificationCodeExpires: null,
    verificationCodeAttempts: 0,
    // tokenVersion NOT incremented — existing tokens remain valid
  }
});
```

**Exact fix:**
```javascript
data: {
  password: hash,
  verificationCode: null,
  verificationCodeExpires: null,
  verificationCodeAttempts: 0,
  tokenVersion: { increment: 1 },  // Invalidates all existing sessions
}
```

**Prevention rule:** Every security-sensitive account event (password reset, email change, 2FA toggle, ban) must increment `tokenVersion`.

---

### HIGH-2 — Admin Login Route Has No Dedicated Rate Limiter

**Severity:** High
**File:** `backend/routes/adminRoutes.js` lines 35–92

**Problem:**
The global limiter allows 50 req/min. Against an admin login endpoint, that is 72,000 password attempts per day per IP — undetected. Additionally, the route logs the email address and password match result in plaintext.

```javascript
console.log('[DEBUG] Admin login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
console.log('[DEBUG] Password match result:', isMatch);
```

**Exact fix:**
```javascript
const rateLimit = require('express-rate-limit');

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many login attempts. Try again in 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', adminLoginLimiter, async (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DEBUG] Admin login attempt');
  }
  // Remove the password match log entirely
  // ...
});
```

**Prevention rule:** Auth endpoints must each have their own strict rate limiter (5–10 req per 15 min window), separate from the global limiter.

---

### HIGH-3 — Rate Limiter Trust-Proxy Validation Deliberately Disabled

**Severity:** High
**File:** `backend/middleware/rateLimiter.js` lines 10–13

**Problem:**
```javascript
validate: {
  trustProxy: false,        // validation disabled
  xForwardedForHeader: false,
}
```
With validation disabled, `express-rate-limit` cannot verify the trust proxy settings are coherent. If a proxy chain changes or the `X-Forwarded-For` header is spoofed, an attacker can appear as a new IP on every request, bypassing rate limiting entirely.

**Exact fix:**
```javascript
// Remove the validate override entirely
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 50 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
  keyGenerator: (req) => req.ip || req.connection.remoteAddress,
});
```

**Prevention rule:** Never disable security validation flags to fix development inconvenience. Use environment-specific configurations instead.

---

### HIGH-4 — Socket.IO `community:join` Allows Joining Any Community Room Without Membership Check

**Severity:** High
**File:** `backend/server.js` lines 277–313

**Problem:**
```javascript
socket.on("community:join", async (cid) => {
  const roomName = communityRoom(cid);
  socket.join(roomName);   // Joins room without membership check
  socket.user.communityIds.push(cid);  // Also added to in-memory state
  await presence.joinCommunity(uid, cid);
});
```

Any authenticated user can subscribe to any community's real-time feed — including private communities they haven't been accepted into — and receive all messages in real time.

**Exact fix:**
```javascript
socket.on("community:join", async (cid) => {
  try {
    const membership = await prisma.member.findUnique({
      where: { userId_communityId: { userId: uid, communityId: cid } }
    });

    if (!membership || !["active", "owner"].includes(membership.memberStatus)) {
      socket.emit("error", { message: "Not a member of this community" });
      return;
    }

    const roomName = communityRoom(cid);
    socket.join(roomName);
    if (!socket.user.communityIds.includes(cid)) socket.user.communityIds.push(cid);
    await presence.joinCommunity(uid, cid);
  } catch (err) {
    console.error("community:join error:", err);
  }
});
```

Apply the same DB check to `subscribe:communities`.

**Prevention rule:** Treat socket events with the same authorization rigor as REST endpoints.

---

### HIGH-5 — Verbose Debug Logs in Production Auth Flow

**Severity:** High
**File:** `backend/middleware/authenticate.js` lines 93, 104, 122
**File:** `backend/routes/adminRoutes.js` lines 36, 58

**Problem:**
```javascript
console.log('[DEBUG] authenticate: No token provided');
console.log('[DEBUG] authenticate: Token verification failed:', err.name, err.message);
console.log('[DEBUG] Admin login attempt:', { email: req.body.email, hasPassword: !!req.body.password });
console.log('[DEBUG] Password match result:', isMatch);
```

These logs go to Render/CloudWatch in production. They expose JWT error classification (helps craft tokens), admin email addresses, and boolean `isMatch` results (confirms account existence).

**Exact fix:**
```javascript
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) console.log('[DEBUG] authenticate: No token provided');
// Remove isMatch log entirely — never log credential comparison results
```

**Prevention rule:** Adopt a structured logger (e.g., `pino`) with log levels. Debug logs should only emit at `debug` level, suppressed in production.

---

### HIGH-6 — File Upload MIME Type Validation is Client-Controllable

**Severity:** High
**File:** `backend/routes/upload.js` lines 48–65

**Problem:**
`file.mimetype` comes from the `Content-Type` part of the multipart request, which the client controls. An attacker uploads a PHP/HTML file with `Content-Type: image/jpeg` and it passes validation. Cloudinary stores and serves it under your CDN.

**Exact fix:**
```javascript
// npm install file-type
// Use magic bytes in addition to MIME check — validate actual file header
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'application/pdf',
    'audio/mpeg', 'audio/wav',
  ];
  // Explicitly reject dangerous types
  const blockedMimes = ['image/svg+xml', 'text/html', 'application/javascript'];
  if (blockedMimes.includes(file.mimetype)) {
    return cb(new Error('File type not allowed'), false);
  }
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'), false);
  }
  cb(null, true);
};
```

**Prevention rule:** Always validate file type using magic bytes (file header inspection), not just MIME type from headers. Use the `file-type` npm package. Explicitly reject `image/svg+xml`.

---

### HIGH-7 — Role Change Does Not Invalidate Existing Sessions

**Severity:** High
**File:** `backend/routes/adminRoutes.js` (any route that updates user role)

**Problem:**
When a user's role is changed from `admin` to `user`, `tokenVersion` is not incremented. The demoted admin retains full admin access until their token expires (up to 24h).

**Exact fix:**
```javascript
// Wherever user role is updated in adminRoutes.js:
await prisma.user.update({
  where: { id: userId },
  data: {
    role: newRole,
    tokenVersion: { increment: 1 },  // Force re-login on role change
  }
});
```

**Prevention rule:** Any change to role, ban status, or 2FA MUST increment `tokenVersion`.

---

## MEDIUM Severity Issues

---

### MED-1 — Helmet CSP Not Tuned; CORP Disabled

**Severity:** Medium
**File:** `backend/server.js` lines 117–122

**Problem:**
```javascript
app.use(helmet({
  crossOriginResourcePolicy: false,  // CORP disabled
  contentSecurityPolicy: true,       // Default policy only — not hardened
}));
```

**Exact fix:**
```javascript
app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://ik.imagekit.io", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "wss:", "https://api.imagekit.io"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
```

---

### MED-2 — Reset Code Not Consumed After `verify-reset-code`

**Severity:** Medium
**File:** `backend/routes/loginNregRoutes.js` lines 628–662

**Problem:**
`POST /verify-reset-code` confirms the code is valid but does not nullify it. The code remains usable until `reset-password` is called, creating a window where an intercepted code can be independently replayed.

**Exact fix:**
After a successful code verification, immediately nullify the code and issue a short-lived signed token instead:
```javascript
// In verify-reset-code, after confirming the code:
await prisma.user.update({
  where: { id: user.id },
  data: { verificationCode: null, verificationCodeExpires: null }
});

const resetToken = jwt.sign(
  { id: user.id, action: "password_reset" },
  JWT_SECRET,
  { expiresIn: "5m" }
);
return res.status(200).json({ message: "Code verified.", resetToken });
```

---

### MED-3 — `verify-reset-code` and `reset-password` Leak User Existence

**Severity:** Medium
**File:** `backend/routes/loginNregRoutes.js` lines 638–639, 678–679

**Problem:**
```javascript
if (!user) return res.status(404).json({ error: "User not found." });
```

Unlike `/forgot-password` (which correctly returns a generic success), these routes explicitly confirm whether an email is registered.

**Exact fix:**
```javascript
if (!user || !user.verificationCode || user.verificationCode !== code) {
  return res.status(400).json({ error: "Invalid or expired verification code." });
}
```

---

### MED-4 — Emoji Reactions Accept Arbitrary-Length Strings

**Severity:** Medium
**File:** `backend/routes/messageRoutes.js` lines 491–492

**Problem:**
No length limit or format validation on emoji reactions allows storing a 10,000-character string that gets broadcast to all community members.

**Exact fix:**
```javascript
if (!emoji || typeof emoji !== "string") {
  return res.status(400).json({ error: "emoji is required" });
}
if (emoji.length > 8 || !/^\p{Emoji}/u.test(emoji)) {
  return res.status(400).json({ error: "Invalid emoji format" });
}
```

---

### MED-5 — Community List Endpoint Has No Hard Limit When Not Paginated

**Severity:** Medium
**File:** `backend/routes/communityRoutes.js` lines 363–369

**Problem:**
When `paginated` query param is absent, `findMany` has no `take` limit — returns all rows.

**Exact fix:**
```javascript
const items = await prisma.community.findMany({
  where,
  select,
  orderBy: { createdAt: 'desc' },
  take: 200,  // Hard cap
});
```

---

### MED-6 — Admin Login Skips `accountStatus` and `emailVerified` Checks

**Severity:** Medium
**File:** `backend/routes/adminRoutes.js` lines 45–61

**Problem:**
The admin login checks role but not whether the account is banned or deleted.

**Exact fix:**
```javascript
if (user.accountStatus === 'BANNED' || user.isActive === false || user.isPermanentlyDeleted) {
  return res.status(403).json({ error: 'Access denied.' });
}
```

---

## LOW Severity Issues

---

### LOW-1 — 24h JWT Expiry With No Refresh Token Mechanism

**Severity:** Low
**File:** `backend/routes/loginNregRoutes.js` line 28

Tokens expire in `"1d"`. Users banned or role-changed mid-session remain active for up to 24h (partially mitigated by `tokenVersion`). Recommendation: implement 15-min access token + 7-day refresh token in HttpOnly cookie.

---

### LOW-2 — Morgan Logs Full Request URLs in All Environments

**Severity:** Low
**File:** `backend/server.js` line 142

```javascript
app.use(morgan("dev"));  // logs full URLs including query strings
```

**Fix:** `app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));`

---

### LOW-3 — `speakeasy` Package Is Unmaintained (Last Updated 2017)

**Severity:** Low
**File:** `backend/package.json` line 46

Recommendation: Migrate to `otpauth` (actively maintained, TypeScript support).

---

### LOW-4 — Dead Code: `auth.js` (Passport + Mongoose) Is Unused

**Severity:** Low
**File:** `backend/auth.js`

`auth.js` configures a Passport LocalStrategy with the legacy `Person` Mongoose model, but the active login routes use Prisma directly. Remove `passport`, `passport-local`, and `auth.js`.

---

### LOW-5 — `RateLimiter.js` In-Memory Singleton Ineffective in Multi-Instance Deployment

**Severity:** Low
**File:** `backend/services/RateLimiter.js`

In-memory rate limiting resets on every server restart and doesn't work across Render instances. Audit all usages and replace with Redis-backed counters.

---

### LOW-6 — Debug Artifacts Committed to Repository

**Severity:** Low
**Files:** `backend/debug_post_payload.json`, `backend/load-test-results.json`

Load test results reveal capacity thresholds that help calibrate DoS attacks. Debug payloads should not be in production code.

**Fix:** Add to `.gitignore`:
```
debug_*.json
*load-test-results*
```

---

## Summary Table

| ID | Severity | File | Issue |
|----|----------|------|-------|
| CRIT-1 | Critical | `serviceAccountKey.json` | Firebase private key in git + pushed to GitHub |
| CRIT-2 | Critical | `routes/tokenRoutes.js` | FCM token save has no authentication |
| CRIT-3 | Critical | `routes/upload.js` | Base64 upload: no type validation, uses resource_type auto |
| HIGH-1 | High | `routes/loginNregRoutes.js` | Password reset doesn't invalidate JWT sessions |
| HIGH-2 | High | `routes/adminRoutes.js` | Admin login has no dedicated rate limiter |
| HIGH-3 | High | `middleware/rateLimiter.js` | Rate limiter trust-proxy validation disabled |
| HIGH-4 | High | `server.js` | Socket community:join joins rooms without DB membership check |
| HIGH-5 | High | `middleware/authenticate.js` | Debug logs in production expose auth internals |
| HIGH-6 | High | `routes/upload.js` | MIME validation is client-controllable |
| HIGH-7 | High | `routes/adminRoutes.js` | Role change doesn't invalidate sessions |
| MED-1 | Medium | `server.js` | Helmet CSP not tuned, CORP disabled |
| MED-2 | Medium | `routes/loginNregRoutes.js` | Reset code not consumed after verify-reset-code |
| MED-3 | Medium | `routes/loginNregRoutes.js` | verify-reset-code leaks user existence via 404 |
| MED-4 | Medium | `routes/messageRoutes.js` | Emoji reactions accept arbitrary-length strings |
| MED-5 | Medium | `routes/communityRoutes.js` | Unbounded community list query |
| MED-6 | Medium | `routes/adminRoutes.js` | Admin login skips accountStatus checks |
| LOW-1 | Low | `routes/loginNregRoutes.js` | No refresh token — 24h window for stolen tokens |
| LOW-2 | Low | `server.js` | Morgan logs full URLs in all environments |
| LOW-3 | Low | `package.json` | speakeasy is unmaintained |
| LOW-4 | Low | `auth.js` | Dead code adds attack surface |
| LOW-5 | Low | `services/RateLimiter.js` | In-memory rate limiter ineffective in multi-instance |
| LOW-6 | Low | `debug_post_payload.json` | Debug artifacts in repo |
| LOW-7 | Low | `load-test-results.json` | Load test results expose capacity data |

---

## What Is Already Done Well

- JWT algorithm pinned to HS256 — prevents algorithm confusion attacks
- bcrypt used for all password hashing (cost factor 10)
- bcrypt used for 2FA backup codes
- DOMPurify applied to Socket message content before DB write
- Email enumeration mitigation on registration
- tokenVersion system exists and is checked in authenticate.js
- IP-spoofing mitigation — trust proxy set to private subnet range
- File size limit reduced from 50MB global to 1MB
- 18+ age validation done server-side in dating profile creation
- Photo domain allowlist in dating (res.cloudinary.com, ik.imagekit.io only)
- Self-report/self-block prevention in dating routes
- Cryptographic shuffle (Fisher-Yates with crypto.randomInt) for dating pool
- GDPR profile deletion with cascade delete
- TOS consent required before pool/swipe access
- Debug socket endpoint removed
- Email masking in log output

---

## Recommended Patch Plan

### Immediate (Today — Before Any More Commits)
1. [CRIT-1] Revoke the Firebase service account key at Google Cloud Console
2. [CRIT-1] Rewrite git history to remove serviceAccountKey.json
3. [CRIT-1] Regenerate key and move to environment variables

### This Week (Before Launch)
4. [CRIT-2] Add authenticate middleware to POST /api/save-token
5. [CRIT-3] Add file type validation to base64 upload, change resource_type to "image"
6. [HIGH-1] Increment tokenVersion in password reset
7. [HIGH-2] Add 5-per-15min rate limiter to POST /api/admin/login
8. [HIGH-4] Add DB membership check to community:join socket handler
9. [HIGH-5] Gate all [DEBUG] logs behind NODE_ENV !== 'production'
10. [HIGH-7] Increment tokenVersion on role changes

### Next Sprint
11. [HIGH-3] Remove validate trustProxy override from rateLimiter
12. [HIGH-6] Add file-type magic byte validation to uploads
13. [MED-1] Configure Helmet CSP with domain allowlist
14. [MED-2] Consume reset code after verify-reset-code
15. [MED-3] Return generic error in verify-reset-code / reset-password
16. [MED-4] Validate emoji format and length
17. [MED-6] Add accountStatus check to admin login

### Housekeeping
18. [LOW-4] Remove dead auth.js + passport dependencies
19. [LOW-6/7] Add debug_*.json and load-test-results.json to .gitignore
20. Install gitleaks or trufflehog as a pre-commit hook

---

## Final Secure Checklist

```
AUTHENTICATION
[ ] Firebase key revoked and removed from git history
[ ] All auth endpoints have dedicated rate limiters (5/15min)
[ ] Password reset increments tokenVersion
[ ] Role change increments tokenVersion
[ ] Admin login checks accountStatus

AUTHORIZATION
[ ] FCM token endpoint requires authentication
[ ] Socket community:join validates DB membership
[ ] All non-public routes are behind authenticate middleware

UPLOADS
[ ] base64 upload validates MIME type from allowlist
[ ] base64 upload uses resource_type: "image" (never "auto")
[ ] multipart upload adds magic byte check (file-type package)
[ ] SVG files rejected explicitly

JWT / SESSION
[ ] tokenVersion incremented on: password reset, role change, ban, 2FA disable
[ ] Token expiry <= 15min with refresh token pattern (future)

CORS / HEADERS
[ ] Helmet CSP configured with specific domain allowlists
[ ] CORP re-enabled (crossOriginResourcePolicy: same-site)
[ ] HSTS enabled with preload

LOGGING
[ ] No [DEBUG] logs in production (NODE_ENV guard)
[ ] No full email addresses in logs
[ ] No JWT error classification in prod logs

SECRETS
[ ] .env files in .gitignore (done)
[ ] serviceAccountKey.json removed from git history
[ ] Pre-commit hook (gitleaks) installed
[ ] No secrets in any committed .js or .json file

DEPENDENCIES
[ ] speakeasy replaced with maintained alternative
[ ] passport/passport-local removed if unused
[ ] npm audit run — no critical/high CVEs outstanding

INFRASTRUCTURE
[ ] Rate limiter uses Redis across all instances (done for swipes)
[ ] Debug/load-test artifacts removed from repo
```

---

*Audit performed: 2026-06-15 | Next review recommended: 90 days or after any major feature addition*
