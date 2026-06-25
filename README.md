# Campustry

## 📖 About

**Campustry** is a hyper-local, college-focused social and community platform designed to connect students through shared campuses, interests, and real-time interaction. By anchoring user identities to verified college email domains, Campustry creates exclusive, safe, and highly relevant spaces for students to communicate, collaborate, and even date — all within the trust boundary of their own campus.

This repository is a **monorepo** containing the complete source code for the platform: a React Native mobile application (iOS & Android), a Next.js web frontend with an admin dashboard, and a production-grade Node.js/Express backend API.

---

## 🚀 Core Features & Functionality

Campustry is built around four major pillars: **Campus Communities**, **Real-Time Messaging**, **Campus Dating**, and **Trust & Safety**.

### 🏫 College & Campus Communities

- **Verified College Hubs:** Upon registration, each user selects their college and verifies ownership through their institutional email domain (e.g., `.edu`). They are then automatically enrolled into their college's dedicated community hub — a space exclusive to verified students of that institution.
- **Religion-Based Communities:** During onboarding, users also select a faith-based community, giving them a second anchor for connection beyond academics.
- **Custom Sub-Communities:** Any user can create additional public or private communities based on shared interests — courses, clubs, Greek life, hobbies, or campus events. Communities support custom descriptions, tags, and privacy controls.
- **Role-Based Access Control (RBAC):** Each community features a layered permission model with distinct roles: **Admin**, **Moderator**, and **Member**. Admins and moderators can manage members, remove content, and enforce community standards.
- **Community Discovery & Search:** A dedicated Explore section allows users to browse, search, and filter public communities by name, tags, type, and college affiliation.

### 💬 Real-Time Messaging

- **Community Group Chats:** Every community has a real-time text channel. Messages are delivered instantly via WebSockets (Socket.io) and are persisted to a PostgreSQL database for history.
- **Direct Messaging (DMs):** Private 1-on-1 conversations between any two users on the platform, with full support for text and media.
- **End-to-End Encryption (E2EE):** Direct messages are encrypted client-side using the **TweetNaCl** cryptographic library. Encryption keys are managed on-device via Expo SecureStore, ensuring that even the server cannot read private conversations.
- **Rich Messaging Features:**
  - Image attachments (uploaded and optimized via Cloudinary / ImageKit)
  - Message replies with quoted previews
  - Emoji reactions on both community messages and DMs
  - Real-time typing indicators (for both community channels and DMs)
  - Message delivery receipts (sent → delivered → read)
  - Message editing and soft deletion
- **User Presence:** A Redis-backed presence system tracks which users are online in real time. Presence updates are broadcast per-community so members can see who is active.
- **User Profile Previews:** Tapping on any user in a chat opens a rich profile modal showing their avatar, bio, college, stats, and options to send a DM or view their full profile.

### ❤️ Campus Dating

- **Opt-In Dating Profiles:** A fully separate, opt-in dating experience accessible from its own tab. Users create a dedicated dating profile with personal details (name, bio, photos, major, year, height, hobbies, interests, Spotify top artists, Greek life affiliation, and custom prompts).
- **Guided Onboarding Wizard:** A multi-step onboarding flow walks new users through profile creation, photo uploads, and preference configuration to ensure high-quality profiles from day one.
- **Swipe-Based Discovery:** A card-swiping interface (like/pass) allows students to discover potential matches. Profiles are filtered and scored by the backend matching engine.
- **Granular Matching Preferences:** Users can set filters for age range, maximum distance, gender interest, preferred colleges, and whether to restrict visibility to same-campus users only.
- **Match System:** When two users mutually like each other, a match is created and both are notified. A dedicated Matches tab lists all active matches for easy access.
- **Safety Center:** A built-in Safety Center within the dating experience provides guidelines, reporting tools, and resources to ensure a respectful environment.
- **Photo Verification:** Profile photos go through a verification flow to maintain authenticity.
- **Age Verification:** Server-side enforcement ensures all dating users are 18 years or older.
- **Pause / Unpause:** Users can temporarily hide their dating profile without deleting it.

### 🛡️ Trust & Safety

- **Robust Reporting System:** Users can report other users, messages, or communities. Reports include a reason, category, optional details, and screenshot attachments. The system auto-prioritizes reports based on how many prior reports a user has received (Normal → High → Urgent).
- **Community Guidelines:** Accessible in-app guidelines clearly outline expected behavior and consequences for violations.
- **Admin Dashboard (Web):** A full-featured web-based admin panel allows moderators and administrators to manage users, communities, reports, and dating profiles. Admin login is rate-limited and access is role-gated.
- **Two-Factor Authentication (2FA):** Users can enable TOTP-based 2FA (via Speakeasy) for an additional layer of account security, complete with backup codes.
- **Account Security:** Password reset via email, new device login alerts, email verification with time-limited codes, and brute-force protection through rate limiting.
- **XSS Protection:** All user-generated content processed through Socket.io is sanitized server-side using DOMPurify before storage and broadcast.
- **Content Security Policy (CSP):** Helmet.js enforces strict CSP headers, HSTS, and Cross-Origin Resource Policy on all API responses.

### 📱 Additional Mobile Features

- **Push Notifications:** Expo Push Notifications (via Expo Server SDK) notify users of new messages, matches, and community activity even when the app is closed.
- **Dark Mode:** Full dark mode support with automatic system detection and manual toggle.
- **Haptic Feedback:** Tactile feedback on key interactions for a polished native feel.
- **Profile Management:** Users can update their avatar (synced across all community memberships), edit their bio, manage notification preferences, configure privacy settings, view their activity stats, and invite friends.
- **Forgot Password Flow:** A complete password recovery flow via email verification codes.
- **Terms of Service & Privacy Policy:** Legally compliant pages accessible from both the mobile app and the web frontend.

### 🌐 Web Frontend Features

- **Landing Page:** A polished, animated marketing page with smooth scrolling (Lenis), Framer Motion transitions, and GSAP-powered animations.
- **Admin Panel:** A dedicated admin area for managing users, communities, reports, and dating profile moderation.
- **Legal Pages:** Public-facing Privacy Policy, Terms of Service, and Contact pages.

---

## 🏗️ Project Structure

```text
campustry/
├── backend/                  # Node.js/Express API & WebSocket server
│   ├── routes/               # 17 route modules (auth, communities, messages, dating, admin, safety, etc.)
│   ├── middleware/            # Authentication, rate limiting, admin authorization
│   ├── services/             # Email (Resend), push notifications (Expo), media uploads (ImageKit/Cloudinary)
│   ├── sockets/              # Socket.io event handlers
│   ├── prisma/               # Prisma schema, migrations, and seed scripts
│   ├── presence.js           # Redis-backed user online/offline presence tracker
│   ├── server.js             # Application entry point
│   └── load-balancer.js      # Round-robin load balancer with WebSocket proxy support
│
├── frontend/                 # Next.js web application
│   ├── app/                  # App Router pages (landing, admin, legal)
│   │   ├── admin/            # Admin dashboard (users, communities, reports, dating)
│   │   ├── privacy-policy/   # Privacy Policy page
│   │   ├── terms-of-service/ # Terms of Service page
│   │   └── contact/          # Contact page
│   ├── components/           # Reusable UI components (shadcn/ui, Radix primitives)
│   └── lib/                  # Utilities and helpers
│
├── CommunityTalkMobile/      # React Native / Expo mobile application
│   ├── app/                  # Expo Router file-based screens
│   │   ├── (tabs)/           # Tab navigator (Home, Communities, Explore, Dating, DMs, Profile)
│   │   ├── community/        # Community chat screen
│   │   ├── dm/               # Direct message conversation screen
│   │   ├── dating/           # Dating sub-screens (matches, safety center, verification)
│   │   ├── profile/          # Profile management screens (account, security, notifications, etc.)
│   │   ├── safety/           # Community guidelines
│   │   └── thread/           # Message thread view
│   ├── components/           # Reusable components (chat, dating cards, modals, safety)
│   ├── src/                  # Core business logic
│   │   ├── api/              # Axios API client
│   │   ├── context/          # AuthContext & SocketContext providers
│   │   └── utils/            # Secure storage and helper utilities
│   └── constants/            # Theme tokens (colors, fonts)
│
└── SECURITY_AUDIT.md         # Comprehensive security audit report
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend Runtime** | Node.js, Express.js |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Caching & Pub/Sub** | Redis (ioredis) |
| **Real-Time** | Socket.io (with Redis adapter for horizontal scaling) |
| **Authentication** | JWT (HS256), Passport.js, Bcrypt, Speakeasy (2FA) |
| **Email** | Resend |
| **Push Notifications** | Expo Server SDK |
| **Media Storage** | Cloudinary, ImageKit |
| **Security** | Helmet.js, DOMPurify, express-rate-limit |
| **Web Framework** | Next.js (App Router, React 19) |
| **Web UI** | Tailwind CSS, Radix UI, shadcn/ui |
| **Web Animations** | Framer Motion, GSAP, Lenis |
| **Mobile Framework** | React Native, Expo (SDK 54) |
| **Mobile Styling** | NativeWind (Tailwind CSS for React Native) |
| **Mobile Navigation** | Expo Router (file-based), React Navigation |
| **Mobile Performance** | Shopify FlashList, React Native Reanimated, Moti |
| **Mobile Security** | Expo SecureStore, TweetNaCl (E2EE) |
| **Load Balancing** | Custom Node.js round-robin proxy (http-proxy-middleware) |
| **Testing** | Jest, Supertest |
| **Deployment** | EAS Build (Mobile), Vercel-ready (Web) |

---

## 🔒 Security

Security is a foundational priority for Campustry. The platform implements multiple layers of defense:

- **Authentication:** Passwords are hashed with Bcrypt. Sessions use short-lived JWTs (HS256, 1-day expiry) with algorithm pinning and clock tolerance. Optional 2FA adds a TOTP layer.
- **Authorization:** Server-side membership validation on every socket event and API route. Admin endpoints are role-gated with dedicated middleware.
- **Encryption:** Direct messages use client-side E2EE via TweetNaCl. Keys are stored in Expo SecureStore and never leave the device.
- **Input Sanitization:** All socket-transmitted content is sanitized with DOMPurify to prevent XSS. Upload URLs are domain-validated.
- **Rate Limiting:** Global API rate limiting plus dedicated stricter limits on authentication and admin login endpoints.
- **Infrastructure:** Helmet.js enforces CSP, HSTS, and CORP. Proxy trust is scoped to loopback and private subnets to prevent IP spoofing.
- **Graceful Shutdown:** The server handles SIGINT/SIGTERM signals, cleanly closing Redis connections and HTTP listeners.

For the full vulnerability assessment and remediation status, see [`SECURITY_AUDIT.md`](./SECURITY_AUDIT.md).

---

## 👨‍💻 Development Guidelines

- **Code Quality:** ESLint is configured across all three projects. Run `npm run lint` before committing.
- **Environment Variables:** Never commit `.env` or credential files. Use `.env.example` templates for local setup.
- **Database Migrations:** Use `npx prisma migrate dev` when altering the Prisma schema. Always generate the client after migration.
- **Branching:** Follow a feature-branch workflow. Open pull requests for review before merging into the main branch.
- **Testing:** Backend tests use Jest and Supertest. Run with `npm test` from the `backend/` directory.

---

*Built with care by the Campustry team.*
