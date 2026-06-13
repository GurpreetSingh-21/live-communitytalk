const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const indiaUrl = 'https://res.cloudinary.com/dnvq77awp/image/upload/v1781391264/community_avatars/countries/india.jpg';
  const queensUrl = 'https://res.cloudinary.com/dnvq77awp/image/upload/v1781391266/community_avatars/colleges/queens_college.png';

  const r1 = await prisma.community.updateMany({
    where: { name: { equals: 'india', mode: 'insensitive' } },
    data: { imageUrl: indiaUrl }
  });
  console.log(`Updated ${r1.count} 'India' communities`);

  const r2 = await prisma.community.updateMany({
    where: { name: { equals: 'queens college', mode: 'insensitive' } },
    data: { imageUrl: queensUrl }
  });
  console.log(`Updated ${r2.count} 'Queens College' communities`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
