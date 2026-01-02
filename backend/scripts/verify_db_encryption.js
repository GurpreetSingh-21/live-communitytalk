// scripts/verify_db_encryption.js
const prisma = require('../prisma/client');

async function main() {
  console.log("🔍 Checking latest Direct Messages for encryption...");
  
  const messages = await prisma.directMessage.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      fromId: true,
      toId: true,
      createdAt: true
    }
  });

  if (messages.length === 0) {
    console.log("⚠️ No messages found.");
    return;
  }

  console.log("\n--- Latest 5 Messages ---");
  messages.forEach(m => {
    const isEncrypted = m.content.length > 50 && !m.content.includes(" ");
    console.log(`[${m.createdAt.toISOString()}] From: ${m.fromId.slice(0,5)}... Content: "${m.content.slice(0, 30)}..." -> ${isEncrypted ? "🔒 LIKELY ENCRYPTED" : "🔓 PLAIN TEXT"}`);
  });
  console.log("-------------------------");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
