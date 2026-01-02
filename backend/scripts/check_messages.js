// Quick diagnostic: Check if DM messages exist in database
const prisma = require('../prisma/client');

async function checkMessages() {
  try {
    console.log('🔍 Checking DirectMessage table...\n');
    
    // Count all messages
    const totalCount = await prisma.directMessage.count();
    console.log(`📊 Total DM messages in database: ${totalCount}\n`);
    
    if (totalCount === 0) {
      console.log('❌ No messages found! Messages are not being saved.\n');
      return;
    }
    
    // Get last 5 messages
    const recentMessages = await prisma.directMessage.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fromId: true,
        toId: true,
        content: true,
        type: true,
        status: true,
        context: true,
        createdAt: true
      }
    });
    
    console.log('📝 Last 5 messages:\n');
    recentMessages.forEach((msg, idx) => {
      console.log(`${idx + 1}. [${msg.type}] ${msg.content?.substring(0, 50)}...`);
      console.log(`   From: ${msg.fromId} → To: ${msg.toId}`);
      console.log(`   Status: ${msg.status}, Context: ${msg.context}`);
      console.log(`   Created: ${msg.createdAt}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error checking messages:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMessages();
