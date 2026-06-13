const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const indias = await prisma.community.findMany({ where: { name: { contains: 'india', mode: 'insensitive' } } });
  console.log('India Communities:');
  indias.forEach(c => console.log(c.id, c.name, c.imageUrl));
}

main().catch(console.error).finally(() => prisma.$disconnect());
