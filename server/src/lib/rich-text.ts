import sanitizeHtml from 'sanitize-html';

/**
 * Allowlist sanitizer for user-authored rich text (line-item descriptions,
 * delivery notes, email bodies). Used on write (invoice / proforma routes) and
 * again on render (PDF / email), so stored documents can never carry
 * script-capable markup. Keeps the formatting the in-app editors produce
 * (bold / italic / underline, lists, paragraphs, inline style).
 */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'br', 'p', 'ul', 'ol', 'li', 'div', 'span', 'font',
    ],
    allowedAttributes: { '*': ['style'], font: ['face', 'color'] },
    allowedSchemes: [],
  });
}

/**
 * Sanitize a stored rich-text field on write. Plain text without any `<` can
 * not contain markup and is returned untouched (so `&` etc. are not entity-
 * encoded for API consumers that treat the field as text).
 */
export function cleanRichText<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string' || !value.includes('<')) return value;
  return sanitizeRichHtml(value) as T;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
