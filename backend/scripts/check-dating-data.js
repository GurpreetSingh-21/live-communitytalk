// backend/scripts/check-dating-data.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking dating data...\n');

    // Count users
    const userCount = await prisma.user.count();
    console.log(`👥 Total Users: ${userCount}`);

    // Count dating profiles
    const profileCount = await prisma.datingProfile.count();
    console.log(`💘 Total Dating Profiles: ${profileCount}`);

    // Count photos
    const photoCount = await prisma.datingPhoto.count();
    console.log(`📸 Total Dating Photos: ${photoCount}`);

    // Check current user (Preet)
    const currentUser = await prisma.user.findFirst({
        where: { email: 'gurpreet.singh138@qmail.cuny.edu' },
        include: {
            datingProfile: {
                include: { photos: true }
            }
        }
    });

    console.log('\n👤 Current User (Preet):');
    console.log(`   Has Dating Profile: ${currentUser?.hasDatingProfile}`);
    console.log(`   Profile Exists: ${currentUser?.datingProfile ? 'YES' : 'NO'}`);
    if (currentUser?.datingProfile) {
        console.log(`   Gender: ${currentUser.datingProfile.gender}`);
        console.log(`   Looking For: ${currentUser.datingProfile.lookingFor}`);
        console.log(`   Photos: ${currentUser.datingProfile.photos.length}`);
    }

    // List all dating profiles
    console.log('\n📋 All Dating Profiles:');
    const allProfiles = await prisma.datingProfile.findMany({
        include: {
            user: { select: { fullName: true, email: true } },
            photos: { select: { status: true } }
        }
    });

    allProfiles.forEach(p => {
        console.log(`   • ${p.user.fullName} (${p.gender}) - ${p.photos.length} photos (${p.photos.filter(ph => ph.status === 'APPROVED').length} approved)`);
    });

    // Check if Emma profile exists
    const emma = await prisma.user.findFirst({
        where: { email: 'emma.test@qmail.cuny.edu' },
        include: { datingProfile: { include: { photos: true } } }
    });

    console.log('\n🔍 Emma Test Account:');
    if (emma) {
        console.log(`   User exists: YES`);
        console.log(`   Has dating profile: ${emma.datingProfile ? 'YES' : 'NO'}`);
        if (emma.datingProfile) {
            console.log(`   Photos: ${emma.datingProfile.photos.length}`);
        }
    } else {
        console.log(`   User exists: NO`);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
