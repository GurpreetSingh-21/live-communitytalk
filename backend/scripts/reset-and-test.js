// backend/scripts/reset-and-test.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmjc3ntwp00019mmzxwkk52ov'; // Preet

    const myProfile = await prisma.datingProfile.findUnique({
        where: { userId }
    });

    // Delete all swipes
    const deleted = await prisma.datingSwipe.deleteMany({
        where: { swiperId: myProfile.id }
    });

    console.log(`✅ Deleted ${deleted.count} swipes!`);
    console.log('🔄 Pool reset - you can see all profiles again!');
    console.log('\n📋 Your preference: FEMALE');
    console.log('✅ Daily limit: DISABLED');
    console.log('✅ Reciprocal filter: DISABLED');
    console.log('\n🎉 Refresh your app - you should see 5 FEMALE profiles!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
