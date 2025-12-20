// backend/scripts/check-alex-profiles.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking "Alex" profiles...\n');

    const profiles = await prisma.datingProfile.findMany({
        where: {
            firstName: { startsWith: 'Alex' }
        },
        include: {
            user: { select: { fullName: true, email: true } },
            photos: { select: { url: true, status: true }, take: 1 }
        },
        orderBy: { firstName: 'asc' }
    });

    console.log(`Found ${profiles.length} Alex profiles:\n`);

    profiles.forEach(p => {
        console.log(`📋 ${p.firstName}`);
        console.log(`   User: ${p.user.fullName} (${p.user.email})`);
        console.log(`   Gender: ${p.gender}`);
        console.log(`   Age: ${calculateAge(p.birthDate)}`);
        console.log(`   Visible: ${p.isProfileVisible}`);
        console.log(`   Photos: ${p.photos.length}`);
        console.log('');
    });

    // Check gender distribution
    const maleCount = profiles.filter(p => p.gender === 'MALE').length;
    const femaleCount = profiles.filter(p => p.gender === 'FEMALE').length;

    console.log(`\n📊 Summary:`);
    console.log(`   MALE Alex profiles: ${maleCount}`);
    console.log(`   FEMALE Alex profiles: ${femaleCount}`);
}

function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
