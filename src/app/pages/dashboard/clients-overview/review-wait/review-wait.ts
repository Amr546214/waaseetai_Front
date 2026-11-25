import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ClientOnboardingStateService } from '../../../../core/services/client-onboarding-state.service';

export const REVIEW_POLL_MS = 20_000;

/** The one page an individual client sees after finishing «استكمال البيانات» while the identity is still under review (the rest of the dashboard is closed). */
@Component({
	selector: 'ws-review-wait',
	standalone: true,
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="rw" data-testid="review-wait" role="status" aria-live="polite">
			<span class="rw-spin" aria-hidden="true"></span>
			<h1>حسابك قيد المراجعة</h1>
			<p>أكملت بياناتك، وهي الآن قيد المراجعة. تفتح لوحتك تلقائيًا فور اعتماد الهوية.</p>
			<a class="rw-btn" routerLink="/client-overview/help/tickets/new" data-testid="review-wait-support">تواصل مع الدعم</a>
		</section>`,
	styles: [`
		.rw { max-width: 520px; margin: 12vh auto 0; padding: 32px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
		.rw h1 { margin: 0; font-size: 1.4rem; }
		.rw p { margin: 0; opacity: .8; line-height: 1.8; }
		.rw-spin { width: 56px; height: 56px; border-radius: 50%; border: 4px solid rgba(120,160,255,.25); border-top-color: #4aa3ff; animation: rw-rot 1s linear infinite; }
		.rw-btn { margin-top: 8px; padding: 10px 22px; border-radius: 12px; border: 1px solid rgba(120,160,255,.5); color: inherit; text-decoration: none; font-weight: 600; }
		.rw-btn:hover { background: rgba(74,163,255,.15); }
		@keyframes rw-rot { to { transform: rotate(360deg); } }
		@media (prefers-reduced-motion: reduce) { .rw-spin { animation-duration: 3s; } }
	`],
})
export class ReviewWaitComponent implements OnInit, OnDestroy {
	private readonly onboarding = inject(ClientOnboardingStateService);
	private readonly router = inject(Router);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private timer: ReturnType<typeof setInterval> | null = null;

	ngOnInit(): void {
		if (!this.browser) return;
		this.timer = setInterval(() => this.onboarding.load(true).subscribe(() => { if (!this.onboarding.reviewing()) void this.router.navigateByUrl('/client-overview'); }), REVIEW_POLL_MS);
	}
	ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }
}
