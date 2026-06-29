/** Client-side AES-256-GCM encryption helpers using the Web Crypto API. */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

async function deriveKey(passphrase: string, saltBuf: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase) as unknown as ArrayBuffer,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBuf, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns hex-encoded salt, IV, and base64-encoded ciphertext.
 */
export async function encryptContent(
  content: string,
  passphrase: string,
): Promise<{ ciphertext: string; salt: string; iv: string }> {
  const saltU8 = window.crypto.getRandomValues(new Uint8Array(16));
  const ivU8 = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, toBuffer(saltU8));
  const enc = new TextEncoder();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toBuffer(ivU8) },
    key,
    toBuffer(enc.encode(content)),
  );
  const ciphertext = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
  return { ciphertext, salt: bytesToHex(saltU8), iv: bytesToHex(ivU8) };
}

/**
 * Decrypts an AES-256-GCM ciphertext.
 * Throws if the passphrase is wrong (OperationError from Web Crypto).
 */
export async function decryptContent(
  ciphertext: string,
  passphrase: string,
  salt: string,
  iv: string,
): Promise<string> {
  const saltBuf = toBuffer(hexToBytes(salt));
  const ivBuf = toBuffer(hexToBytes(iv));
  const key = await deriveKey(passphrase, saltBuf);
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
  const plaintextBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuf },
    key,
    toBuffer(ciphertextBytes),
  );
  return new TextDecoder().decode(plaintextBuffer);
}
