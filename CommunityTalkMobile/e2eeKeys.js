import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

// --- Expo SecureStore version ---
import * as SecureStore from "expo-secure-store";

const PUB_KEY = "e2ee_public_key";
const SEC_KEY = "e2ee_secret_key";

// Call this once after login (or on app start)
export async function getOrCreateKeyPair() {
  const existingPub = await SecureStore.getItemAsync(PUB_KEY);
  const existingSec = await SecureStore.getItemAsync(SEC_KEY);

  if (existingPub && existingSec) {
    return { publicKey: existingPub, secretKey: existingSec };
  }

  const kp = nacl.box.keyPair();
  const publicKey = encodeBase64(kp.publicKey);
  const secretKey = encodeBase64(kp.secretKey);

  await SecureStore.setItemAsync(PUB_KEY, publicKey);
  await SecureStore.setItemAsync(SEC_KEY, secretKey);

  return { publicKey, secretKey };
}