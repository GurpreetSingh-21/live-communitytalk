import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import { fetchBundle, uploadBundle } from '../api/e2eeApi';
import { getOrCreateKeyPair } from './e2ee';

type Session = {
  partnerId: string;
  rootKey: string; // base64
  sendChain: string; // base64
  recvChain: string; // base64
  sendCount: number;
  recvCount: number;
  theirIdentityKey: string; // base64
  myIdentityKey: string; // base64
  version: number; // session version
};

const SESSION_KEY = (me: string, them: string) => `e2ee_session_${me}_${them}`;
const HASH = (data: Uint8Array) => nacl.hash(data).slice(0, 32);

function concat(...arrs: Uint8Array[]) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

function deriveRoot(sharedParts: Uint8Array[]) {
  return HASH(concat(...sharedParts));
}

function nextChain(chain: Uint8Array) {
  return HASH(concat(chain, new TextEncoder().encode('next')));
}

function deriveMsgKey(chain: Uint8Array, counter: number) {
  const cnt = new Uint8Array(new Uint32Array([counter]).buffer);
  return HASH(concat(chain, cnt));
}

async function saveSession(me: string, them: string, s: Session) {
  await SecureStore.setItemAsync(SESSION_KEY(me, them), JSON.stringify(s));
}

async function loadSession(me: string, them: string): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY(me, them));
  if (!raw) return null;
  try { return JSON.parse(raw) as Session; } catch { return null; }
}

export async function clearSession(me: string, them: string) {
  await SecureStore.deleteItemAsync(SESSION_KEY(me, them));
}

/**
 * Ensure we have a session with partner. If none, establish using partner bundle (X3DH-like minimal).
 */
export async function ensureSession(me: string, partnerId: string): Promise<Session | null> {
  console.log(`🔐 [E2EE Session] 🔍 Checking session with ${partnerId.substring(0, 8)}...`);
  const existing = await loadSession(me, partnerId);
  if (existing) {
    console.log(`🔐 [E2EE Session] ✅ Found existing session (sendCount: ${existing.sendCount}, recvCount: ${existing.recvCount})`);
    return existing;
  }

  console.log(`🔐 [E2EE Session] 🆕 No session found, establishing new session...`);
  const myKeys = await getOrCreateKeyPair(me);
  const theirBundle = await fetchBundle(partnerId);
  if (!theirBundle) {
    console.log(`🔐 [E2EE Session] ❌ Partner has no bundle, cannot establish session`);
    return null;
  }

  console.log(`🔐 [E2EE Session] 🔑 Deriving shared root key (X3DH-like)...`);
  const ikA_sec = decodeBase64(myKeys.secretKey);
  const ikB_pub = decodeBase64(theirBundle.publicKey);
  const spkB_pub = decodeBase64(theirBundle.signedPrekey);
  const otkB_pub = theirBundle.oneTimePrekey ? decodeBase64(theirBundle.oneTimePrekey) : null;

  // X3DH minimal: DH1 = IK_A x SPK_B, DH2 = IK_A x IK_B, DH3 = IK_A x OTK_B (if present)
  const dh1 = nacl.scalarMult(ikA_sec, spkB_pub);
  const dh2 = nacl.scalarMult(ikA_sec, ikB_pub);
  const parts = [dh1, dh2];
  if (otkB_pub) parts.push(nacl.scalarMult(ikA_sec, otkB_pub));
  const root = deriveRoot(parts);

  const sendChain = HASH(concat(root, new TextEncoder().encode('send')));
  const recvChain = HASH(concat(root, new TextEncoder().encode('recv')));

  const session: Session = {
    partnerId,
    rootKey: encodeBase64(root),
    sendChain: encodeBase64(sendChain),
    recvChain: encodeBase64(recvChain),
    sendCount: 0,
    recvCount: 0,
    theirIdentityKey: theirBundle.publicKey,
    myIdentityKey: myKeys.publicKey,
    version: 1
  };
  await saveSession(me, partnerId, session);
  console.log(`🔐 [E2EE Session] ✅ Session established and saved`);
  return session;
}

/**
 * Encrypt using session; returns packed payload string SR1:<msgNum>:<nonce>:<cipher>
 * 
 * ⚠️ DISABLED: The X3DH session protocol is incomplete. The recipient cannot derive
 * the same session keys because the sender's ephemeral public key is not transmitted.
 * Use legacy nacl.box encryption instead (encryptMessage in e2ee.ts), which uses
 * symmetric shared secrets and works correctly.
 * 
 * TODO: To re-enable, we need to include the sender's ephemeral public key in the
 * message payload so the recipient can perform the same X3DH derivation.
 */
export async function sessionEncrypt(me: string, partnerId: string, plaintext: string): Promise<string | null> {
  // Session encryption is disabled - always return null to force fallback to legacy encryption
  console.log(`🔐 [E2EE Session] ⚠️ Session encryption disabled (incomplete X3DH protocol), using legacy encryption`);
  return null;
}

/**
 * Decrypt SR1 payload if session exists; returns plaintext or null on failure.
 */
export async function sessionDecrypt(me: string, partnerId: string, payload: string): Promise<string | null> {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'SR1') {
    console.log(`🔐 [E2EE Session] ⚠️ Invalid SR1 payload format`);
    return null;
  }
  const msgNum = Number(parts[1]);
  const nonce = decodeBase64(parts[2]);
  const cipher = decodeBase64(parts[3]);

  console.log(`🔐 [E2EE Session] 🔓 Decrypting SR1 message (msgNum: ${msgNum})...`);
  let session = await loadSession(me, partnerId);
  if (!session) {
    console.log(`🔐 [E2EE Session] ❌ No session found for decryption`);
    return null;
  }

  const recvChain = decodeBase64(session.recvChain);
  const msgKey = deriveMsgKey(recvChain, msgNum);
  const plain = nacl.secretbox.open(cipher, nonce, msgKey);
  if (!plain) {
    console.log(`🔐 [E2EE Session] ❌ Decryption failed (bad MAC or key)`);
    return null;
  }

  // advance recv chain to at least msgNum+1
  let current = recvChain;
  let count = session.recvCount;
  while (count <= msgNum) {
    current = nextChain(current);
    count += 1;
  }
  session.recvChain = encodeBase64(current);
  session.recvCount = count;
  await saveSession(me, partnerId, session);

  console.log(`🔐 [E2EE Session] ✅ Message decrypted successfully (recvCount: ${count})`);
  return new TextDecoder().decode(plain);
}

/**
 * Upload a fresh bundle if missing. Generates signed prekey + prekey pool.
 */
export async function ensureBundleUploaded(me: string): Promise<void> {
  console.log(`🔐 [E2EE Bundle] 🔍 Checking if bundle needs upload for user ${me.substring(0, 8)}...`);
  const existing = await fetchBundle(me);
  if (existing) {
    console.log(`🔐 [E2EE Bundle] ✅ Bundle already exists on server, skipping upload`);
    return;
  }

  console.log(`🔐 [E2EE Bundle] 🆕 No bundle found, generating and uploading...`);
  const kp = nacl.box.keyPair(); // prekey we expose in bundle

  // small pool of one-time prekeys
  const prekeys: string[] = [];
  for (let i = 0; i < 5; i++) {
    const pk = nacl.box.keyPair();
    prekeys.push(encodeBase64(pk.publicKey));
  }

  console.log(`🔐 [E2EE Bundle] 📦 Generated bundle (signed prekey + ${prekeys.length} one-time keys)`);
  const success = await uploadBundle({
    signedPrekey: encodeBase64(kp.publicKey),
    signedPrekeySig: null,
    oneTimePrekeys: prekeys
  });
  
  if (success) {
    console.log(`🔐 [E2EE Bundle] ✅ Bundle uploaded successfully`);
    // Wait a moment for DB to sync, then verify bundle exists
    await new Promise(resolve => setTimeout(resolve, 100));
    const verified = await fetchBundle(me);
    if (verified) {
      console.log(`🔐 [E2EE Bundle] ✅ Bundle verified on server`);
    } else {
      console.log(`🔐 [E2EE Bundle] ⚠️ Bundle upload succeeded but verification failed (may be race condition)`);
    }
  } else {
    console.log(`🔐 [E2EE Bundle] ⚠️ Bundle upload failed (non-fatal)`);
  }
}
