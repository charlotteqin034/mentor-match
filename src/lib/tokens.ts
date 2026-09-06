import { randomBytes } from "node:crypto";

/** Unambiguous alphabet — no 0/O or 1/l/I, so tokens survive being read aloud. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateToken(length = 32): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
