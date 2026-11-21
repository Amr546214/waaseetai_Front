import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { PlatformInfoService } from '../services/platform-info.service';
import { PageSeoService } from './page-seo.service';

describe('PageSeoService', () => {
  let doc: Document;
  let events: Subject<NavigationEnd>;
  let router: { url: string; events: Subject<NavigationEnd> };
  const brand = signal('وسيط AI'), email = signal('support@waseetai.com'), phone = signal('+966 55 996 5056');
  function start(host = 'waseetai.com') {
    const base = document.implementation.createHTMLDocument();
    doc = new Proxy(base, { get(target, key) {
      if (key === 'location') return new URL(`https://${host}/`);
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    events = new Subject(); router = { url: '/', events };
    TestBed.configureTestingModule({ providers: [
      { provide: DOCUMENT, useValue: doc }, { provide: Router, useValue: router },
      { provide: PlatformInfoService, useValue: { brand, supportEmail: email, supportPhone: phone } },
    ] });
    TestBed.inject(PageSeoService); TestBed.tick();
  }
  function visit(url: string) { router.url = url; events.next(new NavigationEnd(1,url,url)); TestBed.tick(); }
  beforeEach(() => { brand.set('وسيط AI'); email.set('support@waseetai.com'); phone.set('+966 55 996 5056'); });
  it('updates public route metadata on repeated SPA navigation without duplicate or stale canonical tags', () => {
    start(); visit('/about/?utm_source=test#team');
    expect(doc.title).toBe('من نحن | وسيط AI');
    expect(doc.head.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://waseetai.com/about');
    visit('/pricing'); visit('/about'); visit('/pricing');
    expect(doc.title).toBe('الأسعار والعمولات | وسيط AI');
    expect(doc.head.querySelectorAll('meta[name=description]').length).toBe(1);
    expect(doc.head.querySelectorAll('link[rel=canonical]').length).toBe(1);
    expect(doc.head.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://waseetai.com/pricing');
  });
  it('private routes remove the previous public canonical and opt out of indexing', () => {
    start(); visit('/about'); visit('/auth/login?next=/checkout/payment');
    expect(doc.head.querySelector('link[rel=canonical]')).toBeNull();
    expect(doc.head.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex, nofollow');
    visit('/marketplace/offer/123?secret=hidden');
    expect(doc.head.querySelector('meta[name=robots]')?.getAttribute('content')).toContain('index, follow');
    expect(doc.head.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://waseetai.com/marketplace/offer/123');
  });
  it('reserved marketplace pages remove stale public canonicals and stay noindex after SPA navigation', () => {
    start();
    for (const path of ['/marketplace/cart', '/marketplace/comparison', '/marketplace/tracking', '/marketplace/cart/?x=1#item', '/marketplace/%63art']) {
      visit('/marketplace/offer/123'); visit(path);
      expect(doc.head.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex, nofollow');
      expect(doc.head.querySelector('link[rel=canonical]')).toBeNull();
    }
    visit('/marketplace/design-logo');
    expect(doc.head.querySelector('meta[name=robots]')?.getAttribute('content')).toContain('index, follow');
    expect(doc.head.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://waseetai.com/marketplace/design-logo');
  });
  it('open sessions use the configured brand and support contact in schema without losing the route title', () => {
    start(); visit('/contact'); brand.set('اسم جديد'); email.set('help@example.test'); phone.set('+123'); TestBed.tick();
    expect(doc.title).toBe('تواصل معنا | اسم جديد');
    const schema = JSON.parse(doc.head.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(schema['@graph'][0].email).toBe('help@example.test');
    expect(schema['@graph'][0].telephone).toBe('+123');
    expect(doc.head.querySelectorAll('script[type="application/ld+json"]').length).toBe(1);
    expect(doc.documentElement.lang).toBe('ar-SA');
  });
  it('dev and agent stay noindex even on public pages', () => {
    start('dev.waseetai.com'); visit('/about');
    expect(doc.head.querySelector('meta[name=robots]')?.getAttribute('content')).toBe('noindex, nofollow');
  });
});
