-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'mod', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'UNDER_REVIEW', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('college', 'religion', 'custom');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('member', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'invited', 'banned', 'online', 'owner');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('sent', 'delivered', 'read', 'edited', 'deleted');

-- CreateEnum
CREATE TYPE "DMType" AS ENUM ('text', 'photo', 'video', 'audio', 'file');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER');

-- CreateEnum
CREATE TYPE "LookingFor" AS ENUM ('RELATIONSHIP', 'CASUAL', 'FRIENDS', 'UNSURE');

-- CreateEnum
CREATE TYPE "StudyYear" AS ENUM ('FRESHMAN', 'SOPHOMORE', 'JUNIOR', 'SENIOR', 'GRADUATE', 'ALUMNI', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "PhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SwipeType" AS ENUM ('LIKE', 'DISLIKE', 'SUPERLIKE');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('HARASSMENT', 'FAKE_PROFILE', 'INAPPROPRIATE_CONTENT', 'SAFETY_CONCERN', 'SPAM', 'UNDERAGE', 'HATE_SPEECH', 'IMPERSONATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "PhotoReportReason" AS ENUM ('NUDITY', 'NOT_REAL_PERSON', 'SOMEONE_ELSE', 'INAPPROPRIATE', 'CELEBRITY_STOCK', 'OTHER');

-- CreateEnum
CREATE TYPE "StrikeSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "AppealType" AS ENUM ('STRIKE', 'SUSPENSION', 'BAN', 'PHOTO_REJECTION');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '/default-avatar.png',
    "bio" TEXT,
    "publicKey" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationCode" TEXT,
    "reportsReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "isPermanentlyDeleted" BOOLEAN NOT NULL DEFAULT false,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedUntil" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "bannedAt" TIMESTAMP(3),
    "bannedReason" TEXT,
    "strikeCount" INTEGER NOT NULL DEFAULT 0,
    "lastStrikeAt" TIMESTAMP(3),
    "profileVerified" BOOLEAN NOT NULL DEFAULT false,
    "photoVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "rateLimits" JSONB,
    "collegeName" TEXT,
    "collegeSlug" TEXT,
    "religionKey" TEXT,
    "notificationPrefs" JSONB,
    "privacyPrefs" JSONB,
    "pushTokens" TEXT[],
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorBackupCodes" TEXT[],
    "hasDatingProfile" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colleges" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "emailDomains" TEXT[],
    "communityId" TEXT NOT NULL,

    CONSTRAINT "colleges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommunityType" NOT NULL DEFAULT 'custom',
    "key" TEXT,
    "slug" TEXT,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "imageUrl" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "communities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '/default-avatar.png',
    "role" "MemberRole" NOT NULL DEFAULT 'member',
    "memberStatus" "MemberStatus" NOT NULL DEFAULT 'active',
    "fcmToken" TEXT,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "clientMessageId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'sent',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "senderName" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "replyToId" TEXT,
    "replyToSnapshot" JSONB,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emoji" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "content" TEXT,
    "type" "DMType" NOT NULL DEFAULT 'text',
    "context" TEXT NOT NULL DEFAULT 'community',
    "attachments" JSONB,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "status" "MessageStatus" NOT NULL DEFAULT 'sent',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,

    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dm_reactions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emoji" TEXT NOT NULL,
    "dmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "dm_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating_profiles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3) NOT NULL,
    "gender" "Gender" NOT NULL,
    "bio" VARCHAR(500),
    "height" INTEGER,
    "collegeSlug" TEXT NOT NULL,
    "major" TEXT,
    "year" "StudyYear",
    "lookingFor" "LookingFor"[],
    "hobbies" TEXT[],
    "instagramHandle" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isProfileVisible" BOOLEAN NOT NULL DEFAULT true,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "isPhotoVerified" BOOLEAN NOT NULL DEFAULT false,
    "photoVerifiedAt" TIMESTAMP(3),
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "dating_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating_preferences" (
    "id" TEXT NOT NULL,
    "datingProfileId" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL DEFAULT 18,
    "ageMax" INTEGER NOT NULL DEFAULT 30,
    "maxDistance" INTEGER NOT NULL DEFAULT 50,
    "interestedInGender" "Gender"[],
    "preferredColleges" TEXT[],
    "showToPeopleOnCampusOnly" BOOLEAN NOT NULL DEFAULT false,
    "isDistanceVisible" BOOLEAN NOT NULL DEFAULT true,
    "isCollegeVisible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "dating_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating_photos" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datingProfileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "PhotoStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "aiFlags" JSONB,
    "isMain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dating_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating_swipes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "swiperId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" "SwipeType" NOT NULL,

    CONSTRAINT "dating_swipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating_matches" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profile1Id" TEXT NOT NULL,
    "profile2Id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unmatchedBy" TEXT,
    "channelId" TEXT,

    CONSTRAINT "dating_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "category" TEXT,
    "details" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "screenshots" TEXT[],
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "ReportPriority" NOT NULL DEFAULT 'NORMAL',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "actionTaken" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating_blocks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,

    CONSTRAINT "dating_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poseId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_poses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "referenceImageUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_poses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_reports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "reason" "PhotoReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "photo_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strikes" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" "StrikeSeverity" NOT NULL DEFAULT 'MINOR',
    "details" TEXT,
    "reportId" TEXT,
    "issuedBy" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "strikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AppealType" NOT NULL,
    "strikeId" TEXT,
    "reportId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "decision" TEXT,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "userId" TEXT,
    "reportId" TEXT,
    "strikeId" TEXT,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_name_key" ON "colleges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "colleges_key_key" ON "colleges"("key");

-- CreateIndex
CREATE INDEX "colleges_emailDomains_idx" ON "colleges"("emailDomains");

-- CreateIndex
CREATE UNIQUE INDEX "communities_slug_key" ON "communities"("slug");

-- CreateIndex
CREATE INDEX "communities_type_key_idx" ON "communities"("type", "key");

-- CreateIndex
CREATE INDEX "members_userId_memberStatus_idx" ON "members"("userId", "memberStatus");

-- CreateIndex
CREATE INDEX "members_communityId_memberStatus_idx" ON "members"("communityId", "memberStatus");

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_communityId_key" ON "members"("userId", "communityId");

-- CreateIndex
CREATE INDEX "messages_communityId_createdAt_idx" ON "messages"("communityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "messages_senderId_idx" ON "messages"("senderId");

-- CreateIndex
CREATE INDEX "direct_messages_fromId_toId_createdAt_idx" ON "direct_messages"("fromId", "toId", "createdAt");

-- CreateIndex
CREATE INDEX "direct_messages_toId_status_idx" ON "direct_messages"("toId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dating_profiles_userId_key" ON "dating_profiles"("userId");

-- CreateIndex
CREATE INDEX "dating_profiles_collegeSlug_idx" ON "dating_profiles"("collegeSlug");

-- CreateIndex
CREATE INDEX "dating_profiles_gender_idx" ON "dating_profiles"("gender");

-- CreateIndex
CREATE INDEX "dating_profiles_userId_idx" ON "dating_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dating_preferences_datingProfileId_key" ON "dating_preferences"("datingProfileId");

-- CreateIndex
CREATE INDEX "dating_photos_datingProfileId_idx" ON "dating_photos"("datingProfileId");

-- CreateIndex
CREATE INDEX "dating_photos_status_idx" ON "dating_photos"("status");

-- CreateIndex
CREATE INDEX "dating_swipes_swiperId_idx" ON "dating_swipes"("swiperId");

-- CreateIndex
CREATE INDEX "dating_swipes_targetId_idx" ON "dating_swipes"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "dating_swipes_swiperId_targetId_key" ON "dating_swipes"("swiperId", "targetId");

-- CreateIndex
CREATE INDEX "dating_matches_profile1Id_idx" ON "dating_matches"("profile1Id");

-- CreateIndex
CREATE INDEX "dating_matches_profile2Id_idx" ON "dating_matches"("profile2Id");

-- CreateIndex
CREATE UNIQUE INDEX "dating_matches_profile1Id_profile2Id_key" ON "dating_matches"("profile1Id", "profile2Id");

-- CreateIndex
CREATE INDEX "reports_reportedId_status_idx" ON "reports"("reportedId", "status");

-- CreateIndex
CREATE INDEX "reports_status_priority_idx" ON "reports"("status", "priority");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "dating_blocks_blockerId_idx" ON "dating_blocks"("blockerId");

-- CreateIndex
CREATE INDEX "dating_blocks_blockedId_idx" ON "dating_blocks"("blockedId");

-- CreateIndex
CREATE UNIQUE INDEX "dating_blocks_blockerId_blockedId_key" ON "dating_blocks"("blockerId", "blockedId");

-- CreateIndex
CREATE INDEX "verification_requests_userId_idx" ON "verification_requests"("userId");

-- CreateIndex
CREATE INDEX "verification_requests_status_idx" ON "verification_requests"("status");

-- CreateIndex
CREATE INDEX "photo_reports_photoId_status_idx" ON "photo_reports"("photoId", "status");

-- CreateIndex
CREATE INDEX "strikes_userId_active_idx" ON "strikes"("userId", "active");

-- CreateIndex
CREATE INDEX "strikes_createdAt_idx" ON "strikes"("createdAt");

-- CreateIndex
CREATE INDEX "appeals_userId_status_idx" ON "appeals"("userId", "status");

-- CreateIndex
CREATE INDEX "appeals_status_idx" ON "appeals"("status");

-- CreateIndex
CREATE INDEX "moderation_logs_targetType_targetId_idx" ON "moderation_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "moderation_logs_moderatorId_idx" ON "moderation_logs"("moderatorId");

-- CreateIndex
CREATE INDEX "moderation_logs_createdAt_idx" ON "moderation_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "colleges" ADD CONSTRAINT "colleges_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_toId_fkey" FOREIGN KEY ("toId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_reactions" ADD CONSTRAINT "dm_reactions_dmId_fkey" FOREIGN KEY ("dmId") REFERENCES "direct_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dm_reactions" ADD CONSTRAINT "dm_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_profiles" ADD CONSTRAINT "dating_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_preferences" ADD CONSTRAINT "dating_preferences_datingProfileId_fkey" FOREIGN KEY ("datingProfileId") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_photos" ADD CONSTRAINT "dating_photos_datingProfileId_fkey" FOREIGN KEY ("datingProfileId") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_swipes" ADD CONSTRAINT "dating_swipes_swiperId_fkey" FOREIGN KEY ("swiperId") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_swipes" ADD CONSTRAINT "dating_swipes_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_matches" ADD CONSTRAINT "dating_matches_profile1Id_fkey" FOREIGN KEY ("profile1Id") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_matches" ADD CONSTRAINT "dating_matches_profile2Id_fkey" FOREIGN KEY ("profile2Id") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_blocks" ADD CONSTRAINT "dating_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating_blocks" ADD CONSTRAINT "dating_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "dating_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_poseId_fkey" FOREIGN KEY ("poseId") REFERENCES "verification_poses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_reports" ADD CONSTRAINT "photo_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_reports" ADD CONSTRAINT "photo_reports_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "dating_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strikes" ADD CONSTRAINT "strikes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
