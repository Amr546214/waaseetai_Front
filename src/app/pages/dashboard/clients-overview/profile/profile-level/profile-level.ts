import { Component, OnInit, OnDestroy, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { Subscription } from 'rxjs';
import { filter, take, switchMap } from 'rxjs/operators';

@Component({
	selector: 'app-profile-level',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './profile-level.html',
	styles: [`
@keyframes ws-fade {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes skel-pulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.state-card {
  background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
  backdrop-filter: blur(12px);
  border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
  border-radius: 16px;
  padding: 24px;
}

.active-tab {
  color: var(--teal-txt, #2BD4C7) !important;
  border-bottom-color: var(--teal-txt, #2BD4C7) !important;
}

/* Base Light Mode override - typical for Waseet AI without using direct Tailwind dark: classes */
:host-context(body.light-theme) .active-tab,
:host-context(body.theme-light) .active-tab,
:host-context(.light-theme) .active-tab,
:host-context(.theme-light) .active-tab {
  color: #0F8A7F !important;
  border-bottom-color: #0F8A7F !important;
}

:host-context(body.light-theme) .req-card:hover,
:host-context(body.theme-light) .req-card:hover,
:host-context(.light-theme) .req-card:hover,
:host-context(.theme-light) .req-card:hover {
  border-color: rgba(43, 212, 199, 0.4) !important;
}
	`]
})
export class ProfileLevel implements OnInit, OnDestroy {
  private gamificationService = inject(GamificationService);
  private authStore = inject(AuthStore);
  private platformId = inject(PLATFORM_ID);
  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

  levelData = signal<GamificationLevelResponse | null>(null);
  isLoading = signal<boolean>(true);
  loadError = signal<boolean>(false);

  private dataSub?: Subscription;
  private hasRequested = false;

  ngOnInit() {
    // Do NOT call authenticated endpoints during SSR. The auth interceptor
    // throws a synthetic 401 ("SSR Bypassed - Unauthenticated") for any
    // /api/ call made on the server without a session token. We only fetch
    // once we are in the browser AND the AuthStore has finished initializing
    // the session (token/user) from cookies/localStorage.
    if (!isPlatformBrowser(this.platformId)) {
      // SSR: render shell only, no authenticated API call.
      this.isLoading.set(false);
      return;
    }

    // Browser: wait for auth initialization, then fetch exactly once.
    this.dataSub = this.authStore.isInitialized$.pipe(
      filter((initialized) => initialized),
      take(1),
      switchMap(() => {
        this.hasRequested = true;
        return this.gamificationService.getLevelDetails();
      })
    ).subscribe({
      next: (res) => {
        // Batch 7 fix: this page called the PROVIDER-only
        // /provider/gamification/level-details endpoint, so every client
        // request received a 403 and silently rendered fabricated demo
        // progression data as if it were real. There is no client-side
        // gamification ledger in the backend today (PointTransaction and
        // ProviderGamification are provider-only Prisma models) — building
        // one is a real, legitimate, schema-affecting feature (the client
        // sidebar does link here intentionally), not something to fake in
        // the meantime. Show an honest "not available yet" state instead.
        if (res.success && res.data) {
          this.levelData.set(res.data);
        } else {
          this.levelData.set(null);
          this.loadError.set(true);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.levelData.set(null);
        this.loadError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  ngOnDestroy() {
    this.dataSub?.unsubscribe();
  }
}
