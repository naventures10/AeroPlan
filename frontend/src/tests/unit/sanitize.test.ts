import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../utils/sanitize';

describe('sanitizeHtml', () => {
  it('should clean dangerous html', () => {
    const dirty = '<div onclick="alert(1)">safe</div><script>alert(2)</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain('safe');
    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('onclick');
  });

  it('should allow benign tags like br, b, div', () => {
    const html = '<div class="test"><b>bold</b><br/></div>';
    const clean = sanitizeHtml(html);
    expect(clean).toContain('class="test"');
    expect(clean).toContain('<b>bold</b>');
    expect(clean).toContain('<br>');
  });
});
