// Check if messages are actually encrypted (ciphertext) in DB
const prisma = require('../prisma/client');

async function checkEncryption() {
  try {
    const messages = await prisma.directMessage.findMany({
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        content: true,
        type: true,
        createdAt: true
      }
    });
    
    console.log('🔍 Checking if messages are encrypted in database:\n');
    messages.forEach((msg, idx) => {
      const isLikelyEncrypted = msg.content && msg.content.length > 40 && !msg.content.includes(' ');
      console.log(`${idx + 1}. Content: "${msg.content}"`);
      console.log(`   Type: ${msg.type}`);
      console.log(`   Encrypted: ${isLikelyEncrypted ? '✅ YES (looks like base64)' : '❌ NO (plaintext)'}\n`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEncryption();
