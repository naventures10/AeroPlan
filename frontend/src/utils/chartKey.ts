/** Match backend `normalize_chart_key` for linking PDF charts to RNP procedures. */

export function normalizeChartKey(text: string | null | undefined): string {
  if (!text) return '';

  let s = text.trim();
  if (!s) return '';

  try {
    const u = new URL(s);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const seg = u.pathname.split('/').filter(Boolean);
      s = seg.length ? decodeURIComponent(seg[seg.length - 1] ?? '') || s : s;
    }
  } catch {
    // not a full URL; keep s
  }

  if (s.includes('/')) {
    s = s.split('/').pop() ?? s;
  }

  s = s.toUpperCase();
  if (s.endsWith('.PDF')) s = s.slice(0, -4);

  s = s.replace(/[_\s]+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');

  return s;
}
