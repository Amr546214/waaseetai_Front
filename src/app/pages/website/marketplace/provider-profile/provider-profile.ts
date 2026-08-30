import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MarketplaceService } from '../../../../core/services/marketplace.service';

@Component({
  selector: 'app-provider-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './provider-profile.html',
  styleUrl: './provider-profile.css'
})
export class ProviderProfileComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private route = inject(ActivatedRoute);
  private marketplaceService = inject(MarketplaceService);

  provider = signal<any>(null);
  loading = signal<boolean>(true);
  activeTab = signal<'profile' | 'services' | 'reviews' | 'portfolio'>('profile');

  constructor() {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initParticles();
      this.initFav();
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.fetchProviderProfile(id);
      }
    });
  }

  private fetchProviderProfile(id: string) {
    this.loading.set(true);
    this.marketplaceService.getProviderPublicProfile(id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.provider.set(res.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching provider profile:', err);
        this.loading.set(false);
      }
    });
  }

  private initParticles() {
    setTimeout(() => {
      const pc = document.getElementById('particles-container');
      if (!pc) return;
      pc.innerHTML = '';
      const n = window.innerWidth < 768 ? 11 : 25;
      for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.cssText = 'left:' + Math.random() * 100 + '%;width:' + (Math.random() * 3 + 2) + 'px;height:' + (Math.random() * 3 + 2) + 'px;animation-duration:' + (Math.random() * 20 + 15) + 's;animation-delay:-' + (Math.random() * 20) + 's';
        pc.appendChild(p);
      }
    }, 100);
  }

  private initFav() {
    setTimeout(() => {
      const favBtn = document.getElementById('fav-btn');
      if (favBtn && !(favBtn as any)._bound) {
        (favBtn as any)._bound = true;
        favBtn.addEventListener('click', function (this: HTMLElement) {
          this.innerHTML = '<svg aria-hidden="true" style="width:13px;height:13px"><use href="#ws-heart"></use></svg> محفوظ';
          this.style.color = 'var(--red)';
          this.style.borderColor = 'rgba(255,140,105,.3)';
        });
      }
    }, 100);
  }
}
