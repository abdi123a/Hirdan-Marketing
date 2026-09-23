const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%*-_";

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/**
 * Cryptographically random password that always satisfies the server's
 * password policy (≥8 chars with upper, lower, digit and symbol).
 */
export function generateStrongPassword(length = 14): string {
  const all = UPPER + LOWER + DIGITS + SPECIAL;
  const chars = [UPPER, LOWER, DIGITS, SPECIAL].map((set) => set[randomIndex(set.length)]);
  while (chars.length < length) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const PASSWORD_POLICY_HINT = "Min 8 chars: upper, lower, number & symbol";
