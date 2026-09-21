/**
 * ID-Erzeugung für eigene Datenbanken und Scratch-Books.
 *
 * `crypto.randomUUID()` ist in allen Zielbrowsern verfügbar, aber nur in sicheren
 * Kontexten (HTTPS oder localhost). Für den unwahrscheinlichen Rest gibt es einen
 * Fallback auf `crypto.getRandomValues()` (UUID v4 von Hand).
 */

function uuidV4FromRandomValues(random: Crypto): string {
  const bytes = new Uint8Array(16);
  random.getRandomValues(bytes);
  // Version 4 und Variante 1 gemäss RFC 4122 setzen.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Liefert eine neue UUID (v4). */
export function newId(): string {
  const webCrypto: Crypto | undefined = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID();
  }
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    return uuidV4FromRandomValues(webCrypto);
  }
  throw new Error('Dieser Browser bietet keine Web-Crypto-API; IDs können nicht erzeugt werden.');
}

/** ISO-Zeitstempel für `createdAt`/`updatedAt`. */
export function nowIso(): string {
  return new Date().toISOString();
}
