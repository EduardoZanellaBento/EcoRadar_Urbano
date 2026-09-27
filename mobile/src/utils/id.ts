import * as Crypto from 'expo-crypto';

/** UUID v4 (usado como idempotencyKey e X-Request-Id). */
export function gerarId(): string {
  return Crypto.randomUUID();
}
