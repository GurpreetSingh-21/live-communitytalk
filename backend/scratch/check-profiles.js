// backend/scratch/check-profiles.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      datingProfile: {
        include: {
          preference: true,
          photos: true
        }
      }
    }
  });

  console.log("=== USERS & DATING PROFILES ===");
  for (const u of users) {
    console.log(`\nUser: ${u.fullName} (${u.email})`);
    console.log(`  hasDatingProfile: ${u.hasDatingProfile}`);
    console.log(`  collegeSlug: ${u.collegeSlug}`);
    if (u.datingProfile) {
      console.log(`  DatingProfile:`);
      console.log(`    Gender: ${u.datingProfile.gender}`);
      console.log(`    Approval Status: ${u.datingProfile.approvalStatus}`);
      console.log(`    Photos count: ${u.datingProfile.photos.length}`);
      console.log(`    Preferences:`, u.datingProfile.preference);
    } else {
      console.log(`  No dating profile record.`);
    }
  }

  const consentLogs = await prisma.moderationLog.findMany({
    where: { action: 'tos_consent' }
  });
  console.log("\n=== TOS CONSENT LOGS ===");
  console.log(consentLogs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
