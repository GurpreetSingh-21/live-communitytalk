// backend/prisma/seed-dating-simple.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Creating simplified test profiles...');

    const password = await bcrypt.hash('Test123!', 10);

    const profiles = [
        { name: 'Emma', gender: 'FEMALE', age: 21 },
        { name: 'Marcus', gender: 'MALE', age: 23 },
        { name: 'Aisha', gender: 'FEMALE', age: 20 },
        { name: 'James', gender: 'MALE', age: 22 },
        { name: 'Sofia', gender: 'FEMALE', age: 21 },
    ];

    for (const p of profiles) {
        try {
            const user = await prisma.user.create({
                data: {
                    fullName: p.name,
                    email: `${p.name.toLowerCase()}.test@qmail.cuny.edu`,
                    password,
                    emailVerified: true,
                    collegeName: 'Queens College',
                    collegeSlug: 'qc',
                    hasDatingProfile: true,
                    accountStatus: 'ACTIVE',
                },
            });

            const birthDate = new Date();
            birthDate.setFullYear(birthDate.getFullYear() - p.age);

            const profile = await prisma.datingProfile.create({
                data: {
                    userId: user.id,
                    firstName: p.name,
                    birthDate,
                    gender: p.gender,
                    bio: `Hey! I'm ${p.name}, nice to meet you! 👋`,
                    collegeSlug: 'qc',
                    major: 'Computer Science',
                    year: 'JUNIOR',
                    lookingFor: ['RELATIONSHIP', 'FRIENDS'],
                    hobbies: ['Music', 'Food', 'Travel'],
                    isProfileVisible: true,
                    approvalStatus: 'APPROVED',
                },
            });

            // Add one photo
            await prisma.datingPhoto.create({
                data: {
                    datingProfileId: profile.id,
                    url: `https://ui-avatars.com/api/?name=${p.name}&size=400&background=random`,
                    thumbnail: `https://ui-avatars.com/api/?name=${p.name}&size=200&background=random`,
                    order: 0,
                    status: 'APPROVED',
                    isMain: true,
                    reviewedBy: user.id,
                    reviewedAt: new Date(),
                },
            });

            console.log(`✅ Created ${p.name}`);
        } catch (err) {
            console.log(`⚠️  Skipped ${p.name} (may already exist)`);
        }
    }

    console.log('\n🎉 Done! Password for all: Test123!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
