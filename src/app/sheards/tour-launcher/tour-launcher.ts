import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TourService } from '../../core/tour/tour.service';
import { PageTourEntry, pageTourFor } from '../../core/tour/tours/page-tours';

/**
 * The «جولة في هذه الصفحة» chip: shown only while the visitor is ON a page that has its own small tour (and, for the registration form, only once its fields
 * are on screen). It never starts a tour by itself and never shows inside a dashboard (no dashboard path has a page tour) or while a tour is running.
 */
@Component({
	selector: 'app-tour-launcher',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (entry(); as e) {
			<button type="button" class="ws-tl-chip" data-ws-theme-owned data-testid="tour-launcher" (click)="start(e)"
				[attr.aria-label]="done() ? 'إعادة الجولة في هذه الصفحة' : 'جولة في هذه الصفحة'">
				<span aria-hidden="true">🎧</span>
				<span>{{ done() ? 'إعادة الجولة في الصفحة' : 'جولة في هذه الصفحة' }}</span>
			</button>
		}
	`,
	styles: [`
		:host { display: contents; }
		.ws-tl-chip { position: fixed; z-index: 9000; inset-inline-end: 16px; bottom: 84px; display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px; border: 1px solid #5b3fb8; background: #1c1233; color: #f3eeff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(60, 30, 140, .35); }
		.ws-tl-chip:hover, .ws-tl-chip:focus-visible { background: #2a1a4d; }
		@media (max-width: 640px) { .ws-tl-chip { bottom: 76px; inset-inline-end: 10px; padding: 8px 13px; font-size: 13px; } }
	`],
})
export class TourLauncherComponent {
	private readonly router = inject(Router);
	private readonly tour = inject(TourService);
	private readonly doc = inject(DOCUMENT);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly path = signal((inject(Router).url || '/').split(/[?#]/)[0]);
	/** bumped by a light timer so the "form fields are on screen" check follows the page (the registration steps swap their content) */
	private readonly tick = signal(0);

	readonly entry = computed<PageTourEntry | null>(() => {
		this.tick();
		if (this.tour.active()) return null;
		const e = pageTourFor(this.path());
		if (!e) return null;
		if (e.presence && !this.doc.querySelector(e.presence)) return null;
		return e;
	});
	/** re-read when a tour starts / ends, so a finished tour flips the label */
	readonly done = computed(() => { this.tick(); this.tour.active(); const e = this.entry(); return !!e && this.tour.isDone(e.tour.id); });

	constructor() {
		if (!this.isBrowser) return;
		this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(e => { this.path.set(e.urlAfterRedirects.split(/[?#]/)[0]); this.tick.update(n => n + 1); });
		const timer = setInterval(() => { if (pageTourFor(this.path())?.presence) this.tick.update(n => n + 1); }, 700);
		inject(DestroyRef).onDestroy(() => clearInterval(timer));
	}

	start(entry: PageTourEntry): void { this.tour.start(entry.tour); }
}
