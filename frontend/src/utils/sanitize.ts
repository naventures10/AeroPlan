import DOMPurify from 'dompurify';

/** Sanitise HTML while preserving safe formatting tags like <br/> */
export function sanitizeHtml(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ['br', 'b', 'i', 'em', 'strong', 'span', 'div', 'p'],
    ALLOWED_ATTR: ['style', 'class'],
  });
}

/** Remove HTML comments and strip all HTML tags from a string (fallback) */
export function sanitizeNotamDescription(desc: string | undefined | null): string {
  if (!desc) return '';
  let clean = desc.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  clean = clean.replace(/<[^>]+>/g, '');
  return clean.trim();
}

/** Split a string, sanitize each part using DOMPurify, and return a list of clean HTML strings */
export function sanitizeAndSplitHtml(
  raw: string | undefined | null,
  splitPattern: string | RegExp,
): string[] {
  if (!raw) return [];
  return raw
    .split(splitPattern)
    .map((part) => sanitizeHtml(part.trim()))
    .filter(Boolean);
}
