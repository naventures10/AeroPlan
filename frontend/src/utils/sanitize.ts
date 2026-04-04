import DOMPurify from 'dompurify';

/** Sanitise HTML while preserving safe formatting tags like <br/> */
export function sanitizeHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'span', 'div', 'p'],
    ALLOWED_ATTR: ['style', 'class'],
  });
}
