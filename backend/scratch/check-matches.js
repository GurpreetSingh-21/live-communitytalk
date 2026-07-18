// backend/scratch/check-matches.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.datingMatch.findMany({
    include: {
      profile1: { include: { user: true } },
      profile2: { include: { user: true } }
    }
  });

  console.log("=== ALL DATING MATCHES ===");
  for (const m of matches) {
    console.log(`Match ID: ${m.id}`);
    console.log(`  Profile 1: ${m.profile1.firstName} (${m.profile1.user.email}) - ID: ${m.profile1.id}`);
    console.log(`  Profile 2: ${m.profile2.firstName} (${m.profile2.user.email}) - ID: ${m.profile2.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
