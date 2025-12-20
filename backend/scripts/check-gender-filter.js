// backend/scripts/check-gender-filter.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmjc3ntwp00019mmzxwkk52ov'; // Preet

    const myProfile = await prisma.datingProfile.findUnique({
        where: { userId },
        include: { preference: true }
    });

    console.log('👤 Your Profile:');
    console.log(`   Gender: ${myProfile.gender}`);
    console.log(`   Looking for: ${myProfile.preference?.interestedInGender.join(', ')}`);

    // Get all profiles
    const allProfiles = await prisma.datingProfile.findMany({
        where: {
            id: { not: myProfile.id },
            isProfileVisible: true,
            isPaused: false,
        },
        select: {
            id: true,
            firstName: true,
            gender: true,
            user: { select: { fullName: true } }
        }
    });

    console.log(`\n📋 All Visible Profiles (${allProfiles.length}):`);
    allProfiles.forEach(p => {
        console.log(`   • ${p.user.fullName} (${p.gender})`);
    });

    // Count by gender
    const femaleCount = allProfiles.filter(p => p.gender === 'FEMALE').length;
    const maleCount = allProfiles.filter(p => p.gender === 'MALE').length;

    console.log(`\n📊 Gender Distribution:`);
    console.log(`   FEMALE: ${femaleCount}`);
    console.log(`   MALE: ${maleCount}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
