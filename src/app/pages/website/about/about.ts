import { Component, ViewEncapsulation, inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.css',
  encapsulation: ViewEncapsulation.None
})
export class About implements OnInit, OnDestroy {
  public themeService = inject(ThemeService);
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

