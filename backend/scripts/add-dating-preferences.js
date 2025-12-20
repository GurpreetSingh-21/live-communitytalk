// backend/scripts/add-dating-preferences.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('⚙️  Adding dating preferences to all profiles...\n');

    const profiles = await prisma.datingProfile.findMany({
        include: { preference: true }
    });

    for (const profile of profiles) {
        if (!profile.preference) {
            // Create preference based on gender
            const interestedIn = profile.gender === 'MALE' ? ['FEMALE'] : ['MALE'];

            await prisma.datingPreference.create({
                data: {
                    datingProfileId: profile.id,
                    ageMin: 18,
                    ageMax: 30,
                    maxDistance: 50,
                    interestedInGender: interestedIn,
                    preferredColleges: [],
                    showToPeopleOnCampusOnly: false,
                }
            });

            console.log(`✅ Created preference for ${profile.firstName} (${profile.gender} → ${interestedIn.join(', ')})`);
        } else {
            console.log(`⏭️  Skip ${profile.firstName} (already has preference)`);
        }
    }

    console.log('\n🎉 Done!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
