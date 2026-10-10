import { Component, OnInit, OnDestroy, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { computed } from '@angular/core';
import { GamificationService, ClientLevelResponse } from '../../../../../core/services/gamification.service';
import { LevelLadderComponent, LevelLadderView } from '../../../../../shared/levels/level-ladder.component';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { Subscription } from 'rxjs';
import { filter, take, switchMap } from 'rxjs/operators';

@Component({
	selector: 'app-profile-level',
	standalone: true,
	imports: [CommonModule, LevelLadderComponent],
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

  levelData = signal<ClientLevelResponse | null>(null);
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
        return this.gamificationService.getClientLevelDetails();
      })
    ).subscribe({
      next: (res) => {
        // The client's own level view (GET /profiles/level-details). Any failure shows the honest "unavailable" state, never made-up progress.
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

  /** The shared ladder card's view, from the backend payload only (cashback ladder; thresholds shown as the backend sends them). */
  ladder = computed<LevelLadderView | null>(() => {
    const d = this.levelData();
    if (!d) return null;
    const last = d.roadmap[d.roadmap.length - 1];
    const isTop = d.currentLevel.index >= (last?.index ?? 15);
    const cur = d.roadmap.find(l => l.isCurrent) ?? d.roadmap[0];
    const next = isTop ? null : { title: d.nextLevelProgress.title, percent: d.nextLevelProgress.nextCashbackRate };
    return {
      percentLabel: 'نسبة الكاش باك',
      current: { index: d.currentLevel.index, title: d.currentLevel.title, percent: d.currentStats.cashbackRate, color: cur?.color ?? { dark: '#9B8B7A', light: '#7A6B5A' } },
      next,
      stats: [
        { label: 'نقاطك', value: String(d.currentStats.points) },
        { label: 'مشاريع مكتملة', value: String(d.currentStats.completedProjects) },
        { label: 'نسبة الكاش باك', value: d.currentStats.cashbackRate + '%' },
      ],
      progress: isTop ? [] : [
        { key: 'points', label: 'النقاط', have: String(d.currentStats.points), need: String(d.currentStats.points + d.nextLevelProgress.pointsGap), percent: d.nextLevelProgress.pointsPercent },
        { key: 'projects', label: 'المشاريع المكتملة', have: String(d.currentStats.completedProjects), need: String(d.currentStats.completedProjects + d.nextLevelProgress.projectsGap), percent: d.nextLevelProgress.projectsPercent },
        { key: 'rating', label: 'متوسط التقييم المطلوب', have: d.currentStats.avgRating === null ? 'غير متاح' : String(d.currentStats.avgRating), need: String(d.nextLevelProgress.ratingRequired), percent: 0 },
      ],
      roadmap: d.roadmap.map(l => ({
        index: l.index, title: l.title, percent: l.rate, color: l.color, isCurrent: l.isCurrent,
        lines: [l.reqPoints + ' نقطة', l.reqProjects + ' مشروع', l.reqRating > 0 ? 'تقييم ' + l.reqRating : ''].filter(Boolean),
      })),
      notices: this.notices(d.limitations),
    };
  });

  private notices(limitations: string[]): string[] {
    const text: Record<string, string> = {
      CLIENT_POINTS_NOT_AWARDED: 'نقاط طالب الخدمة لا تُحتسب تلقائيًا بعد، لذلك يبقى تقدمك كما هو إلى حين تفعيلها.',
      CLIENT_RATING_NOT_AVAILABLE: 'تقييم طالب الخدمة غير متاح بعد، فلا يُحتسب شرط التقييم.',
      CASHBACK_NOT_CREDITED_YET: 'الكاش باك يظهر هنا حسب مستواك لكنه لا يُضاف إلى محفظتك تلقائيًا بعد.',
    };
    return limitations.map(k => text[k]).filter((t): t is string => !!t);
  }

  ngOnDestroy() {
    this.dataSub?.unsubscribe();
  }
}
