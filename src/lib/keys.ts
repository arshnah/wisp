import { generateIdentity, type Identity } from "./crypto";
const k = (uid: string) => `wisp:identity:${uid}`;

export function loadIdentity(uid: string): Identity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(k(uid));
  return raw ? (JSON.parse(raw) as Identity) : null;
}
export function saveIdentity(uid: string, id: Identity) {
  localStorage.setItem(k(uid), JSON.stringify(id));
}
/** Load this device's identity for a user, generating one on first use. */
export async function ensureIdentity(uid: string): Promise<Identity> {
  let id = loadIdentity(uid);
  if (!id) { id = await generateIdentity(); saveIdentity(uid, id); }
  return id;
}