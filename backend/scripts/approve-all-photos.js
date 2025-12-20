// backend/scripts/approve-all-photos.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('✅ Approving all dating photos...\n');

    const result = await prisma.datingPhoto.updateMany({
        where: { status: 'PENDING' },
        data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
        }
    });

    console.log(`✅ Approved ${result.count} photos!`);

    // Also update User.hasDatingProfile flag
    await prisma.user.updateMany({
        where: {
            datingProfile: {
                isNot: null
            },
            hasDatingProfile: false
        },
        data: {
            hasDatingProfile: true
        }
    });

    console.log('✅ Updated user flags!');
    console.log('\n🎉 All photos are now visible!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
