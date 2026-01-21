// CommunityTalkMobile/src/utils/e2ee.ts
// End-to-End Encryption utilities using TweetNaCl (X25519 + XSalsa20-Poly1305)

// 🔐 CRITICAL: Import PRNG polyfill FIRST (needed for nacl.randomBytes on React Native)
import 'react-native-get-random-values';

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import { e2eeLogger as logger } from './logger';

const LEGACY_PUB_KEY = 'e2ee_public_key';
const LEGACY_SEC_KEY = 'e2ee_secret_key';

const getKeyKeys = (userId: string) => ({
  PUB: `e2ee_pub_${userId}`,
  SEC: `e2ee_sec_${userId}`
});

// Backup metadata keys
const getBackupKey = (userId: string) => `e2ee_backup_${userId}`;

/**
 * Get or create the user's X25519 keypair.
 * Public key is safe to share. Private key NEVER leaves the device.
 * Scoped by userId to allow multiple accounts on same device.
 */
export async function getOrCreateKeyPair(userId: string): Promise<{ publicKey: string; secretKey: string }> {
  if (!userId) throw new Error('getOrCreateKeyPair requires userId');
  
  const { PUB, SEC } = getKeyKeys(userId);

  // 1. Check specific keys
  const existingPub = await SecureStore.getItemAsync(PUB);
  const existingSec = await SecureStore.getItemAsync(SEC);

  if (existingPub && existingSec) {
    console.log(`🔐 [E2EE] ✅ Found existing keypair for user ${userId.substring(0, 8)}...`);
    return { publicKey: existingPub, secretKey: existingSec };
  }

  // 2. Check legacy keys (Migration)
  const legacyPub = await SecureStore.getItemAsync(LEGACY_PUB_KEY);
  const legacySec = await SecureStore.getItemAsync(LEGACY_SEC_KEY);

  if (legacyPub && legacySec) {
    console.log(`🔐 [E2EE] 🔄 Migrating legacy keys to user ${userId.substring(0, 8)}...`);
    logger.info(`Migrating legacy keys to user ${userId}...`);
    await SecureStore.setItemAsync(PUB, legacyPub);
    await SecureStore.setItemAsync(SEC, legacySec);
    
    // Clean up legacy (safe because we copied them)
    await SecureStore.deleteItemAsync(LEGACY_PUB_KEY);
    await SecureStore.deleteItemAsync(LEGACY_SEC_KEY);
    
    console.log(`🔐 [E2EE] ✅ Legacy keys migrated successfully`);
    return { publicKey: legacyPub, secretKey: legacySec };
  }

  // 3. Generate new keypair
  console.log(`🔐 [E2EE] 🆕 Generating NEW keypair for user ${userId.substring(0, 8)}...`);
  const kp = nacl.box.keyPair();
  const publicKey = encodeBase64(kp.publicKey);
  const secretKey = encodeBase64(kp.secretKey);

  await SecureStore.setItemAsync(PUB, publicKey);
  await SecureStore.setItemAsync(SEC, secretKey);

  console.log(`🔐 [E2EE] ✅ Keypair generated and stored locally`);
  console.log(`🔐 [E2EE] 📤 Public key: ${publicKey.substring(0, 20)}...`);
  logger.info(`New keypair generated for user ${userId}`);
  return { publicKey, secretKey };
}

/**
 * Get the current user's public key (for uploading to server)
 */
export async function getPublicKey(userId: string): Promise<string | null> {
  if (!userId) return null;
  const { PUB } = getKeyKeys(userId);
  return await SecureStore.getItemAsync(PUB);
}

/**
 * Get the current user's private key (for decryption, never share)
 */
async function getSecretKey(userId: string): Promise<string | null> {
  if (!userId) return null;
  const { SEC } = getKeyKeys(userId);
  return await SecureStore.getItemAsync(SEC);
}

/**
 * Encrypt a message for a recipient using their public key.
 * Uses NaCl box (X25519 + XSalsa20-Poly1305).
 * 
 * @param plainText - The message to encrypt
 * @param recipientPublicKeyB64 - Recipient's public key (base64)
 * @param senderUserId - ID of the sender (to retrieve private key)
 * @returns Base64-encoded ciphertext (nonce + encrypted), or null on failure
 */
export async function encryptMessage(
  plainText: string,
  recipientPublicKeyB64: string,
  senderUserId: string
): Promise<string | null> {
  if (!plainText || !recipientPublicKeyB64 || !senderUserId) return null;

  try {
    const secretKey = await getSecretKey(senderUserId);
    if (!secretKey) throw new Error(`No private key found for user ${senderUserId}`);

    // Compute shared key using Diffie-Hellman
    const sharedKey = nacl.box.before(
      decodeBase64(recipientPublicKeyB64),
      decodeBase64(secretKey)
    );

    // Generate random nonce (24 bytes)
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    // Encode message as Uint8Array
    const messageUint8 = new TextEncoder().encode(plainText);

    // Encrypt with precomputed shared key
    const encrypted = nacl.box.after(messageUint8, nonce, sharedKey);
    if (!encrypted) throw new Error('Encryption failed');

    // Pack: nonce (24 bytes) + ciphertext
    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    return encodeBase64(fullMessage);
  } catch (err) {
    logger.warn('Encrypt failed:', err);
    return null;
  }
}

/**
 * Decrypt a message from a sender using their public key.
 * 
 * @param cipherTextB64 - Base64-encoded ciphertext (nonce + encrypted)
 * @param senderPublicKeyB64 - Sender's public key (base64)
 * @param recipientUserId - ID of the recipient (current user trying to decrypt)
 * @returns Decrypted plaintext, or fallback string on failure
 */
export async function decryptMessage(
  cipherTextB64: string,
  senderPublicKeyB64: string,
  recipientUserId: string
): Promise<string> {
  if (!cipherTextB64 || !senderPublicKeyB64 || !recipientUserId) {
    // logger.warn('Missing input for decrypt');
    return '[Locked]'; // Using specific code? or just Locked.
  }

  try {
    const secretKey = await getSecretKey(recipientUserId);
    if (!secretKey) {
      logger.warn(`No secret key found for user ${recipientUserId}`);
      return '[No Key]';
    }

    // 🚀 PERFORMANCE: Only log in dev mode
    // logger.debug('Decrypting...');

    const messageWithNonce = decodeBase64(cipherTextB64);
    if (messageWithNonce.length < nacl.box.nonceLength) {
      return '[Corrupt]';
    }

    // Extract nonce (first 24 bytes) and ciphertext
    const nonce = messageWithNonce.slice(0, nacl.box.nonceLength);
    const ciphertext = messageWithNonce.slice(nacl.box.nonceLength);

    // Compute shared key
    const sharedKey = nacl.box.before(
      decodeBase64(senderPublicKeyB64),
      decodeBase64(secretKey)
    );

    // Decrypt with precomputed shared key
    const decrypted = nacl.box.open.after(ciphertext, nonce, sharedKey);
    if (!decrypted) {
      // Don't spam "FAILED" logs for expected old keys
      // logger.warn('Decryption failed (key mismatch)'); 
      return '[Decryption Failed]';
    }

    const result = new TextDecoder().decode(decrypted);
    return result;
  } catch (err) {
    logger.error('Decrypt Exception:', err);
    return '[Error]';
  }
}

/**
 * Check if we have a valid keypair stored
 */
export async function hasKeyPair(userId: string): Promise<boolean> {
  if (!userId) return false;
  const { PUB, SEC } = getKeyKeys(userId);
  const pub = await SecureStore.getItemAsync(PUB);
  const sec = await SecureStore.getItemAsync(SEC);
  return !!(pub && sec);
}

/**
 * Clear all E2EE keys for specific user
 */
export async function clearKeys(userId: string): Promise<void> {
  if (!userId) return;
  const { PUB, SEC } = getKeyKeys(userId);
  await SecureStore.deleteItemAsync(PUB);
  await SecureStore.deleteItemAsync(SEC);
  logger.info(`Keys cleared for user ${userId}`);
}

/**
 * Force regenerate keypair for user
 */
export async function forceRegenerateKeyPair(userId: string): Promise<{ publicKey: string; secretKey: string }> {
  logger.info(`Force regenerating keypair for ${userId}...`);
  await clearKeys(userId);
  return await getOrCreateKeyPair(userId);
}

/**
 * Ensure keys exist - regenerate if missing
 */
export async function ensureKeyPair(userId: string): Promise<{ publicKey: string; secretKey: string }> {
  if (await hasKeyPair(userId)) {
    const { PUB, SEC } = getKeyKeys(userId);
    const publicKey = (await SecureStore.getItemAsync(PUB))!;
    const secretKey = (await SecureStore.getItemAsync(SEC))!;
    return { publicKey, secretKey };
  }
  return await forceRegenerateKeyPair(userId);
}

// ───────────────────────── Automatic Identity Backup (no user passphrase) ─────────────────────────
export type AutoBackupBlob = {
  version: 2;
  secretKeyB64: string;
};

/**
 * Create a simple automatic backup of the user's identity private key.
 * NOTE: This means the backend can theoretically read DMs if compromised,
 * but it keeps restore 100% automatic for users.
 */
export async function createAutoIdentityBackup(userId: string): Promise<AutoBackupBlob | null> {
  if (!userId) {
    console.log(`🔐 [E2EE Backup] ❌ No userId provided`);
    return null;
  }
  const { SEC } = getKeyKeys(userId);
  const secretKeyB64 = await SecureStore.getItemAsync(SEC);
  if (!secretKeyB64) {
    console.log(`🔐 [E2EE Backup] ❌ No secret key found for user ${userId.substring(0, 8)}`);
    return null;
  }
  console.log(`🔐 [E2EE Backup] 📦 Creating automatic backup for user ${userId.substring(0, 8)}...`);
  const backup = { version: 2, secretKeyB64 };
  console.log(`🔐 [E2EE Backup] ✅ Backup blob created (version 2, auto)`);
  return backup;
}

/**
 * Restore identity private key from an automatic backup blob (no passphrase).
 */
export async function restoreIdentityFromAutoBackup(
  userId: string,
  blob: AutoBackupBlob
): Promise<{ publicKey: string; secretKey: string } | null> {
  if (!userId || !blob || !blob.secretKeyB64) {
    console.log(`🔐 [E2EE Backup] ❌ Invalid restore parameters`);
    return null;
  }
  try {
    console.log(`🔐 [E2EE Backup] 🔄 Restoring identity from backup for user ${userId.substring(0, 8)}...`);
    const secretKeyB64 = blob.secretKeyB64;
    const secretKeyBytes = decodeBase64(secretKeyB64);
    const kp = nacl.box.keyPair.fromSecretKey(secretKeyBytes);
    const publicKeyB64 = encodeBase64(kp.publicKey);

    const { PUB, SEC } = getKeyKeys(userId);
    await SecureStore.setItemAsync(PUB, publicKeyB64);
    await SecureStore.setItemAsync(SEC, secretKeyB64);
    await SecureStore.setItemAsync(getBackupKey(userId), JSON.stringify(blob));

    console.log(`🔐 [E2EE Backup] ✅ Identity restored successfully`);
    console.log(`🔐 [E2EE Backup] 📤 Restored public key: ${publicKeyB64.substring(0, 20)}...`);
    return { publicKey: publicKeyB64, secretKey: secretKeyB64 };
  } catch (err) {
    console.error(`🔐 [E2EE Backup] ❌ Restore failed:`, err);
    logger.error('E2EE restoreIdentityFromAutoBackup failed', err);
    return null;
  }
}
