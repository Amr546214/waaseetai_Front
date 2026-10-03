import { Component, AfterViewInit, OnInit, PLATFORM_ID, inject, ViewEncapsulation } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Hero } from './components/hero/hero';
import { Audience } from './components/audience/audience';
import { Steps } from './components/steps/steps';
import { Kpi } from './components/kpi/kpi';
import { AiFeatures } from './components/ai-features/ai-features';
import { OffersPreview } from './components/offers-preview/offers-preview';
import { Operations } from './components/operations/operations';
import { Cta } from './components/cta/cta';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink, 
    Hero,
    Audience,
    Steps,
    Kpi,
    AiFeatures,
    OffersPreview,
    Operations,
    Cta
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css', './home-design.css'],
  encapsulation: ViewEncapsulation.None
})
export class HomeComponent implements AfterViewInit, OnInit {
  showCookieBanner = false;
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      if (!localStorage.getItem('ws-cookie')) {
        this.showCookieBanner = true;
      }
    }
  }

  /**
   * Opening /#how-it-works scrolls to the section as soon as the router renders the page, but web fonts
   * and images settle afterwards and move the section, leaving its title under the fixed header. Re-align
   * once the page has settled, unless the user already started scrolling.
   */
  private realignHashTarget(): void {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    userEvents.forEach((e) => window.addEventListener(e, cancel, { once: true, passive: true }));
    const realign = () => {
      if (!cancelled) document.getElementById(id)?.scrollIntoView({ block: 'start' });
    };
    const settled = () => requestAnimationFrame(() => requestAnimationFrame(realign));
    const afterLoad = () => (document.fonts?.ready ?? Promise.resolve()).then(settled);
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
  }

  dismissCookie(value: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('ws-cookie', value);
    }
    this.showCookieBanner = false;
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.realignHashTarget();
      const pc = document.getElementById('particles-container');
      if (pc && pc.children.length === 0) {
        const n = window.innerWidth < 768 ? 11 : 25;
        for (let i = 0; i < n; i++) {
          const p = document.createElement('div');
          p.className = 'particle';
          const sz = (Math.random() * 2.5 + 2).toFixed(1) + 'px';
          p.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;width:${sz};height:${sz};animation-duration:${(Math.random() * 9 + 5).toFixed(1)}s;animation-delay:${(Math.random() * -12).toFixed(1)}s;opacity:${(Math.random() * .35 + .08).toFixed(2)}`;
          pc.appendChild(p);
        }
      }

      const reveals = document.querySelectorAll('.reveal');
      if ('IntersectionObserver' in window) {
        const obs = new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('visible');
              obs.unobserve(e.target);
            }
          });
        }, { threshold: 0.08 });
        reveals.forEach((el) => {
          // An element already on/near screen when this hook runs (e.g. after
          // hydration settles mid-scroll) may never fire an "entering
          // viewport" intersection event, so check its current position too
          // instead of relying solely on the observer's first callback.
          const rect = el.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            el.classList.add('visible');
          } else {
            obs.observe(el);
          }
        });
        // Safety net: never let a section stay invisible indefinitely if the
        // observer misses it for any reason (hydration timing, etc.).
        window.setTimeout(() => {
          document.querySelectorAll('.reveal:not(.visible)').forEach((el) => {
            el.classList.add('visible');
            obs.unobserve(el);
          });
        }, 2000);
      } else {
        reveals.forEach((el) => {
          el.classList.add('visible');
        });
      }
    }
  }
}
