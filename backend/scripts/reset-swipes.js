// backend/scripts/reset-swipes.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmjc3ntwp00019mmzxwkk52ov'; // Preet

    const myProfile = await prisma.datingProfile.findUnique({
        where: { userId }
    });

    const deleted = await prisma.datingSwipe.deleteMany({
        where: { swiperId: myProfile.id }
    });

    console.log(`✅ Deleted ${deleted.count} swipes!`);
    console.log('🔄 Refresh your app to see profiles again!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
