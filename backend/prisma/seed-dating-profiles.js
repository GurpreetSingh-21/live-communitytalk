// backend/prisma/seed-dating-profiles.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const TEST_PROFILES = [
    {
        fullName: 'Emma Rodriguez',
        firstName: 'Emma',
        email: 'emma.test@qmail.cuny.edu',
        bio: 'Coffee enthusiast ☕ | Psychology major | Love hiking and board games',
        gender: 'FEMALE',
        lookingFor: ['MALE'],
        age: 21,
        photos: [
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
            'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
        ],
    },
    {
        fullName: 'Marcus Johnson',
        firstName: 'Marcus',
        email: 'marcus.test@qmail.cuny.edu',
        bio: 'Engineering student 🔧 | Gym rat 💪 | Looking for someone to explore NYC with',
        gender: 'MALE',
        lookingFor: ['FEMALE'],
        age: 23,
        photos: [
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
        ],
    },
    {
        fullName: 'Aisha Patel',
        firstName: 'Aisha',
        email: 'aisha.test@qmail.cuny.edu',
        bio: 'Pre-med student 🩺 | Foodie | Netflix binger | Dog lover 🐕',
        gender: 'FEMALE',
        lookingFor: ['MALE'],
        age: 20,
        photos: [
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
            'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400',
        ],
    },
    {
        fullName: 'James Chen',
        firstName: 'James',
        email: 'james.test@qmail.cuny.edu',
        bio: 'Computer Science 💻 | Gamer | Love trying new restaurants | Sarcasm is my love language',
        gender: 'MALE',
        lookingFor: ['FEMALE'],
        age: 22,
        photos: [
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
            'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
        ],
    },
    {
        fullName: 'Sofia Martinez',
        firstName: 'Sofia',
        email: 'sofia.test@qmail.cuny.edu',
        bio: 'Art History major 🎨 | Museum hopper | Poetry lover | Always down for spontaneous adventures',
        gender: 'FEMALE',
        lookingFor: ['MALE'],
        age: 21,
        photos: [
            'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400',
            'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400',
        ],
    },
    {
        fullName: 'Tyler Williams',
        firstName: 'Tyler',
        email: 'tyler.test@qmail.cuny.edu',
        bio: 'Business major 📊 | Basketball player 🏀 | Aspiring entrepreneur | Pizza connoisseur',
        gender: 'MALE',
        lookingFor: ['FEMALE'],
        age: 24,
        photos: [
            'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400',
            'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400',
        ],
    },
    {
        fullName: 'Priya Singh',
        firstName: 'Priya',
        email: 'priya.test@qmail.cuny.edu',
        bio: 'Finance student 💰 | Yoga enthusiast 🧘‍♀️ | Loves concerts and festivals | Chai addict',
        gender: 'FEMALE',
        lookingFor: ['MALE'],
        age: 22,
        photos: [
            'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?w=400',
            'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
        ],
    },
    {
        fullName: 'Alex Thompson',
        firstName: 'Alex',
        email: 'alex.test@qmail.cuny.edu',
        bio: 'Music Production 🎵 | DJ on weekends | Coffee shop regular | Looking for my concert buddy',
        gender: 'MALE',
        lookingFor: ['FEMALE'],
        age: 23,
        photos: [
            'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400',
            'https://images.unsplash.com/photo-1489980557514-251d61e3eeb6?w=400',
        ],
    },
];

async function main() {
    console.log('🌱 Starting dating profile seed...');

    const password = await bcrypt.hash('Test123!', 10);

    for (const profile of TEST_PROFILES) {
        console.log(`\n📝 Creating profile for ${profile.fullName}...`);

        try {
            // Create user
            const user = await prisma.user.create({
                data: {
                    fullName: profile.fullName,
                    email: profile.email,
                    password,
                    emailVerified: true,
                    collegeName: 'Queens College',
                    collegeSlug: 'qc',
                    hasDatingProfile: true,
                    accountStatus: 'ACTIVE',
                    profileVerified: true,
                    photoVerified: true,
                },
            });

            console.log(`  ✅ User created: ${user.id}`);

            // Calculate birthDate for the given age
            const birthDate = new Date();
            birthDate.setFullYear(birthDate.getFullYear() - profile.age);

            // Create dating profile
            const datingProfile = await prisma.datingProfile.create({
                data: {
                    userId: user.id,
                    firstName: profile.firstName,
                    birthDate,
                    gender: profile.gender,
                    bio: profile.bio,
                    collegeSlug: 'qc',
                    major: 'Various',
                    year: 'JUNIOR',
                    lookingFor: profile.lookingFor,
                    hobbies: ['Music', 'Food', 'Travel', 'Art'],
                    isProfileVisible: true,
                    isPaused: false,
                    approvalStatus: 'APPROVED',
                },
            });

            console.log(`  ✅ Dating profile created: ${datingProfile.id}`);

            // Create photos (all APPROVED so they're visible)
            for (let i = 0; i < profile.photos.length; i++) {
                const photo = await prisma.datingPhoto.create({
                    data: {
                        datingProfileId: datingProfile.id,
                        url: profile.photos[i],
                        thumbnail: profile.photos[i],
                        order: i,
                        status: 'APPROVED', // Pre-approved for testing
                        isMain: i === 0, // First photo is main
                        reviewedBy: user.id,
                        reviewedAt: new Date(),
                    },
                });

                console.log(`  ✅ Photo ${i + 1} added (${photo.status})`);
            }

            console.log(`✨ ${profile.fullName} complete!`);
        } catch (err) {
            console.error(`  ❌ Failed to create ${profile.fullName}:`, err.message);
            // Continue with next profile
        }
    }

    console.log('\n🎉 Seed complete!');
    console.log('\n📋 Test Account Credentials:');
    console.log('   Email: <any of the above>@qmail.cuny.edu');
    console.log('   Password: Test123!');
    console.log('\n💡 All photos are pre-approved and ready to view!');
}

main()
    .catch((e) => {
        console.error('❌ Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
