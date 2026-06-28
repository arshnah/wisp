/**
 * Wisp end-to-end encryption core.
 *
 * Design (all in the browser, using the native Web Crypto API, zero dependencies):
 *   1. Every user generates an ECDH identity keypair (P-256). The private key never leaves the device.
 *   2. Public keys are the only thing shared. A server (or another user) only ever sees public keys + ciphertext.
 *   3. To message someone, both sides derive the SAME shared secret from (my private key + their public key)
 *      via ECDH. This is the magic: neither key alone is enough, and the secret is never transmitted.
 *   4. The shared secret becomes an AES-GCM key. AES-GCM gives us confidentiality AND tamper-detection.
 *   5. Each message uses a fresh random IV. The server stores { iv, ciphertext } and learns nothing.
 *
 * A passive server, or anyone sniffing the wire, sees only ciphertext. That is what "end-to-end" means here.
 */

export type Jwk = JsonWebKey;
export interface Identity { publicKey: Jwk; privateKey: Jwk; }
export interface Sealed { iv: string; ciphertext: string; }

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = ""; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromB64(s: string): Uint8Array {
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Generate a fresh ECDH identity. Keep `privateKey` secret, share `publicKey`. */
export async function generateIdentity(): Promise<Identity> {
  const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]);
  const publicKey = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", kp.privateKey);
  return { publicKey, privateKey };
}

async function importPrivate(jwk: Jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveKey"]);
}
async function importPublic(jwk: Jwk) {
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** Derive the shared AES-GCM key from my private key + their public key. */
async function deriveSharedKey(myPrivate: Jwk, theirPublic: Jwk): Promise<CryptoKey> {
  const priv = await importPrivate(myPrivate);
  const pub = await importPublic(theirPublic);
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: pub },
    priv,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt a message for a recipient. Output is safe to hand to an untrusted server. */
export async function seal(myPrivate: Jwk, theirPublic: Jwk, plaintext: string): Promise<Sealed> {
  const key = await deriveSharedKey(myPrivate, theirPublic);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  return { iv: toB64(iv), ciphertext: toB64(ct) };
}

/** Decrypt a message from a sender. Throws if the ciphertext was tampered with. */
export async function open(myPrivate: Jwk, theirPublic: Jwk, sealed: Sealed): Promise<string> {
  const key = await deriveSharedKey(myPrivate, theirPublic);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, key, fromB64(sealed.ciphertext));
  return dec.decode(pt);
}

/**
 * A short, human-comparable fingerprint of a public key (SHA-256, first 8 bytes as hex pairs).
 * Two people can read these aloud to confirm there is no man-in-the-middle.
 */
export async function fingerprint(publicKey: Jwk): Promise<string> {
  const raw = enc.encode(JSON.stringify(publicKey));
  const hash = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(hash).slice(0, 8);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(":");
}
