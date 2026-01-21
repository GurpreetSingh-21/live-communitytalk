// CommunityTalkMobile/src/api/e2eeApi.ts
// API functions for E2EE key management

import { api } from './api';

/**
 * Upload the user's public key to the server
 */
export async function uploadPublicKey(publicKey: string): Promise<boolean> {
  try {
    console.log(`🔐 [E2EE API] 📤 PUT /api/user/publicKey (${publicKey.substring(0, 20)}...)`);
    await api.put('/api/user/publicKey', { publicKey });
    console.log(`🔐 [E2EE API] ✅ Public key uploaded successfully`);
    return true;
  } catch (err: any) {
    console.error(`🔐 [E2EE API] ❌ Failed to upload public key:`, err?.response?.data || err?.message || err);
    return false;
  }
}

/**
 * Fetch a user's public key for encrypting messages to them
 * @returns The public key (Base64) or null if not found
 */
export async function fetchPublicKey(userId: string): Promise<string | null> {
  try {
    console.log(`🔐 [E2EE API] 📥 GET /api/user/${userId.substring(0, 8)}.../publicKey`);
    const { data } = await api.get(`/api/user/${userId}/publicKey`);
    const key = data?.publicKey || null;
    if (key) {
      console.log(`🔐 [E2EE API] ✅ Public key fetched: ${key.substring(0, 20)}...`);
    } else {
      console.log(`🔐 [E2EE API] ℹ️ No public key found for user`);
    }
    return key;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.log(`🔐 [E2EE API] ℹ️ User has no public key (404) - fallback to unencrypted`);
      return null;
    }
    console.error(`🔐 [E2EE API] ❌ Failed to fetch public key:`, err?.response?.data || err?.message || err);
    return null;
  }
}

// ───────────────────────── Bundle APIs ─────────────────────────
export async function uploadBundle(input: { signedPrekey: string; signedPrekeySig: string; oneTimePrekeys: string[] }) {
  try {
    console.log(`🔐 [E2EE API] 📤 PUT /api/user/e2ee/bundle (${input.oneTimePrekeys.length} one-time keys)`);
    await api.put('/api/user/e2ee/bundle', input);
    console.log(`🔐 [E2EE API] ✅ Bundle uploaded successfully`);
    return true;
  } catch (err: any) {
    console.error(`🔐 [E2EE API] ❌ Failed to upload bundle:`, err?.response?.data || err?.message || err);
    return false;
  }
}

export async function fetchBundle(userId: string) {
  try {
    console.log(`🔐 [E2EE API] 📥 GET /api/user/${userId.substring(0, 8)}.../e2ee/bundle`);
    const { data } = await api.get(`/api/user/${userId}/e2ee/bundle`);
    if (data) {
      console.log(`🔐 [E2EE API] ✅ Bundle fetched successfully`);
    }
    return data || null;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.log(`🔐 [E2EE API] ℹ️ No bundle found (404)`);
      return null;
    }
    console.error(`🔐 [E2EE API] ❌ Failed to fetch bundle:`, err?.response?.data || err?.message || err);
    return null;
  }
}

// ───────────────────────── Identity Backup APIs ─────────────────────────

export async function uploadIdentityBackup(backup: any): Promise<boolean> {
  try {
    console.log(`🔐 [E2EE API] 📤 PUT /api/user/e2ee/backup (version ${backup?.version || 'unknown'})`);
    await api.put('/api/user/e2ee/backup', { backup });
    console.log(`🔐 [E2EE API] ✅ Identity backup uploaded successfully`);
    return true;
  } catch (err: any) {
    console.error(`🔐 [E2EE API] ❌ Failed to upload identity backup:`, err?.response?.data || err?.message || err);
    return false;
  }
}

export async function fetchIdentityBackup(): Promise<any | null> {
  try {
    console.log(`🔐 [E2EE API] 📥 GET /api/user/e2ee/backup`);
    const { data } = await api.get('/api/user/e2ee/backup');
    const backup = data?.backup || null;
    if (backup) {
      console.log(`🔐 [E2EE API] ✅ Identity backup fetched (version ${backup.version || 'unknown'})`);
    } else {
      console.log(`🔐 [E2EE API] ℹ️ No backup found`);
    }
    return backup;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      console.log(`🔐 [E2EE API] ℹ️ No backup found (404)`);
      return null;
    }
    console.error(`🔐 [E2EE API] ❌ Failed to fetch identity backup:`, err?.response?.data || err?.message || err);
    return null;
  }
}
