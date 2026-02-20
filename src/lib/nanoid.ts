/**
 * NanoID generator for creating unique IDs
 * Simplified version for Cloudflare Workers
 */

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const size = 21;

export function nanoid(): string {
  let id = "";
  for (let i = 0; i < size; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    id += alphabet[randomIndex];
  }
  return id;
}
