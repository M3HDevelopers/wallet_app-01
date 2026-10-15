// Authentication service: local password + optional PIN.
// Credentials are stored in Expo SecureStore as salted SHA-256 digests
// (iterated), never plaintext. This is appropriate for a single-user offline app.
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PASSWORD_KEY = 'pwm.password.v1';
const PIN_KEY = 'pwm.pin.v1';
const ITERATIONS = 12000;

export function randomSalt(len = 16): string {
  const bytes = new Uint8Array(len);
  // expo-crypto provides getRandomBytes via Crypto.getRandomValues when available;
  // fall back to Math.random-based entropy mixed with time for salt purposes.
  try {
    const anyCrypto = Crypto as unknown as { getRandomValues?: (a: Uint8Array) => Uint8Array };
    if (typeof anyCrypto.getRandomValues === 'function') {
      anyCrypto.getRandomValues(bytes);
      return bufToHex(bytes);
    }
  } catch { /* ignore */ }
  for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bufToHex(bytes);
}

function bufToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function hashSecret(secret: string, salt: string): Promise<string> {
  let digest = `${salt}:${secret}`;
  for (let i = 0; i < ITERATIONS; i++) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${digest}:${salt}:${i}`
    );
  }
  return digest;
}

interface StoredCredential { salt: string; hash: string; }

function encode(c: StoredCredential): string { return JSON.stringify(c); }
function decode(s: string | null): StoredCredential | null {
  if (!s) return null;
  try { return JSON.parse(s) as StoredCredential; } catch { return null; }
}

// ---- Password -----------------------------------------------------------

export async function hasPassword(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(PASSWORD_KEY);
  return !!v;
}

export async function setPassword(password: string): Promise<void> {
  const salt = randomSalt();
  const hash = await hashSecret(password, salt);
  await SecureStore.setItemAsync(PASSWORD_KEY, encode({ salt, hash }));
}

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = decode(await SecureStore.getItemAsync(PASSWORD_KEY));
  if (!stored) return false;
  const hash = await hashSecret(password, stored.salt);
  return timingSafeEqual(hash, stored.hash);
}

export async function changePassword(current: string, next: string): Promise<void> {
  if (!(await verifyPassword(current))) throw new Error('Current password is incorrect');
  await setPassword(next);
}

// ---- PIN ----------------------------------------------------------------

export async function hasPin(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(PIN_KEY));
}

export async function setPin(pin: string): Promise<void> {
  if (!/^\d{4}$|^\d{6}$/.test(pin)) throw new Error('PIN must be 4 or 6 digits');
  const salt = randomSalt();
  const hash = await hashSecret(pin, salt);
  await SecureStore.setItemAsync(PIN_KEY, encode({ salt, hash }));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = decode(await SecureStore.getItemAsync(PIN_KEY));
  if (!stored) return false;
  const hash = await hashSecret(pin, stored.salt);
  return timingSafeEqual(hash, stored.hash);
}

export async function removePin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

// ---- Reset (used by "reset all data") ------------------------------------

export async function clearAllCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(PASSWORD_KEY);
  await SecureStore.deleteItemAsync(PIN_KEY);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Password should contain letters and numbers';
  }
  return null;
}
