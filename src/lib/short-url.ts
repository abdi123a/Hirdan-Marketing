/**
 * Utility for generating short links using the short domain (default: https://hirdan.cc)
 */

export function getShortDomainBase(): string {
  const customDomain = import.meta.env.VITE_SHORT_LINK_DOMAIN;
  if (customDomain) {
    return customDomain.replace(/\/$/, "");
  }
  if (import.meta.env.PROD) {
    return "https://hirdan.cc";
  }
  // Default to https://hirdan.cc as requested
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
