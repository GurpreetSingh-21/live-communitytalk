// CommunityTalkMobile/src/utils/e2ee.ts
// End-to-End Encryption utilities using TweetNaCl (X25519 + XSalsa20-Poly1305)

// 🔐 CRITICAL: Import PRNG polyfill FIRST (needed for nacl.randomBytes on React Native)
import 'react-native-get-random-values';

import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import { e2eeLogger as logger } from './logger';

const PUB_KEY = 'e2ee_public_key';
const SEC_KEY = 'e2ee_secret_key';

/**
 * Get or create the user's X25519 keypair.
 * Public key is safe to share. Private key NEVER leaves the device.
 */
export async function getOrCreateKeyPair(): Promise<{ publicKey: string; secretKey: string }> {
  const existingPub = await SecureStore.getItemAsync(PUB_KEY);
  const existingSec = await SecureStore.getItemAsync(SEC_KEY);

  if (existingPub && existingSec) {
    return { publicKey: existingPub, secretKey: existingSec };
  }

  // Generate new keypair
  const kp = nacl.box.keyPair();
  const publicKey = encodeBase64(kp.publicKey);
  const secretKey = encodeBase64(kp.secretKey);

  await SecureStore.setItemAsync(PUB_KEY, publicKey);
  await SecureStore.setItemAsync(SEC_KEY, secretKey);

  logger.info('New keypair generated');
  return { publicKey, secretKey };
}

/**
 * Get the current user's public key (for uploading to server)
 */
export async function getPublicKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(PUB_KEY);
}

/**
 * Get the current user's private key (for decryption, never share)
 */
async function getSecretKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(SEC_KEY);
}

/**
 * Encrypt a message for a recipient using their public key.
 * Uses NaCl box (X25519 + XSalsa20-Poly1305).
 * 
 * @param plainText - The message to encrypt
 * @param recipientPublicKeyB64 - Recipient's public key (base64)
 * @returns Base64-encoded ciphertext (nonce + encrypted), or null on failure
 */
export async function encryptMessage(
  plainText: string,
  recipientPublicKeyB64: string
): Promise<string | null> {
  if (!plainText || !recipientPublicKeyB64) return null;

  try {
    const secretKey = await getSecretKey();
    if (!secretKey) throw new Error('No private key found');

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
 * @returns Decrypted plaintext, or fallback string on failure
 */
export async function decryptMessage(
  cipherTextB64: string,
  senderPublicKeyB64: string
): Promise<string> {
  if (!cipherTextB64 || !senderPublicKeyB64) {
    logger.warn('Missing input - cipher:', !!cipherTextB64, 'publicKey:', !!senderPublicKeyB64);
    return '[Locked]';
  }

  try {
    const secretKey = await getSecretKey();
    if (!secretKey) {
      logger.warn('No secret key found in SecureStore');
      return '[No Key]';
    }

    // 🚀 PERFORMANCE: Only log in dev mode
    logger.debug('Input:', {
      cipherLen: cipherTextB64.length,
      pubKeyLen: senderPublicKeyB64.length
    });

    const messageWithNonce = decodeBase64(cipherTextB64);
    if (messageWithNonce.length < nacl.box.nonceLength) {
      logger.error('Corrupt - message too short:', messageWithNonce.length, 'bytes');
      return '[Corrupt]';
    }

    // Extract nonce (first 24 bytes) and ciphertext
    const nonce = messageWithNonce.slice(0, nacl.box.nonceLength);
    const ciphertext = messageWithNonce.slice(nacl.box.nonceLength);

    logger.debug('Extracted - nonce:', nonce.length, 'bytes, cipher:', ciphertext.length, 'bytes');

    // Compute shared key
    const sharedKey = nacl.box.before(
      decodeBase64(senderPublicKeyB64),
      decodeBase64(secretKey)
    );

    logger.debug('Shared key computed, attempting decryption...');

    // Decrypt with precomputed shared key
    const decrypted = nacl.box.open.after(ciphertext, nonce, sharedKey);
    if (!decrypted) {
      logger.warn('FAILED - nacl.box.open.after returned null');
      logger.warn('This usually means key mismatch (old message?) or corrupted ciphertext');
      return '[Decryption Failed]';
    }

    const result = new TextDecoder().decode(decrypted);
    logger.debug('SUCCESS');
    return result;
  } catch (err) {
    logger.error('Exception:', err);
    return '[Error]';
  }
}

/**
 * Check if we have a valid keypair stored
 */
export async function hasKeyPair(): Promise<boolean> {
  const pub = await SecureStore.getItemAsync(PUB_KEY);
  const sec = await SecureStore.getItemAsync(SEC_KEY);
  return !!(pub && sec);
}

/**
 * Clear all E2EE keys (use with caution - all encrypted messages become unreadable!)
 */
export async function clearKeys(): Promise<void> {
  await SecureStore.deleteItemAsync(PUB_KEY);
  await SecureStore.deleteItemAsync(SEC_KEY);
  logger.info('Keys cleared');
}

/**
 * Force regenerate keypair (useful when device was reset or keys are out of sync)
 * This will create new keys even if old ones exist
 */
export async function forceRegenerateKeyPair(): Promise<{ publicKey: string; secretKey: string }> {
  logger.info('Force regenerating keypair...');

  // Clear old keys
  await SecureStore.deleteItemAsync(PUB_KEY);
  await SecureStore.deleteItemAsync(SEC_KEY);

  // Generate new keypair
  const kp = nacl.box.keyPair();
  const publicKey = encodeBase64(kp.publicKey);
  const secretKey = encodeBase64(kp.secretKey);

  await SecureStore.setItemAsync(PUB_KEY, publicKey);
  await SecureStore.setItemAsync(SEC_KEY, secretKey);

  logger.info('New keypair generated and stored');
  return { publicKey, secretKey };
}

/**
 * Ensure keys exist - regenerate if missing
 * Returns the keypair, regenerating if necessary
 */
export async function ensureKeyPair(): Promise<{ publicKey: string; secretKey: string }> {
  const existingPub = await SecureStore.getItemAsync(PUB_KEY);
  const existingSec = await SecureStore.getItemAsync(SEC_KEY);

  if (existingPub && existingSec) {
    logger.debug('Keys verified in SecureStore');
    return { publicKey: existingPub, secretKey: existingSec };
  }

  logger.warn('Keys missing! Regenerating...');
  return await forceRegenerateKeyPair();
}
