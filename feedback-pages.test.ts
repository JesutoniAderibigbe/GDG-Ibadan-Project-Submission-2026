import { describe, it, expect } from 'vitest';
import { FEEDBACK_PAGES, renderPage, SITE_URL } from './feedback-pages';

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

  it('gives the sponsor form its own title', () => {
    const html = renderPage(INDEX, byRoute('/feedback/sponsor'));
    expect(html).toContain('<title>DevFest Ibadan 2026 · Sponsor Feedback</title>');
    expect(html).not.toContain('Attendee');
  });

  it('keeps the admin page out of search results and link previews', () => {
    const html = renderPage(INDEX, byRoute('/feedback/admin'));
    expect(html).toContain('noindex');
    expect(html).not.toContain('og:title');
  });

  it('escapes quotes and angle brackets in metadata', () => {
    const html = renderPage(INDEX, { file: 'x.html', route: '/x', title: 'A "b" <c>', description: 'd' });
    expect(html).toContain('A &quot;b&quot; &lt;c>');
  });

  it('fails loudly if index.html has no title to replace', () => {
    expect(() => renderPage('<html></html>', byRoute('/feedback/attendee'))).toThrow();
  });
});
