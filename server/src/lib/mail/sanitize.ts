import sanitizeHtml from 'sanitize-html';

/**
 * Sanitize HTML coming from inbound emails before it is stored/displayed.
 * Strips scripts, event handlers, and dangerous URschemes while preserving
 * the formatting/layout typical of real emails (tables, inline styles, images).
 * The frontend additionally renders this inside a sandboxed iframe.
 */
export function sanitizeEmailHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'style', 'center', 'font', 'span', 'section', 'header', 'footer',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
    ]),
    allowedAttributes: {
      '*': ['style', 'class', 'align', 'width', 'height', 'dir', 'title', 'valign', 'bgcolor'],
      a: ['href', 'name', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height', 'style'],
      font: ['color', 'face', 'size'],
      table: ['border', 'cellpadding', 'cellspacing', 'width', 'style', 'bgcolor', 'align'],
      td: ['colspan', 'rowspan', 'width', 'height', 'valign', 'align', 'bgcolor', 'style'],
      th: ['colspan', 'rowspan', 'width', 'height', 'valign', 'align', 'bgcolor', 'style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'cid'],
    allowedSchemesByTag: { img: ['http', 'https', 'data', 'cid'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
      }),
    },
  });
}
