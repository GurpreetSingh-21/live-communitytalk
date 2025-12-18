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
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationCode" TEXT,
    "reportsReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "isPermanentlyDeleted" BOOLEAN NOT NULL DEFAULT false,
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
    "attachments" JSONB,
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
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "gender" TEXT NOT NULL,
    "seeking" TEXT[],
    "yearOfStudy" TEXT NOT NULL DEFAULT 'other',
    "photos" TEXT[],
    "collegeSlug" TEXT NOT NULL,
    "religionKey" TEXT,
    "isProfileVisible" BOOLEAN NOT NULL DEFAULT false,
    "isPhotoApproved" BOOLEAN NOT NULL DEFAULT false,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "likes" TEXT[],
    "dislikes" TEXT[],
    "matches" TEXT[],

    CONSTRAINT "dating_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "members_communityId_memberStatus_idx" ON "members"("communityId", "memberStatus");

-- CreateIndex
CREATE UNIQUE INDEX "members_userId_communityId_key" ON "members"("userId", "communityId");

-- CreateIndex
CREATE INDEX "messages_communityId_createdAt_idx" ON "messages"("communityId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "direct_messages_fromId_toId_createdAt_idx" ON "direct_messages"("fromId", "toId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "dating_profiles_userId_key" ON "dating_profiles"("userId");

-- CreateIndex
CREATE INDEX "dating_profiles_collegeSlug_religionKey_gender_isProfileVis_idx" ON "dating_profiles"("collegeSlug", "religionKey", "gender", "isProfileVisible");

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
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
