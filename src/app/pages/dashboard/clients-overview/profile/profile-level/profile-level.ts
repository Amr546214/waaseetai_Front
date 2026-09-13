import { Component, OnInit, OnDestroy, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GamificationService, GamificationLevelResponse } from '../../../../../core/services/gamification.service';
import { AuthStore } from '../../../../../core/store/auth.store';
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
        if (res.success && res.data) {
          this.levelData.set(res.data);
        } else {
          this.levelData.set(this.getDemoData());
          this.loadError.set(true);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        // Expected when the user is a guest or the API is unavailable.
        // Do not spam the console for the expected SSR bypass case.
        if (!(err?.status === 401 && err?.statusText?.includes('SSR Bypassed'))) {
          console.error('Failed to load level data, using demo fallback', err);
        }
        this.levelData.set(this.getDemoData());
        this.loadError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  ngOnDestroy() {
    this.dataSub?.unsubscribe();
  }

  private getDemoData(): GamificationLevelResponse {
    const roadmap = [
      { index: 1, title: 'زائر', reqPoints: 0, reqProjects: 0, reqRating: 0, commission: 1, isCurrent: false, color: '#0FA99A', state: 'completed' as const },
      { index: 2, title: 'مستكشف', reqPoints: 51, reqProjects: 2, reqRating: 3.0, commission: 1.5, isCurrent: false, color: '#9B8B7A', state: 'completed' as const },
      { index: 3, title: 'باحث', reqPoints: 151, reqProjects: 5, reqRating: 3.5, commission: 2, isCurrent: false, color: '#CD7F32', state: 'completed' as const },
      { index: 4, title: 'عميل', reqPoints: 301, reqProjects: 9, reqRating: 4.0, commission: 2.5, isCurrent: true, color: '#7BA7D4', state: 'current' as const },
      { index: 5, title: 'داعم', reqPoints: 501, reqProjects: 13, reqRating: 4.1, commission: 2.75, isCurrent: false, color: '#5DA0FF', state: 'next' as const },
      { index: 6, title: 'ناشط', reqPoints: 751, reqProjects: 15, reqRating: 4.2, commission: 3, isCurrent: false, color: '#3B82F6', state: 'upcoming' as const },
      { index: 7, title: 'فعال', reqPoints: 1101, reqProjects: 20, reqRating: 4.3, commission: 3.25, isCurrent: false, color: '#2BD4C7', state: 'upcoming' as const },
      { index: 8, title: 'راعي', reqPoints: 1501, reqProjects: 25, reqRating: 4.4, commission: 3.5, isCurrent: false, color: '#06B6A2', state: 'upcoming' as const },
      { index: 9, title: 'سفير', reqPoints: 2001, reqProjects: 30, reqRating: 4.5, commission: 3.75, isCurrent: false, color: '#2ECC8A', state: 'upcoming' as const },
      { index: 10, title: 'استراتيجي', reqPoints: 2601, reqProjects: 35, reqRating: 4.6, commission: 4, isCurrent: false, color: '#FFB400', state: 'upcoming' as const },
      { index: 11, title: 'أساسي', reqPoints: 3301, reqProjects: 40, reqRating: 4.7, commission: 4.2, isCurrent: false, color: '#E6B800', state: 'upcoming' as const },
      { index: 12, title: 'مالك', reqPoints: 4101, reqProjects: 45, reqRating: 4.8, commission: 4.4, isCurrent: false, color: '#0EA5E9', state: 'upcoming' as const },
      { index: 13, title: 'مؤسس', reqPoints: 5001, reqProjects: 50, reqRating: 4.9, commission: 4.6, isCurrent: false, color: '#A78BFA', state: 'upcoming' as const },
      { index: 14, title: 'دائم', reqPoints: 6001, reqProjects: 55, reqRating: 4.95, commission: 4.8, isCurrent: false, color: '#E879F9', state: 'upcoming' as const },
      { index: 15, title: 'مؤسسي', reqPoints: 7201, reqProjects: 116, reqRating: 5.0, commission: 5, isCurrent: false, color: '#FFD700', state: 'upcoming' as const },
    ];
    return {
      currentStats: {
        points: 302,
        completedProjects: 9,
        avgRating: 4.0,
        commissionRate: 2.5
      },
      currentLevel: { index: 4, title: 'عميل' },
      nextLevelProgress: {
        title: 'داعم',
        pointsGap: 199,
        projectsGap: 4,
        ratingGap: 0.1,
        pointsPercent: 60.3,
        projectsPercent: 69.2,
        ratingPercent: 97.6,
        nextCommission: 2.75
      },
      aiRecommendation: 'توصية الذكاء: أكمل 4 مشاريع إضافية للوصول لمتطلبات المستوى التالي. السداد الفوري (+5 نقطة كل مرة) والتقييم المفصل (+10 نقطة) أسرع طريقة لكسب النقاط المتبقية.',
      roadmap,
      pointRules: {
        gainRules: [
          { label: 'إكمال مشروع', points: '+20 نقطة' },
          { label: 'إحالة ناجحة', points: '+30 نقطة' },
          { label: 'تقييم عالي من المقدم >4 نجوم', points: '+15 نقطة' },
          { label: 'تقييم مفصل', points: '+10 نقطة' },
          { label: 'طلب واضح (تقييم AI)', points: '+10 نقطة' },
          { label: 'سداد فوري (خلال 24 ساعة)', points: '+5 نقطة' },
          { label: 'مشروع عالي القيمة (لكل 20 بعد 200)', points: '+1 نقطة' },
        ],
        lossRules: [
          { label: 'تأخير السداد (أكثر من 48 ساعة)', points: '−25 نقطة' },
          { label: 'تعديل متطلبات متأخر (خلال 24 ساعة من التسليم)', points: '−20 نقطة' },
          { label: 'طلب غير واضح (بعد التحذير الأول)', points: '−15 نقطة' },
        ]
      }
    };
  }
}
