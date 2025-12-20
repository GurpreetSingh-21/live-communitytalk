// backend/scripts/diagnose-pool.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmjc3ntwp00019mmzxwkk52ov'; // Preet

    console.log('🔍 DEEP DIAGNOSTIC - Dating Pool\n');

    // 1. Get YOUR profile
    const myProfile = await prisma.datingProfile.findUnique({
        where: { userId },
        include: { preference: true }
    });

    console.log('👤 YOUR PROFILE:');
    console.log(`   ID: ${myProfile.id}`);
    console.log(`   Gender: ${myProfile.gender}`);
    console.log(`   Has Preference: ${myProfile.preference ? 'YES' : 'NO'}`);

    if (myProfile.preference) {
        console.log(`   Preference ID: ${myProfile.preference.id}`);
        console.log(`   Interested In: ${JSON.stringify(myProfile.preference.interestedInGender)}`);
        console.log(`   Age Range: ${myProfile.preference.ageMin}-${myProfile.preference.ageMax}`);
    }

    // 2. Get swipes
    const swipes = await prisma.datingSwipe.findMany({
        where: { swiperId: myProfile.id },
        select: { targetId: true }
    });
    console.log(`\n📊 SWIPES MADE: ${swipes.length}`);

    // 3. Simulate the exact query from the backend
    const prefs = myProfile.preference || {};
    const interestedGenders = prefs.interestedInGender || [];
    const ageMin = prefs.ageMin || 18;
    const ageMax = prefs.ageMax || 100;

    console.log(`\n🔎 FILTER VALUES:`);
    console.log(`   interestedGenders: ${JSON.stringify(interestedGenders)}`);
    console.log(`   interestedGenders.length: ${interestedGenders.length}`);
    console.log(`   Age range: ${ageMin}-${ageMax}`);

    // Calculate age dates
    const today = new Date();
    const minDate = new Date(today.getFullYear() - ageMax - 1, today.getMonth(), today.getDate());
    const maxDate = new Date(today.getFullYear() - ageMin, today.getMonth(), today.getDate());

    console.log(`   Birth date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);

    // Build the exact filter
    const whereClause = {
        id: { notIn: [myProfile.id, ...swipes.map(s => s.targetId)] },
        isProfileVisible: true,
        isPaused: false,
        birthDate: {
            gte: minDate,
            lte: maxDate
        },
        ...(interestedGenders.length > 0 && {
            gender: { in: interestedGenders }
        }),
    };

    console.log(`\n📋 WHERE CLAUSE:`);
    console.log(JSON.stringify(whereClause, null, 2));

    // 4. Run the query
    const candidates = await prisma.datingProfile.findMany({
        where: whereClause,
        include: {
            user: { select: { fullName: true } },
            photos: { where: { isMain: true }, take: 1 }
        }
    });

    console.log(`\n✅ QUERY RESULT: ${candidates.length} profiles found`);

    if (candidates.length > 0) {
        console.log(`\n📝 PROFILES:`);
        candidates.forEach(p => {
            console.log(`   • ${p.user.fullName} (${p.gender}, age: ${calculateAge(p.birthDate)})`);
        });
    } else {
        console.log(`\n❌ NO PROFILES RETURNED!`);

        // Debug: Check all profiles BEFORE filters
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
                birthDate: true,
                user: { select: { fullName: true } }
            }
        });

        console.log(`\n🔍 DEBUG - All visible profiles (${allProfiles.length}):`);
        allProfiles.forEach(p => {
            const age = calculateAge(p.birthDate);
            const matchesGender = interestedGenders.length === 0 || interestedGenders.includes(p.gender);
            const matchesAge = age >= ageMin && age <= ageMax;
            console.log(`   • ${p.user.fullName} (${p.gender}, ${age}yo) - Gender: ${matchesGender ? '✅' : '❌'}, Age: ${matchesAge ? '✅' : '❌'}`);
        });
    }
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
