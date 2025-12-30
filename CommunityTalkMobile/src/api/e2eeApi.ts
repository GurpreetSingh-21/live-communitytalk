// CommunityTalkMobile/src/api/e2eeApi.ts
// API functions for E2EE key management

import { api } from './api';

/**
 * Upload the user's public key to the server
 */
export async function uploadPublicKey(publicKey: string): Promise<boolean> {
  try {
    await api.put('/api/user/publicKey', { publicKey });
    console.log('🔐 [E2EE] Public key uploaded to server');
    return true;
  } catch (err) {
    console.error('🔐 [E2EE] Failed to upload public key:', err);
    return false;
  }
}

/**
 * Fetch a user's public key for encrypting messages to them
 * @returns The public key (Base64) or null if not found
 */
export async function fetchPublicKey(userId: string): Promise<string | null> {
  try {
    const { data } = await api.get(`/api/user/${userId}/publicKey`);
    return data?.publicKey || null;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      // User has no public key - fallback to unencrypted
      return null;
    }
    console.error('🔐 [E2EE] Failed to fetch public key:', err);
    return null;
  }
}
