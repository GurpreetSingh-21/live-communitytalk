// backend/scratch/check-swipes.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const swipes = await prisma.datingSwipe.findMany({});
  console.log("=== ALL SWIPES ===");
  console.log(swipes);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
