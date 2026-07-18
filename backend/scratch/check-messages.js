// backend/scratch/check-messages.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dms = await prisma.directMessage.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log("=== RECENT DIRECT MESSAGES ===");
  for (const dm of dms) {
    console.log(`From: ${dm.fromId} | To: ${dm.toId} | Content: ${dm.content} | Context: ${dm.context}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
