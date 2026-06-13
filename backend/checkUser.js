const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { contains: 'gurpreet.singh138' } }
  });
  console.log('User fullName in DB:', user?.fullName);
  console.log('User email in DB:', user?.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
