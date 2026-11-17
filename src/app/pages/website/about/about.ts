import { PublishedContentComponent } from '../../../shared/published-content/published-content.component';
import { Component, ViewEncapsulation, inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [PublishedContentComponent, RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.css',
  encapsulation: ViewEncapsulation.None
})
export class About implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
  /** the «سجّل حساباً مجاناً» button is for visitors only: a signed-in user already has an account */
  readonly authStore = inject(AuthStore);
  private platformId = inject(PLATFORM_ID);
  private particleTimer: any;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  ngOnDestroy(): void {
    if (this.particleTimer) {
      clearInterval(this.particleTimer);
    }
  }
}

