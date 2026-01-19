const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log("🌱 Seeding Dating Profiles...");

    const password = await bcrypt.hash("password123", 10);

    const MAJORS = ["Computer Science", "Psychology", "Business", "Biology", "Art History"];
    const YEARS = ["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR", "GRADUATE"];

    const FEMALE_NAMES = ["Sarah", "Emily", "Priya", "Jessica", "Mia", "Olivia", "Sophia", "Ava", "Isabella", "Aisha"];
    const MALE_NAMES = ["James", "Michael", "David", "John", "Robert", "William", "Joseph", "Charles", "Thomas", "Daniel"];

    const FEMALE_PHOTOS = [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=500&q=80",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80",
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&q=80",
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&q=80"
    ];

    const MALE_PHOTOS = [
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&q=80",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&q=80",
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&q=80",
        "https://images.unsplash.com/photo-1480455624313-e29b44bbfde1?w=500&q=80",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80"
    ];

    for (let i = 0; i < 50; i++) {
        const email = `testuser${Date.now()}_${i}@cuny.edu`;
        const gender = i % 2 === 0 ? "FEMALE" : "MALE";
        const firstName = gender === "FEMALE" ? FEMALE_NAMES[i % FEMALE_NAMES.length] : MALE_NAMES[i % MALE_NAMES.length];
        const mainPhoto = gender === "FEMALE" ? FEMALE_PHOTOS[i % FEMALE_PHOTOS.length] : MALE_PHOTOS[i % MALE_PHOTOS.length];
        const secondPhoto = gender === "FEMALE" ? FEMALE_PHOTOS[(i + 1) % FEMALE_PHOTOS.length] : MALE_PHOTOS[(i + 1) % MALE_PHOTOS.length];

        // 1. Create User
        const user = await prisma.user.create({
            data: {
                email,
                password,
                fullName: `${firstName} Test`,
                collegeName: "Queens College",
                collegeSlug: "queens-college",
                hasDatingProfile: true,
                emailVerified: true
            }
        });

        // 2. Create Dating Profile
        const yearEnum = YEARS[i % YEARS.length];

        await prisma.datingProfile.create({
            data: {
                userId: user.id,
                firstName: firstName,
                gender, // Enum
                birthDate: new Date("2002-01-01"),
                bio: `Just a dummy profile for ${firstName}. I love coding, coffee, and exploring campus.`,
                major: MAJORS[i % MAJORS.length],
                year: yearEnum,
                collegeSlug: "queens-college",
                isProfileVisible: true,
                photos: {
                    create: [
                        { url: mainPhoto, isMain: true, order: 0 },
                        { url: secondPhoto, isMain: false, order: 1 }
                    ]
                },
                preference: {
                    create: {
                        ageMin: 18,
                        ageMax: 30,
                        maxDistance: 50,
                        interestedInGender: [gender === "MALE" ? "FEMALE" : "MALE"] // Straight preference for testing
                    }
                }
            }
        });
        console.log(`Created user ${firstName} (${gender})`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
