const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'gurpreet.singh138@qmail.cuny.edu';
  
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.log('User not found');
    return;
  }
  
  await prisma.user.update({
    where: { id: user.id },
    data: { fullName: 'Senior Developer' }
  });
  
  await prisma.member.updateMany({
    where: { userId: user.id },
    data: { name: 'Senior Developer' }
  });
  
  console.log('Updated user and their memberships to "Senior Developer"');
}

main().catch(console.error).finally(() => prisma.$disconnect());
