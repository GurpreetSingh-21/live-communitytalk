// backend/scripts/cleanupOldEncryptedMessages.js
// Deletes old encrypted DirectMessages that can't be decrypted due to key changes

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupOldEncryptedMessages() {
  try {
    console.log('🔍 Checking for old encrypted messages...\n');

    // Find all encrypted messages created before today
    const oldMessages = await prisma.directMessage.findMany({
      where: {
        isEncrypted: true,
        createdAt: {
          lt: new Date('2026-01-08T19:00:00Z') // Before today (adjust if needed)
        }
      },
      select: {
        id: true,
        fromId: true,
        toId: true,
        createdAt: true,
        content: true
      }
    });

    console.log(`📊 Found ${oldMessages.length} old encrypted messages\n`);

    if (oldMessages.length === 0) {
      console.log('✅ No old encrypted messages to delete!');
      return;
    }

    // Show sample
    console.log('Sample messages that will be deleted:');
    oldMessages.slice(0, 5).forEach((msg, i) => {
      console.log(`  ${i + 1}. ID: ${msg.id.substring(0, 8)}... | Created: ${msg.createdAt.toISOString()}`);
    });
    console.log('');

    // Delete them
    console.log(`🗑️  Deleting ${oldMessages.length} messages...\n`);
    
    const result = await prisma.directMessage.deleteMany({
      where: {
        isEncrypted: true,
        createdAt: {
          lt: new Date('2026-01-08T19:00:00Z')
        }
      }
    });

    console.log(`✅ Successfully deleted ${result.count} encrypted messages!`);
    console.log('🎉 DM inbox is now clean!\n');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupOldEncryptedMessages();
