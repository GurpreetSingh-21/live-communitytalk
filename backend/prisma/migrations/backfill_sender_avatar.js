// backend/prisma/migrations/backfill_sender_avatar.js
// Run this script AFTER running the Prisma migration to backfill existing messages

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillSenderAvatar() {
  console.log('🚀 Starting avatar backfill for existing messages...');
  
  const batchSize = 100;
  let processedCount = 0;
  let totalMessages = 0;
  
  try {
    // First, count total messages needing backfill
    totalMessages = await prisma.message.count({
      where: {
        OR: [
          { senderAvatar: null },
          { senderAvatar: '' }
        ]
      }
    });
    
    console.log(`📊 Found ${totalMessages} messages needing avatar backfill`);
    
    if (totalMessages === 0) {
      console.log('✅ No messages need backfilling!');
      return;
    }
    
    // Process in batches
    while (true) {
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderAvatar: null },
            { senderAvatar: '' }
          ]
        },
        take: batchSize,
        include: { sender: { select: { avatar: true } } }
      });
      
      if (messages.length === 0) break;
      
      // Update in parallel (within batch)
      await Promise.all(
        messages.map(msg =>
          prisma.message.update({
            where: { id: msg.id },
            data: { senderAvatar: msg.sender?.avatar || '/default-avatar.png' }
          })
        )
      );
      
      processedCount += messages.length;
      const progress = ((processedCount / totalMessages) * 100).toFixed(1);
      console.log(`⏳ Progress: ${processedCount}/${totalMessages} (${progress}%)`);
    }
    
    console.log(`\n✅ Backfill complete! Updated ${processedCount} messages.`);
    console.log('🎉 All messages now have avatars!');
    
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillSenderAvatar();
