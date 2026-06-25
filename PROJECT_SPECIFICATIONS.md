# Project Specifications — Campustry

## 1. Executive Summary

**Campustry** is a hyper-local, real-time social networking platform built exclusively for college and university students. The platform anchors user identities to verified institutional email domains to create exclusive, trust-bounded campus communities. It provides three core experiences: community-based group discussions, private encrypted messaging, and a swipe-based campus dating feature — all within a single, cohesive application.

The product is delivered as a **cross-platform mobile application** (iOS & Android) with a supporting **web frontend** (marketing site + admin dashboard) and a **centralized backend API** powering both clients.

---

## 2. System Architecture

### 2.1 High-Level Overview

The project follows a **monorepo** structure with three independently deployable modules that share a single Git history:

| Module | Role | Port |
|---|---|---|
| `backend/` | REST API + WebSocket server | `:3000` |
| `frontend/` | Next.js web application | `:3001` |
| `CommunityTalkMobile/` | React Native / Expo mobile app | Expo Dev Server |

All three modules communicate through a centralized REST API and a persistent WebSocket connection (Socket.io). The backend serves as the single source of truth for data, authentication, and real-time event distribution.

### 2.2 Technology Stack

#### Backend
| Concern | Technology | Purpose |
|---|---|---|
| Runtime | Node.js + Express.js | HTTP API server and WebSocket host |
| Database | PostgreSQL | Primary persistent data store |
| ORM | Prisma | Type-safe database access, migrations, and schema management |
| Caching & Pub/Sub | Redis (ioredis) | Response caching, session data, presence tracking, Socket.io scaling |
| Real-Time | Socket.io + Redis Adapter | Bidirectional WebSocket communication, horizontally scalable |
| Auth | JWT (HS256), Bcrypt, Passport.js | Stateless authentication with hashed passwords |
| 2FA | Speakeasy | TOTP-based two-factor authentication with backup codes |
| Email | Resend | Transactional emails (verification, password reset, device alerts) |
| Push Notifications | Expo Server SDK | Mobile push notifications via Expo's infrastructure |
| Media Storage | Cloudinary, ImageKit | Image upload, optimization, and CDN delivery |
| Security | Helmet.js, DOMPurify, express-rate-limit | CSP headers, XSS sanitization, rate limiting |
| Load Balancing | http-proxy-middleware | Custom round-robin proxy with WebSocket upgrade support |
| Testing | Jest, Supertest | Unit and integration testing |

#### Web Frontend
| Concern | Technology |
|---|---|
| Framework | Next.js (App Router, React 19) |
| Styling | Tailwind CSS v4 |
| UI Components | Radix UI Primitives, shadcn/ui (class-variance-authority) |
| Animations | Framer Motion, GSAP, Lenis (smooth scroll) |
| HTTP Client | Axios |
| Theming | next-themes |
| Notifications | Sonner (toast) |

#### Mobile Application
| Concern | Technology |
|---|---|
| Framework | React Native 0.81, Expo SDK 54 |
| Routing | Expo Router (file-based), React Navigation |
| Styling | NativeWind (Tailwind CSS for RN) |
| State Management | React Context API (AuthContext, SocketContext) |
| List Performance | Shopify FlashList |
| Animations | React Native Reanimated, Moti |
| Cryptography | TweetNaCl, tweetnacl-util (E2EE) |
| Secure Storage | Expo SecureStore |
| Media | expo-image, expo-image-picker, expo-av |
| Haptics | expo-haptics |
| Location | expo-location |
| Notifications | expo-notifications |

---

## 3. Feature Specifications

### 3.1 Authentication & User Management

#### Registration
- Users register with **full name**, **email**, **password**, **college selection**, and **religion/faith community selection**.
- College selection is powered by a curated `colleges` table mapping institutional names to verified email domains.
- Upon registration, the user receives a **6-digit verification code** via email (Resend). The code expires in 1 hour.
- Passwords are hashed with **Bcrypt** (10 salt rounds) before storage.
- On successful verification, the user is automatically enrolled as a member of both their college community and their selected religion community.

#### Login
- Authenticated via email + password. Returns a signed JWT (HS256, 1-day expiry).
- If 2FA is enabled, the user must provide a valid TOTP code after password verification.
- New device detection triggers an email alert to the account holder.

#### Password Recovery
- A "Forgot Password" flow sends a time-limited verification code to the user's email.
- After code verification, the user sets a new password.

#### Two-Factor Authentication (2FA)
- Users can enable TOTP-based 2FA from their security settings.
- The system generates a secret and backup codes. The user scans a QR code with an authenticator app.
- Backup codes allow recovery if the authenticator device is lost.

#### Profile Management
- Users can update their avatar (uploaded to ImageKit, synced across all community memberships and caches), edit their bio, and manage preferences.
- Profile screen displays stats: communities joined, messages sent, and connections made.
- Settings include: Account, Notifications, Privacy & Security, Dark Mode toggle, Rate the App (native store review), Help & Support.

### 3.2 Campus Communities

#### Verified College Hubs
- Each college in the system is linked to a default community. When a user registers under a specific college, they are automatically enrolled as a member.
- College communities serve as the primary social anchor for students.

#### Religion/Faith Communities
- A second auto-enrolled community based on the user's selected religion/faith during registration.

#### Custom Communities
- Any authenticated user can create new communities with a name, description, tags, and privacy setting (public or private).
- Public communities are discoverable via the Explore tab. Private communities require an invitation or direct link.

#### Community Discovery
- The Explore section supports:
  - Full-text search across community names, descriptions, slugs, and keys.
  - Filtering by community type, tags, and college affiliation.
  - Pagination and sorting (by name or creation date).

#### Membership & Roles
- Members are tracked via a junction table (`members`) with roles: `member`, `moderator`, `admin`.
- Members can be suspended (`memberStatus: suspended`) or banned, removing their access to community features.

### 3.3 Real-Time Messaging Engine

#### Community Messages
- Messages are sent via Socket.io (`message:send` event), sanitized with DOMPurify, validated for membership, and persisted to PostgreSQL.
- Each message includes: content, sender info, community ID, optional reply-to reference, optional attachments (JSON), and status tracking (sent → delivered → read).
- Messages are broadcast to all connected members of the community room in real time.
- The sender receives a `message:ack` event confirming the server-side ID for optimistic UI reconciliation.

#### Direct Messages
- Private 1-on-1 conversations between any two users.
- Support for text, attachments (images via Cloudinary), delivery/read receipts, editing, and soft deletion.
- **End-to-End Encrypted** using TweetNaCl (Curve25519 key exchange, XSalsa20-Poly1305 encryption). Keys are generated and stored locally in Expo SecureStore.

#### Reactions
- Users can add emoji reactions to both community messages and direct messages.
- Reactions are persisted and associated with both the message and the reacting user.

#### Typing Indicators
- Real-time typing status is emitted for both community channels (`community:typing`) and DMs (`dm:typing`).
- Typing events include the user's ID and display name for UI rendering.

#### Presence System
- A Redis-backed presence module tracks user online/offline status per-community.
- Uses reference counting (socket count per user) to handle multiple device connections.
- On server startup, all stale presence data is cleared to prevent ghost-online users.
- Presence updates are emitted per-community room so member lists reflect real-time activity.

### 3.4 Campus Dating

#### Profile Creation (Onboarding Wizard)
- A guided, multi-step onboarding flow collects: first name, gender, birth date, bio, height, major, year of study, graduation year, Greek life affiliation, hobbies, interests, Spotify top artists, Instagram handle, custom prompts, and photos.
- **Server-side age validation** ensures all users are 18 or older.
- Photos are validated for allowed CDN domains (Cloudinary, ImageKit) before storage.

#### Dating Preferences
- Users configure matching preferences: age range (min/max), maximum distance, interested-in gender(s), preferred colleges, and campus-only visibility toggle.

#### Swiping & Matching
- A card-swiping interface presents potential matches filtered by the backend scoring and preference engine.
- Like and pass actions are recorded. A mutual like creates a match.
- A **Match Modal** celebration screen appears on successful mutual match.

#### Matches Management
- A dedicated Matches tab lists all active matches with profile previews and the ability to initiate a DM conversation.

#### Dating Settings
- Users can edit their dating profile, update preferences, pause/unpause profile visibility, and access the Safety Center — all from within the dating experience.

#### Safety Center
- In-app guidelines for safe dating behavior and reporting tools specific to the dating context.

### 3.5 Push Notifications

- **Expo Push Token Management:** Users can register and unregister push tokens. Tokens are stored as an array on the user record and deduplicated.
- **Notification Delivery:** The backend uses Expo Server SDK to batch-send notifications. Tokens are validated for format and filtered against a blocklist of known foreign-project tokens.
- **Notification Preferences:** Users can configure notification settings from their profile screen (in-app preferences stored as JSONB on the user record).

### 3.6 Admin Dashboard (Web)

- **Admin Login:** Separate authentication flow with dedicated rate limiting (5 attempts per 15 minutes).
- **User Management:** View, search, and manage user accounts (bans, suspensions, role changes).
- **Community Management:** Oversee all communities, modify settings, and handle escalations.
- **Report Queue:** Review user-submitted reports with priority levels (Normal, High, Urgent), take action (warn, suspend, ban), and track resolution status.
- **Dating Moderation:** Review dating profiles, approve/reject photos, and suspend profiles violating guidelines.

### 3.7 Safety & Moderation System

#### Reporting
- Users can report via `POST /api/safety/report` with: reported user ID, reason, category, details, target type (profile/message/community), target ID, and optional screenshot URLs.
- Self-reporting is blocked. Duplicate pending reports against the same user are deduplicated.
- Reports are auto-prioritized based on the reported user's `reportsReceivedCount` (0 → Normal, 1-2 → High, 3+ → Urgent).
- The reported user's report count is atomically incremented.

#### Blocking
- Users can block other users, preventing any further interaction (messages, profile views, dating discovery).

---

## 4. Database Schema (Entity Overview)

| Entity | Description |
|---|---|
| `users` | Core user accounts — email, password hash, avatar, bio, college/religion mapping, push tokens, 2FA config, notification/privacy prefs, report count, active/deleted flags |
| `colleges` | Maps college names and verified email domains to their default community |
| `communities` | Community metadata — name, type (college/religion/custom), slug, description, tags, privacy flag, creator reference |
| `members` | Junction table: user ↔ community membership with role (member/moderator/admin) and status (active/suspended) |
| `messages` | Community chat messages — content, sender info, community reference, attachment JSON, reply-to reference, status (sent/delivered/read), timestamps |
| `direct_messages` | Private DM messages — content, type (text/image/etc.), attachments, from/to user references, status, timestamps |
| `reactions` | Emoji reactions on community messages (emoji, message reference, user reference) |
| `dm_reactions` | Emoji reactions on direct messages |
| `dating_profiles` | Detailed dating profiles — personal info, photos (relation), preferences (relation), hobbies, interests, prompts, Spotify, visibility/verification/suspension flags, matching arrays |
| `dating_preferences` | Age range, distance, gender interest, college preferences, campus-only toggle |
| `dating_photos` | Ordered photo gallery per dating profile (URL, order, CDN-validated) |
| `reports` | User-submitted reports — reporter/reported references, reason, category, details, target type/ID, priority, status, screenshots |

---

## 5. API Structure (Route Modules)

| Route File | Mount Path | Description |
|---|---|---|
| `loginNregRoutes.js` | `/api` | Registration, login, email verification, password reset, profile bootstrap |
| `userRoutes.js` | `/api/user` | Avatar upload, profile updates, account management |
| `communityRoutes.js` | `/api/communities` | CRUD operations for communities |
| `memberRoutes.js` | `/api/members` | Membership management (join, leave, role changes) |
| `messageRoutes.js` | `/api/messages` | Message history, search, deletion |
| `directMessageRoutes.js` | `/api/direct-messages` | DM conversation management and history |
| `reactionRoutes.js` | `/api/reactions` | Add/remove emoji reactions |
| `datingRoutes.js` | `/api/dating` | Dating profile CRUD, swiping, matching, preferences |
| `notificationRoutes.js` | `/api/notifications` | Push token registration and test notifications |
| `adminRoutes.js` | `/api/admin` | Admin dashboard operations (users, communities, reports, dating) |
| `safetyRoutes.js` | `/api/safety` | Report creation and management |
| `userReportRoutes.js` | `/api/reports` | User-facing report submission and status |
| `twoFactorRoutes.js` | `/api/2fa` | 2FA setup, verification, and backup codes |
| `publicRoutes.js` | `/api/public` | Unauthenticated endpoints (college list, public community search) |
| `upload.js` | `/api/upload` | Authenticated media uploads (50MB limit) |
| `tokenRoutes.js` | `/api` | Token refresh and validation |
| `events.js` | `/api/events` | Campus events (stub — planned feature) |

---

## 6. Real-Time Events (Socket.io)

| Event | Direction | Description |
|---|---|---|
| `message:send` | Client → Server | Send a new community message |
| `receive_message` | Server → Client | Broadcast a new message to community members |
| `message:ack` | Server → Client | Acknowledge message persistence with server ID |
| `message:error` | Server → Client | Report message send failure |
| `message:delivered` | Client → Server | Mark a message as delivered |
| `message:read` | Client → Server | Mark a message as read |
| `message:status` | Server → Client | Notify sender of delivery/read status change |
| `community:join` | Client → Server | Join a community socket room (membership validated) |
| `community:leave` | Client → Server | Leave a community socket room |
| `subscribe:communities` | Client → Server | Bulk-subscribe to multiple community rooms |
| `community:typing` | Client → Server | Emit typing indicator to community |
| `user:typing` | Server → Client | Broadcast typing indicator to community members |
| `dm:typing` | Bidirectional | Typing indicator for direct messages |
| `presence:update` | Server → Client | User online/offline status change |
| `rooms:init` | Server → Client | Initial room assignments on connection |

---

## 7. Security & Compliance

### 7.1 Authentication & Authorization
- JWT tokens are signed with HS256, pinned algorithm, and 5-second clock tolerance.
- Server fails fast on startup if the JWT secret is missing.
- Socket connections are authenticated via JWT in the handshake. Membership is validated from the database before joining any room.
- Admin routes use a dedicated `requireModerator` middleware that checks the user's role from the database on every request.

### 7.2 Data Protection
- Passwords: Bcrypt-hashed (10 rounds).
- DMs: E2EE with TweetNaCl (Curve25519, XSalsa20-Poly1305).
- PII: Email addresses are masked in server logs (`gu***@domain.com`).
- Uploads: File URLs are validated against an allowlist of CDN domains (Cloudinary, ImageKit).

### 7.3 Rate Limiting
- Global: Applied to all API endpoints.
- Auth-specific: Stricter limits on login and registration to prevent brute-force attacks.
- Admin login: 5 attempts per 15-minute window.

### 7.4 Infrastructure Hardening
- Helmet.js enforces: Content Security Policy, HSTS (1 year, includeSubDomains, preload), Cross-Origin Resource Policy.
- Trust proxy is scoped to loopback and private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) to prevent X-Forwarded-For spoofing.
- Non-upload endpoints have a 1MB JSON body limit. Upload endpoints allow up to 50MB.
- Graceful shutdown on SIGINT/SIGTERM with Redis cleanup and a 5-second force-exit timeout.

### 7.5 Audit
A comprehensive security audit has been conducted and documented in [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md), covering critical, high, medium, and low severity findings with specific remediation steps.

---

## 8. Scalability Considerations

- **Socket.io Redis Adapter:** The Socket.io server uses a Redis pub/sub adapter, allowing multiple backend instances to share real-time events and scale horizontally.
- **Redis-Backed Presence:** The presence system is fully backed by Redis (not in-memory), making it safe for multi-instance deployments.
- **Load Balancer:** A custom Node.js round-robin load balancer is included with WebSocket `upgrade` handling, allowing traffic distribution across multiple backend processes.
- **Cache Invalidation:** Redis keys are used for response caching (bootstrap data, profile data) with explicit invalidation on data mutations.
- **Database Indexing:** The Prisma schema includes composite and partial indexes on high-query tables (messages by community + date, DMs by participants, dating profiles by college + visibility).

---

## 9. Planned / Stubbed Features

| Feature | Status | Notes |
|---|---|---|
| Campus Events | Stubbed | Route exists (`/api/events`) returning empty data. Event model not yet in Prisma schema. Mobile Explore tab has UI scaffolding for events. |
| Voice Messages | Planned | `expo-av` is installed with microphone permissions configured. Backend support not yet implemented. |

---

*This document reflects the current state of the Campustry codebase as of June 2026. It should be updated as new features are added or architectural decisions change.*
