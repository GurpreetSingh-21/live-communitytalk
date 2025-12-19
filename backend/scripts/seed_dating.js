const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

const DUMMY_PHOTOS = [
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&q=80",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&q=80"
];

async function main() {
    console.log("🌱 Seeding Dating Profiles...");

    const password = await bcrypt.hash("password123", 10);

    const MAJORS = ["Computer Science", "Psychology", "Business", "Biology", "Art History"];
    const YEARS = ["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR", "GRADUATE"]; // Enums

    for (let i = 0; i < 10; i++) {
        const email = `testuser${Date.now()}_${i}@cuny.edu`;

        // 1. Create User
        const user = await prisma.user.create({
            data: {
                email,
                password,
                fullName: `Test User ${i}`,
                collegeName: "Queens College",
                collegeSlug: "queens-college",
                hasDatingProfile: true,
                emailVerified: true
            }
        });

        // 2. Create Dating Profile
        const gender = i % 2 === 0 ? "FEMALE" : "MALE";
        const yearEnum = YEARS[i % YEARS.length];

        await prisma.datingProfile.create({
            data: {
                userId: user.id,
                firstName: `Alex ${i}`,
                gender, // Enum
                birthDate: new Date("2002-01-01"),
                bio: `Just a dummy profile ${i} for testing. I love coding and coffee.`,
                major: MAJORS[i % MAJORS.length],
                year: yearEnum,
                collegeSlug: "queens-college",
                isProfileVisible: true,
                photos: {
                    create: [
                        { url: DUMMY_PHOTOS[i % DUMMY_PHOTOS.length], isMain: true, order: 0 },
                        { url: DUMMY_PHOTOS[(i + 1) % DUMMY_PHOTOS.length], isMain: false, order: 1 }
                    ]
                },
                preference: {
                    create: {
                        ageMin: 18,
                        ageMax: 30,
                        maxDistance: 50,
                        interestedInGender: [i % 2 === 0 ? "MALE" : "FEMALE"] // Opposite logic for test
                    }
                }
            }
        });
        console.log(`Created user ${i} (${gender})`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
