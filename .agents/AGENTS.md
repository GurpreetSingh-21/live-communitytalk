# Project Context: CommunityTalk / Campustry

This file serves as a global context and rulebook for AI Agents working on this workspace. Please read and adhere to these guidelines to ensure consistency with the established architecture.

## Tech Stack Overview
- **Backend**: Node.js, Express, Socket.io
- **Database**: PostgreSQL (managed via **Prisma**)
- **Caching & Realtime State**: Upstash Redis
- **Mobile App**: React Native (Expo) in `/CommunityTalkMobile`
- **Web Admin**: Next.js (React) in `/frontend`

## CRITICAL RULES (Must Follow)

### 1. Database Interactions (Prisma vs Mongoose)
- This project **was completely migrated from MongoDB (Mongoose) to PostgreSQL (Prisma)**.
- **NEVER** write Mongoose code (`.findById()`, `.save()`, `.lean()`, etc.).
- **NEVER** use MongoDB's `._id` field. Always use `.id`.
- The database schema is located at `backend/prisma/schema.prisma`. All migrations should be handled via standard Prisma commands.
- There are some lingering comments containing old Mongoose code—these are just inactive legacy comments, do not reactivate them.

### 2. Redis Integration (ioredis vs @upstash/redis)
- The project uses Upstash for Redis. 
- **NEVER** use the `@upstash/redis` REST client library. It is fundamentally incompatible with Socket.io presence tracking and pub/sub pipelines.
- **ALWAYS** use the `ioredis` library over a raw TCP connection. 
- *Connection Note*: Upstash requires specific TLS handling. When initializing Redis in new scripts, always look at how it is initialized in `backend/server.js` or `backend/invalidateCache.js` (using `rejectUnauthorized: false` for the TLS config).

### 3. Architecture & Memory Management
- **Rate Limiting**: Rate limiting is handled via `express-rate-limit` using an in-memory store in `backend/middleware/rateLimiter.js`. Do not use or recreate custom in-memory map limiters (a previous custom leak was purged).
- **Socket.io Presence**: Online presence is tracked securely in Redis via `backend/presence.js`. Do not use native arrays/maps to track online users in the node process.

### 4. File Structure
- `/backend`: The core Node API.
- `/backend/routes`: Express route handlers.
- `/backend/scripts`: Useful database seed scripts (e.g., `seedCommunities.js`). Note that many scratch/debug scripts were historically deleted.
- `/CommunityTalkMobile`: The Expo mobile app. The primary feature is Dating (V2) which has parity with Dil Mil. 
- `/frontend`: The admin dashboard for managing users and manually approving dating profiles.

### 5. Media & Photo Handling
- The backend strictly validates photo uploads. All profile photo URLs **MUST** belong to either `res.cloudinary.com` or `ik.imagekit.io`. If you are writing seed scripts or testing the API with mock data, do not use generic placeholder URLs (e.g., `placehold.co`, `unsplash.com`) or the backend will reject them with a `400 Bad Request`.
