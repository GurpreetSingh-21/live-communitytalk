const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'gurpreet.singh138@qmail.cuny.edu';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  const profile = await prisma.datingProfile.findUnique({ where: { userId: user.id } });
  if (profile) {
    console.log('DatingProfile found:');
    console.log('gradYear:', profile.gradYear);
    console.log('greekLife:', profile.greekLife);
  } else {
    console.log('No dating profile found for this user.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
