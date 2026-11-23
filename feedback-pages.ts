// Link previews (WhatsApp, X, Slack, ...) read the *static* HTML and never run
// the React app, so every route would otherwise share index.html's title. At
// build time we emit one copy of index.html per feedback page with its own
// <title> and Open Graph tags; vercel.json rewrites each route to its copy.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export const SITE_URL = 'https://devfest-ibadan-2026.vercel.app';

export interface PageMeta {
  file: string; // emitted file name, e.g. feedback-attendee.html
  route: string; // public path, e.g. /feedback/attendee
  title: string;
  description?: string; // omitted => page is private (noindex, no preview tags)
}

export const FEEDBACK_PAGES: PageMeta[] = [
  {
    file: 'feedback-attendee.html',
    route: '/feedback/attendee',
    title: 'DevFest Ibadan 2026 · Attendee Feedback',
    description: 'Tell us how DevFest Ibadan 2026 went. It takes about 2 minutes.',
  },
  {
    file: 'feedback-sponsor.html',
    route: '/feedback/sponsor',
    title: 'DevFest Ibadan 2026 · Sponsor Feedback',
    description: 'Share your experience sponsoring DevFest Ibadan 2026.',
  },
  { file: 'feedback-admin.html', route: '/feedback/admin', title: 'Feedback Admin · DevFest Ibadan 2026' },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export function renderPage(indexHtml: string, page: PageMeta, siteUrl = SITE_URL): string {
  const tags = page.description
    ? [
        `<title>${esc(page.title)}</title>`,
        `<meta name="description" content="${esc(page.description)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="DevFest Ibadan 2026" />`,
        `<meta property="og:title" content="${esc(page.title)}" />`,
        `<meta property="og:description" content="${esc(page.description)}" />`,
        `<meta property="og:url" content="${siteUrl}${page.route}" />`,
        `<meta name="twitter:card" content="summary" />`,
        `<meta name="twitter:title" content="${esc(page.title)}" />`,
        `<meta name="twitter:description" content="${esc(page.description)}" />`,
      ]
    : [`<title>${esc(page.title)}</title>`, `<meta name="robots" content="noindex, nofollow" />`];

  if (!/<title>[^<]*<\/title>/.test(indexHtml)) throw new Error('index.html has no <title> to replace');
  return indexHtml.replace(/<title>[^<]*<\/title>/, tags.join('\n    '));
}

export function feedbackPages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'feedback-pages',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexHtml = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
      for (const page of FEEDBACK_PAGES) {
        fs.writeFileSync(path.join(outDir, page.file), renderPage(indexHtml, page));
      }
    },
  };
}
