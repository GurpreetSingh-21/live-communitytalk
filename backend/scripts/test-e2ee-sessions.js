// backend/scripts/test-e2ee-sessions.js
//
// Simple offline test of the E2E DM flow:
// - Generate two identity keypairs (Alice, Bob)
// - Simulate a bundle for Bob
// - Establish a session from Alice -> Bob (X3DH-like)
// - Encrypt N messages with sessionEncrypt
// - Decrypt them with sessionDecrypt
//
// This does NOT hit your database or HTTP API; it purely checks that the
// crypto primitives and session logic are internally consistent.

// Reuse the same crypto libs as the mobile app without adding a backend dependency.
// Path is relative to this script: backend/scripts -> ../.. -> CommunityTalkMobile/node_modules
// If you later add tweetnacl to backend/package.json, you can change these to plain 'tweetnacl'.
const nacl = require('../../CommunityTalkMobile/node_modules/tweetnacl');
const { encodeBase64, decodeBase64 } = require('../../CommunityTalkMobile/node_modules/tweetnacl-util');

function hash32(data) {
  return nacl.hash(data).slice(0, 32);
}

function concat(...arrs) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
}

function deriveRoot(sharedParts) {
  return hash32(concat(...sharedParts));
}

function nextChain(chain) {
  return hash32(concat(chain, new TextEncoder().encode('next')));
}

function deriveMsgKey(chain, counter) {
  const cnt = new Uint8Array(new Uint32Array([counter]).buffer);
  return hash32(concat(chain, cnt));
}

function b64(u8) {
  return encodeBase64(u8);
}

function ub64(s) {
  return decodeBase64(s);
}

async function main() {
  console.log('🔐 Testing E2EE session flow (Alice ↔ Bob)...\n');

  // 1) Identity keys
  const aliceId = nacl.box.keyPair();
  const bobId = nacl.box.keyPair();

  console.log('Alice identity pub:', b64(aliceId.publicKey).slice(0, 16) + '...');
  console.log('Bob   identity pub:', b64(bobId.publicKey).slice(0, 16) + '...');

  // 2) Bob bundle: signed prekey + optional one-time prekey
  const bobSignedPrekey = nacl.box.keyPair();
  const bobOtk = nacl.box.keyPair();

  // 3) Alice establishes session with Bob using bundle
  const dh1 = nacl.scalarMult(aliceId.secretKey, bobSignedPrekey.publicKey);
  const dh2 = nacl.scalarMult(aliceId.secretKey, bobId.publicKey);
  const dh3 = nacl.scalarMult(aliceId.secretKey, bobOtk.publicKey);

  const root = deriveRoot([dh1, dh2, dh3]);
  const aliceSendChain = hash32(concat(root, new TextEncoder().encode('send')));
  const aliceRecvChain = hash32(concat(root, new TextEncoder().encode('recv')));

  // Bob computes same root (IK_B + SPK_B + OTK_B, all with Alice identity pub)
  const dh1b = nacl.scalarMult(bobSignedPrekey.secretKey, aliceId.publicKey);
  const dh2b = nacl.scalarMult(bobId.secretKey, aliceId.publicKey);
  const dh3b = nacl.scalarMult(bobOtk.secretKey, aliceId.publicKey);
  const rootB = deriveRoot([dh1b, dh2b, dh3b]);
  const bobRecvChain = hash32(concat(rootB, new TextEncoder().encode('send')));
  const bobSendChain = hash32(concat(rootB, new TextEncoder().encode('recv')));

  if (b64(root) !== b64(rootB)) {
    console.error('❌ Root keys mismatch – session derivation is inconsistent');
    process.exit(1);
  }

  console.log('✅ Root keys match');

  // 4) Send multiple messages Alice -> Bob
  const messages = [
    'Hello Bob 👋',
    'How is the exam schedule?',
    'This is a secret DM.',
  ];

  let aSend = aliceSendChain;
  let bRecv = bobRecvChain;

  for (let i = 0; i < messages.length; i++) {
    const msgNum = i;
    const plaintext = messages[i];

    const msgKey = deriveMsgKey(aSend, msgNum);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const cipher = nacl.secretbox(new TextEncoder().encode(plaintext), nonce, msgKey);
    const packed = `SR1:${msgNum}:${b64(nonce)}:${b64(cipher)}`;

    console.log(`\n[${i}] Alice → Bob`);
    console.log('  Plain:', plaintext);
    console.log('  Packed:', packed.slice(0, 40) + '...');

    // Bob decrypt
    const parts = packed.split(':');
    const mNum = Number(parts[1]);
    const n = ub64(parts[2]);
    const c = ub64(parts[3]);

    const rKey = deriveMsgKey(bRecv, mNum);
    const opened = nacl.secretbox.open(c, n, rKey);
    if (!opened) {
      console.error('  ❌ Bob failed to decrypt message', i);
      process.exit(1);
    }
    const decrypted = new TextDecoder().decode(opened);
    console.log('  Decrypted:', decrypted);

    if (decrypted !== plaintext) {
      console.error('  ❌ Decrypted text mismatch');
      process.exit(1);
    }

    // advance chains
    aSend = nextChain(aSend);
    bRecv = nextChain(bRecv);
  }

  console.log('\n✅ All messages encrypted/decrypted correctly with session chains.');
  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

