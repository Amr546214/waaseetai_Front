import type { RequestHandler } from 'express';
import { isOfficialHost, pageSeo, NOINDEX_ROBOTS, PUBLIC_PAGES, SITE_ORIGIN, escapeHtml } from './app/core/seo/site-seo';

/** SSR entry point has the same environment/indexing boundary as the static nginx image. */
export const seoHeaders: RequestHandler = (req, res, next) => {
  const official = isOfficialHost(req.hostname);
  const page = pageSeo(req.path);
  const publicResource = /\.(?:js|css|svg|ico|png|jpg|jpeg|webp|woff|woff2|ttf)$/i.test(req.path) || ['/robots.txt', '/sitemap.xml'].includes(req.path);
  if (!official || (!page.indexable && !publicResource)) res.setHeader('X-Robots-Tag', NOINDEX_ROBOTS);
  if (req.path === '/robots.txt') {
    res.type('text/plain').setHeader('Cache-Control', 'no-cache');
    res.send(`User-agent: *\nAllow: /\nDisallow: /api/\n${official ? `\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n` : ''}`);
    return;
  }
  if (req.path === '/sitemap.xml') {
    if (!official) { res.status(404).type('text/plain').send('Not found'); return; }
    res.type('application/xml').setHeader('Cache-Control', 'no-cache');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${PUBLIC_PAGES.map(p => `<url><loc>${escapeHtml(SITE_ORIGIN + p.path)}</loc></url>`).join('')}</urlset>`);
    return;
  }
  next();
};
