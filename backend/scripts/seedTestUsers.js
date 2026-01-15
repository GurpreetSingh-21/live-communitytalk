const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedTestUsers() {
  try {
    console.log('🌱 Seeding test users for Virginia Supabase...\n');

    const hashedPassword = await bcrypt.hash('Test123!', 10);
    
    // Create multiple test users
    const users = [
      {
        email: 'test@baruch.cuny.edu',
        fullName: 'Test Baruch',
        collegeName: 'Baruch College',
        collegeSlug: 'baruch',
      },
      {
        email: 'demo@brooklyn.cuny.edu',
        fullName: 'Demo Brooklyn',
        collegeName: 'Brooklyn College',
        collegeSlug: 'brooklyn',
      },
      {
        email: 'user@hunter.cuny.edu',
        fullName: 'User Hunter',
        collegeName: 'Hunter College',
        collegeSlug: 'hunter',
      },
    ];

    for (const userData of users) {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: {
          email: userData.email,
          fullName: userData.fullName,
          password: hashedPassword,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.fullName)}&background=random`,
          bio: `Test user from ${userData.collegeName}`,
          emailVerified: true,
          collegeName: userData.collegeName,
          collegeSlug: userData.collegeSlug,
        },
      });

      console.log(`✅ ${user.email} - ${user.fullName}`);
    }

    console.log(`\n🎉 Created ${users.length} test users!`);
    console.log(`📧 All users have password: Test123!\n`);
    
  } catch (error) {
    console.error('❌ Seeder Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestUsers();
