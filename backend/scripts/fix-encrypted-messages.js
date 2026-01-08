// Fix old encrypted messages that can't be decrypted
// Run with: node scripts/fix-encrypted-messages.js

const prisma = require('../prisma/client');

async function main() {
    console.log('Checking messages with isEncrypted=true...\n');

    const encryptedMsgs = await prisma.directMessage.findMany({
        where: { isEncrypted: true },
        select: { id: true, content: true, createdAt: true }
    });

    console.log(`Found ${encryptedMsgs.length} encrypted messages\n`);

    // Check if they look like real encrypted data (base64, no spaces)
    for (const msg of encryptedMsgs) {
        const content = msg.content || '';
        const looksEncrypted = content.length > 40 && !content.includes(' ') && /^[A-Za-z0-9+/=]+$/.test(content);
        console.log(`${msg.createdAt.toISOString()} - looksEncrypted: ${looksEncrypted} - "${content.substring(0, 50)}..."`);
    }

    console.log('\n--- To mark all old encrypted messages as unencrypted, run: ---');
    console.log('prisma.directMessage.updateMany({ where: { isEncrypted: true }, data: { isEncrypted: false } })');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
