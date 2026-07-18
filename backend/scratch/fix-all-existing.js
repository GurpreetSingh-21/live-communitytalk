// backend/scratch/fix-all-existing.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("🛠️ Repairing and approving ALL existing dating profiles in the database...");

  // 1. Get all dating profiles
  const profiles = await prisma.datingProfile.findMany({});
  
  for (const profile of profiles) {
    console.log(`\nProcessing profile for ID: ${profile.id} (Gender: ${profile.gender})`);
    
    // Auto-approve profile
    await prisma.datingProfile.update({
      where: { id: profile.id },
      data: {
        approvalStatus: 'APPROVED'
      }
    });
    console.log(`  ✅ Set status to APPROVED`);

    // Determine default interestedInGender
    const interested = profile.gender === 'MALE' ? ['FEMALE'] : profile.gender === 'FEMALE' ? ['MALE'] : ['MALE', 'FEMALE'];

    // Upsert preferences
    await prisma.datingPreference.upsert({
      where: { datingProfileId: profile.id },
      update: {
        // If it's empty, set it
        interestedInGender: {
          set: interested
        }
      },
      create: {
        datingProfileId: profile.id,
        interestedInGender: interested,
        ageMin: 18,
        ageMax: 30,
        maxDistance: 50
      }
    });
    console.log(`  ✅ Initialized preference: interested in ${interested.join(', ')}`);
  }

  console.log("\n🎉 All existing profiles have been repaired and approved!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
