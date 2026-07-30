import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // senza caratteri ambigui (0/O, 1/I, ecc.)

export function generateCode(length = 8): string {
  return Array.from(randomBytes(length))
    .map((b) => ALPHABET[b % ALPHABET.length])
    .join("");
}
