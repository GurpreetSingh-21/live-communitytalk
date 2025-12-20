const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const POSES = [
    {
        name: 'Peace Sign',
        instruction: 'Hold up two fingers (Peace Sign) near your face.',
        referenceImageUrl: 'https://em-content.zobj.net/source/apple/391/victory-hand_270c-fe0f.png' // Utilizing emoji as simple reference for now, or placeholder
    },
    {
        name: 'Thumbs Up',
        instruction: 'Give a Thumbs Up gesture near your shoulder.',
        referenceImageUrl: 'https://em-content.zobj.net/source/apple/391/thumbs-up_1f44d.png'
    },
    {
        name: 'Hand on Head',
        instruction: 'Place your hand flat on top of your head.',
        referenceImageUrl: 'https://em-content.zobj.net/source/apple/391/person-gesturing-ok_1f646.png' // Approximation
    },
    {
        name: 'Waving',
        instruction: 'Wave your hand open palm towards the camera.',
        referenceImageUrl: 'https://em-content.zobj.net/source/apple/391/waving-hand_1f44b.png'
    }
];

async function main() {
    console.log('🌱 Seeding Verification Poses...');

    for (const pose of POSES) {
        const existing = await prisma.verificationPose.findFirst({
            where: { name: pose.name }
        });

        if (!existing) {
            await prisma.verificationPose.create({
                data: pose
            });
            console.log(`✅ Created pose: ${pose.name}`);
        } else {
            console.log(`ℹ️ Pose already exists: ${pose.name}`);
        }
    }

    console.log('✨ Verification Poses Seeded');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
