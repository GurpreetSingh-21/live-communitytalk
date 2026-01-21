-- Add E2EE fields to users table
-- This migration adds support for Signal-style E2EE with automatic backup and prekey bundles

-- Add encrypted backup blob (JSON) for automatic identity recovery
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2eeBackup" JSONB;

-- Add Signal-style prekey bundle fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2eeSignedPrekey" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2eeSignedPrekeySig" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2eeOneTimePrekeys" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2eeBundleVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "e2eeBundleUpdatedAt" TIMESTAMP(3);

-- Add key metadata fields to direct_messages table (for proper decryption after key rotation)
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "senderPublicKey" TEXT;
ALTER TABLE "direct_messages" ADD COLUMN IF NOT EXISTS "recipientPublicKey" TEXT;
