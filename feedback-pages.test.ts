import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { FEEDBACK_PAGES, OG_IMAGE, renderPage, SITE_URL } from './feedback-pages';

const INDEX = `<!doctype html><html><head><meta charset="UTF-8" /><title>DevFest Ibadan 2026 Project Showcase</title></head><body><div id="root"></div></body></html>`;
const byRoute = (r: string) => FEEDBACK_PAGES.find((p) => p.route === r)!;

describe('renderPage', () => {
  it('replaces the showcase title and adds Open Graph tags for the attendee form', () => {
    const html = renderPage(INDEX, byRoute('/feedback/attendee'));
    expect(html).not.toContain('Project Showcase');
    expect(html).toContain('<title>DevFest Ibadan 2026 · Attendee Feedback</title>');
    expect(html).toContain('property="og:title" content="DevFest Ibadan 2026 · Attendee Feedback"');
    expect(html).toContain(`property="og:url" content="${SITE_URL}/feedback/attendee"`);
    expect(html).toContain('name="description"');
    expect(html).toContain('<div id="root"></div>');
  });

  it('uses the DevFest logo as a large preview image on both public forms', () => {
    for (const route of ['/feedback/attendee', '/feedback/sponsor']) {
      const html = renderPage(INDEX, byRoute(route));
      expect(html).toContain(`property="og:image" content="${SITE_URL}/og-image.jpg"`);
      expect(html).toContain(`property="og:image:width" content="${OG_IMAGE.width}"`);
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain(`name="twitter:image" content="${SITE_URL}/og-image.jpg"`);
    }
  });

  it('ships the image the tags point to, small enough for WhatsApp (under 300 KB)', () => {
    const file = `public${OG_IMAGE.path}`;
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.statSync(file).size).toBeLessThan(300 * 1024);
  });

  it('gives the sponsor form its own title', () => {
    const html = renderPage(INDEX, byRoute('/feedback/sponsor'));
    expect(html).toContain('<title>DevFest Ibadan 2026 · Sponsor Feedback</title>');
    expect(html).not.toContain('Attendee');
  });

  it('keeps the admin page out of search results and link previews', () => {
    const html = renderPage(INDEX, byRoute('/feedback/admin'));
    expect(html).toContain('noindex');
    expect(html).not.toContain('og:title');
    expect(html).not.toContain('og:image');
  });

  it('escapes quotes and angle brackets in metadata', () => {
    const html = renderPage(INDEX, { file: 'x.html', route: '/x', title: 'A "b" <c>', description: 'd' });
    expect(html).toContain('A &quot;b&quot; &lt;c>');
  });

  it('fails loudly if index.html has no title to replace', () => {
    expect(() => renderPage('<html></html>', byRoute('/feedback/attendee'))).toThrow();
  });
});
