import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, REQUEST, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PlatformInfoService } from '../services/platform-info.service';
import { INDEX_ROBOTS, NOINDEX_ROBOTS, SHARE_IMAGE, SITE_ORIGIN, isOfficialHost, organizationSchema, pageSeo, schemaJson } from './site-seo';

/** One head owner for initial navigation, SPA navigation and settings updates. Never starts network requests. */
@Injectable({ providedIn: 'root' })
export class PageSeoService {
  private readonly doc = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly platform = inject(PlatformInfoService);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly requestUrl = this.request?.url ? new URL(this.request.url) : null;
  private readonly url = signal(this.doc.location?.href || this.requestUrl?.href || this.router.url);
  constructor() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.url.set(this.router.url));
    effect(() => {
      const page = pageSeo(this.url());
      const brand = this.platform.brand();
      const official = isOfficialHost(this.doc.location?.hostname || this.requestUrl?.hostname || '');
      this.doc.documentElement.lang = 'ar-SA';
      this.doc.documentElement.dir = 'rtl';
      const title = `${page.title} | ${brand}`;
      this.doc.title = title;
      this.meta('name', 'description', page.description);
      this.meta('name', 'robots', official && page.indexable ? INDEX_ROBOTS : NOINDEX_ROBOTS);
      this.meta('property', 'og:title', title);
      this.meta('property', 'og:description', page.description);
      this.meta('property', 'og:site_name', brand);
      this.meta('property', 'og:url', `${SITE_ORIGIN}${page.path}`);
      this.meta('name', 'twitter:title', title);
      this.meta('name', 'twitter:description', page.description);
      for (const key of ['og:image', 'og:image:url', 'og:image:secure_url']) this.meta('property', key, SHARE_IMAGE);
      this.meta('name', 'twitter:image', SHARE_IMAGE);
      this.doc.head.querySelectorAll('link[rel="canonical"]').forEach(el => el.remove());
      if (page.indexable) {
        const link = this.doc.createElement('link'); link.rel = 'canonical'; link.href = `${SITE_ORIGIN}${page.path}`; this.doc.head.append(link);
      }
      let schema = this.doc.head.querySelector<HTMLScriptElement>('script[data-ws-seo-schema]');
      if (!schema) { schema = this.doc.createElement('script'); schema.type = 'application/ld+json'; schema.setAttribute('data-ws-seo-schema', ''); this.doc.head.append(schema); }
      schema.textContent = schemaJson(organizationSchema(brand, this.platform.supportEmail(), this.platform.supportPhone()));
    });
  }
  private meta(attr: 'name' | 'property', key: string, content: string): void {
    const nodes = this.doc.head.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    let el = nodes[0];
    nodes.forEach((node, i) => { if (i) node.remove(); });
    if (!el) { el = this.doc.createElement('meta'); el.setAttribute(attr, key); this.doc.head.append(el); }
    el.content = content;
  }
}
