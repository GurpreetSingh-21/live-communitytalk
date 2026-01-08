// scripts/seedAdmin.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedAdmin() {
    try {
        // ⭐ EDIT THESE VALUES:
        const ADMIN_EMAIL = 'debugdragons4@gmail.com';  // Change this to your admin email
        const ADMIN_PASSWORD = 'campustry@2026verystrong1!';  // Change this to your secure password
        const ADMIN_NAME = 'Campustry Admin';  // Change this to admin's full name

        console.log('========================================');
        console.log('🌱 Seeding Admin User for Campustry');
        console.log('========================================\n');

        // Check if admin already exists
        const existing = await prisma.user.findUnique({
            where: { email: ADMIN_EMAIL }
        });

        if (existing) {
            console.log(`⚠️  Admin user with email ${ADMIN_EMAIL} already exists!`);
            console.log(`   User ID: ${existing.id}`);
            console.log(`   Role: ${existing.role}`);
            console.log('\n   If you want to reset the password, delete the user first.\n');
            return;
        }

        // Hash the password
        console.log('🔒 Hashing password...');
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

        // Create admin user
        console.log('👤 Creating admin user...');
        const admin = await prisma.user.create({
            data: {
                email: ADMIN_EMAIL,
                fullName: ADMIN_NAME,
                password: hashedPassword,  // ✅ Fixed: use 'password' not 'passwordHash'
                role: 'admin',
                emailVerified: true,
                isActive: true,
            }
        });

        console.log('\n✅ Admin user created successfully!');
        console.log('========================================');
        console.log(`📧 Email: ${admin.email}`);
        console.log(`👤 Name: ${admin.fullName}`);
        console.log(`🔑 ID: ${admin.id}`);
        console.log(`👑 Role: ${admin.role}`);
        console.log('========================================\n');
        console.log('🎉 You can now login to /admin/login with these credentials!\n');

    } catch (error) {
        console.error('\n❌ Error seeding admin user:');
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the seed function
seedAdmin();
