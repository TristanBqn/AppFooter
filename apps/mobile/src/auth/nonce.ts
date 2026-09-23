// Conversion pure octets -> hexadécimal (nonce brut de la connexion Apple, ADR 001).
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
