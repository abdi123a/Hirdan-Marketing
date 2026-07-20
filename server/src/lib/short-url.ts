import { env } from '../config/env.js';

/**
 * Returns the short domain base URL (defaults to https://hirdan.cc).
 */
export function getShortDomainBase(): string {
  if (env.SHORT_LINK_DOMAIN) {
    return env.SHORT_LINK_DOMAIN.replace(/\/$/, "");
  }
  return "https://hirdan.cc";
}

/**
 * Builds a shortened verification URL (e.g. https://hirdan.cc/v/abc12345)
 */
export function getShortVerificationUrl(token: string): string {
  if (!token) return "";
  const base = getShortDomainBase();
  return `${base}/v/${token}`;
}

/**
 * Builds a shortened file share URL (e.g. https://hirdan.cc/f/abc12345)
 */
export function getShortShareUrl(shareId: string): string {
  if (!shareId) return "";
  const base = getShortDomainBase();
  return `${base}/f/${shareId}`;
}
