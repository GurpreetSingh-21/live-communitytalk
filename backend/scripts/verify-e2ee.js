// backend/scripts/verify-e2ee.js
// Verification script to check E2EE is working by examining database content

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyE2EE() {
    console.log('🔐 E2EE Verification Script\n' + '='.repeat(50) + '\n');

    try {
        // 1. Check users with public keys
        const usersWithKeys = await prisma.user.findMany({
            where: { publicKey: { not: null } },
            select: { id: true, fullName: true, email: true, publicKey: true }
        });

        console.log(`📋 Users with E2EE public keys: ${usersWithKeys.length}`);
        for (const u of usersWithKeys) {
            const shortKey = u.publicKey?.substring(0, 20) + '...';
            console.log(`   ✅ ${u.fullName || u.email} → ${shortKey}`);
        }
        console.log('');

        // 2. Check encrypted messages
        const encryptedMsgs = await prisma.directMessage.findMany({
            where: { isEncrypted: true },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                content: true,
                isEncrypted: true,
                createdAt: true,
                from: { select: { fullName: true } },
                to: { select: { fullName: true } }
            }
        });

        console.log(`🔒 Encrypted messages in database: ${encryptedMsgs.length}`);
        for (const m of encryptedMsgs) {
            const preview = m.content?.substring(0, 50) + (m.content?.length > 50 ? '...' : '');
            const isBase64 = /^[A-Za-z0-9+/=]+$/.test(m.content || '');
            console.log(`   ${isBase64 ? '🔐' : '⚠️'} [${m.from?.fullName} → ${m.to?.fullName}]`);
            console.log(`      Content: ${preview}`);
            console.log(`      Looks encrypted (Base64): ${isBase64 ? 'Yes' : 'NO - plaintext!'}`);
        }
        console.log('');

        // 3. Check unencrypted messages (for comparison)
        const unencryptedMsgs = await prisma.directMessage.findMany({
            where: { isEncrypted: false },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
                id: true,
                content: true,
                isEncrypted: true,
                createdAt: true,
            }
        });

        console.log(`📝 Recent unencrypted messages: ${unencryptedMsgs.length}`);
        for (const m of unencryptedMsgs) {
            const preview = m.content?.substring(0, 40) + (m.content?.length > 40 ? '...' : '');
            console.log(`   📄 "${preview}"`);
        }
        console.log('');

        // Summary
        console.log('='.repeat(50));
        console.log('📊 Summary:');
        console.log(`   Users with keys: ${usersWithKeys.length}`);
        console.log(`   Encrypted DMs: ${encryptedMsgs.length}`);
        console.log(`   Unencrypted DMs: ${unencryptedMsgs.length}`);

        if (usersWithKeys.length === 0) {
            console.log('\n⚠️  No users have public keys yet. Login to the app to generate one!');
        }
        if (encryptedMsgs.length === 0 && usersWithKeys.length >= 2) {
            console.log('\n⚠️  No encrypted messages yet. Send a DM between two users with keys!');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

verifyE2EE();
