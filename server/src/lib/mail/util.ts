/** Shared helpers for the Email Center: subject normalization, Message-ID
 *  generation, address parsing, and text snippet extraction. */

/** Strip Re:/Fwd: prefixes and lowercase for thread grouping. */
export function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  return subject
    .replace(/^(\s*(re|fwd?|aw|wg|sv|antwort)\s*:\s*)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .slice(0, 255);
}

/** Deterministic RFC 5322 Message-ID for one of our outbound emails. */
export function buildMessageId(emailId: string, domain: string | null): string {
  const host = (domain || 'mail.local').replace(/[<>]/g, '');
  return `<email-${emailId}@${host}>`;
}

/** Parse a raw header value like "A <a@x.com>, b@y.com" into address objects. */
export function parseAddressList(value: string | null | undefined): Array<{ email: string; name?: string }> {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
      if (match) {
        const name = match[1].trim();
        return { email: match[2].trim().toLowerCase(), ...(name ? { name } : {}) };
      }
      return { email: part.replace(/[<>]/g, '').trim().toLowerCase() };
    })
    .filter((a) => a.email.includes('@'));
}

/** Normalize a value that may be a string, array, or address object into emails. */
export function toEmailArray(value: unknown): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  const out: string[] = [];
  for (const item of arr) {
    if (typeof item === 'string') {
      parseAddressList(item).forEach((a) => out.push(a.email));
    } else if (item && typeof item === 'object' && 'email' in (item as any)) {
      const e = String((item as any).email || '').toLowerCase();
      if (e.includes('@')) out.push(e);
    }
  }
  return Array.from(new Set(out));
}

/** Cheap HTML → text used for previews/snippets (not for security sanitization). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Short one-line preview for the conversation list. */
export function toSnippet(text: string | null | undefined, html?: string | null, len = 200): string {
  const base = text && text.trim() ? text : htmlToText(html);
  return base.replace(/\s+/g, ' ').trim().slice(0, len);
}

/** Extract the first Message-ID token from a References/In-Reply-To header. */
export function firstMessageId(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/<[^>]+>/);
  return match ? match[0] : value.trim() || null;
}

/** All Message-IDs referenced in a References header, oldest → newest. */
export function allMessageIds(value: string | null | undefined): string[] {
  if (!value) return [];
  const matches = value.match(/<[^>]+>/g);
  return matches ? matches : [];
}
