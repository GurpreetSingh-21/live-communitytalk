// backend/scripts/test-dating-pool.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Testing dating pool logic...\n');

    // Simulate Preet's request
    const userId = 'cmjc3ntwp00019mmzxwkk52ov'; // Preet's ID

    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            datingProfile: {
                include: { photos: true }
            }
        }
    });

    console.log('👤 Current User (Preet):');
    console.log(`   Name: ${currentUser.fullName}`);
    console.log(`   Has Profile: ${currentUser.datingProfile ? 'YES' : 'NO'}`);
    if (currentUser.datingProfile) {
        console.log(`   Gender: ${currentUser.datingProfile.gender}`);
        console.log(`   Looking For: ${currentUser.datingProfile.lookingFor}`);
        console.log(`   Photos: ${currentUser.datingProfile.photos.length} (${currentUser.datingProfile.photos.filter(p => p.status === 'APPROVED').length} approved)`);
        console.log(`   Visible: ${currentUser.datingProfile.isProfileVisible}`);
        console.log(`   Paused: ${currentUser.datingProfile.isPaused}`);
    }

    // Get swipes and blocks
    const swipes = await prisma.datingSwipe.findMany({
        where: { swiperId: userId }
    });

    const blocksGiven = await prisma.datingBlock.findMany({
        where: { blockerId: userId }
    });

    const blocksReceived = await prisma.datingBlock.findMany({
        where: { blockedId: userId }
    });

    console.log(`\n📊 Activity:`);
    console.log(`   Swipes made: ${swipes.length}`);
    console.log(`   Users blocked: ${blocksGiven.length}`);
    console.log(`   Blocked by: ${blocksReceived.length}`);

    // Get all profiles
    const allProfiles = await prisma.datingProfile.findMany({
        where: {
            userId: { not: userId },
            isProfileVisible: true,
            isPaused: false,
        },
        include: {
            user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                }
            },
            photos: {
                where: { status: 'APPROVED' },
                orderBy: { order: 'asc' }
            }
        }
    });

    console.log(`\n📋 Potential Matches (${allProfiles.length} profiles):`);
    allProfiles.forEach(p => {
        const hasPhotos = p.photos.length > 0;
        console.log(`   • ${p.user.fullName} (${p.gender}) - Photos: ${p.photos.length} ${hasPhotos ? '✅' : '❌'}`);
    });

    // Filter out profiles with no approved photos
    const withPhotos = allProfiles.filter(p => p.photos.length > 0);
    console.log(`\n✅ Profiles WITH approved photos: ${withPhotos.length}`);
    console.log(`❌ Profiles WITHOUT approved photos: ${allProfiles.length - withPhotos.length}`);

    if (withPhotos.length === 0) {
        console.log('\n⚠️  NO PROFILES HAVE APPROVED PHOTOS! This is why the feed is empty.');
    } else {
        console.log('\n✅ Profiles should be visible!');
        console.log('\nSample profile JSON:');
        console.log(JSON.stringify(withPhotos[0], null, 2));
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
