// backend/scratch/fix-pari-baba.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🛠️ Fixing Pari and Baba's profiles...");

  // 1. Find Baba
  const baba = await prisma.user.findFirst({
    where: { email: 'baba@qmail.cuny.edu' },
    include: { datingProfile: true }
  });

  if (baba && baba.datingProfile) {
    // Approve Baba's profile
    await prisma.datingProfile.update({
      where: { id: baba.datingProfile.id },
      data: {
        approvalStatus: 'APPROVED',
        gender: 'MALE', // Make sure Baba is MALE
      }
    });

    // Upsert preference for Baba seeking FEMALE
    await prisma.datingPreference.upsert({
      where: { datingProfileId: baba.datingProfile.id },
      update: { interestedInGender: ['FEMALE'] },
      create: {
        datingProfileId: baba.datingProfile.id,
        interestedInGender: ['FEMALE'],
        ageMin: 18,
        ageMax: 30,
        maxDistance: 50
      }
    });
    console.log("✅ Fixed Baba (MALE, seeking FEMALE, APPROVED)");
  }

  // 2. Find Pari
  const pari = await prisma.user.findFirst({
    where: { email: 'pari@qmail.cuny.edu' },
    include: { datingProfile: true }
  });

  if (pari && pari.datingProfile) {
    // Approve Pari's profile
    await prisma.datingProfile.update({
      where: { id: pari.datingProfile.id },
      data: {
        approvalStatus: 'APPROVED',
        gender: 'FEMALE', // Make sure Pari is FEMALE
      }
    });

    // Upsert preference for Pari seeking MALE
    await prisma.datingPreference.upsert({
      where: { datingProfileId: pari.datingProfile.id },
      update: { interestedInGender: ['MALE'] },
      create: {
        datingProfileId: pari.datingProfile.id,
        interestedInGender: ['MALE'],
        ageMin: 18,
        ageMax: 30,
        maxDistance: 50
      }
    });
    console.log("✅ Fixed Pari (FEMALE, seeking MALE, APPROVED)");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
