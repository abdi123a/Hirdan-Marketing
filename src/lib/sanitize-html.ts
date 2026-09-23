import DOMPurify from "dompurify";

/**
 * Sanitize user-authored rich text (invoice descriptions, delivery notes,
 * email templates, …) before it reaches `dangerouslySetInnerHTML` or
 * `element.innerHTML`. Strips scripts, event handlers and `javascript:` URLs
 * while keeping ordinary formatting markup.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
    FORBID_ATTR: ["style"],
  });
}

/**
 * Like {@link sanitizeHtml} but keeps inline `style` attributes, which email
 * templates rely on for layout. DOMPurify still removes script-capable content.
 */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
  });
}
