import { Component, AfterViewInit, OnInit, PLATFORM_ID, inject, ViewEncapsulation } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

import { Hero } from './components/hero/hero';
import { Audience } from './components/audience/audience';
import { Steps } from './components/steps/steps';
import { Kpi } from './components/kpi/kpi';
import { MarketplacePreview } from './components/marketplace-preview/marketplace-preview';
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
    MarketplacePreview,
    AiFeatures,
    OffersPreview,
    Operations,
    Cta
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
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

  dismissCookie(value: string) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('ws-cookie', value);
    }
    this.showCookieBanner = false;
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
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
          obs.observe(el);
        });
      } else {
        reveals.forEach((el) => {
          el.classList.add('visible');
        });
      }
    }
  }
}
