import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TourService } from '../../core/tour/tour.service';
import { PageTourEntry, pageTourFor, pageToursFor } from '../../core/tour/tours/page-tours';
import { AuthStore } from '../../core/store/auth.store';
import { ROLE_TOURS, ROLE_TOUR_AREAS } from '../../core/tour/tours/role-tours';

const SUGGESTED_KEY = 'ws.tour.suggested.v1';
const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* the suggestion may then appear again: harmless */ } };

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
			@if (suggesting()) {
				<div class="ws-tl-suggest" data-ws-theme-owned role="dialog" aria-label="اقتراح جولة" data-testid="tour-suggestion">
					<p><span class="ws-tl-ai" aria-hidden="true" style="margin-inline-end:6px"><svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/></svg></span>هل تحب جولة قصيرة تعرّفك على لوحتك؟</p>
					<div class="ws-tl-suggest-actions">
						<button type="button" class="ws-tl-yes" (click)="start(e)" data-testid="tour-suggestion-yes">ابدأ الجولة</button>
						<button type="button" class="ws-tl-no" (click)="dismissSuggestion()" data-testid="tour-suggestion-no">لاحقًا</button>
					</div>
				</div>
			}
			<button type="button" class="ws-tl-chip" data-ws-theme-owned data-testid="tour-launcher" (click)="start(e)"
				[attr.aria-label]="done() ? 'إعادة الجولة' : (e.label ?? 'جولة في هذه الصفحة')">
				<span aria-hidden="true" class="ws-tl-ai"><svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/></svg></span>
				<span>{{ done() ? 'إعادة الجولة' : (e.label ?? 'جولة في هذه الصفحة') }}</span>
			</button>
		}
	`,
	styles: [`
		:host { display: contents; }
		.ws-tl-chip { position: fixed; z-index: 9000; left: 16px; right: auto; bottom: 176px; /* just above Bebo (bottom-left) */ display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 999px; border: 1px solid #5b3fb8; background: #1c1233; color: #f3eeff; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(60, 30, 140, .35); }
		.ws-tl-ai { display: inline-flex; color: #C9A5F0; }
		.ws-tl-chip:hover, .ws-tl-chip:focus-visible { background: #2a1a4d; }
		.ws-tl-suggest { position: fixed; z-index: 9000; left: 16px; bottom: 228px; width: 250px; padding: 12px 14px; border-radius: 16px; background: #1c1233; color: #f3eeff; border: 1px solid #5b3fb8; box-shadow: 0 8px 24px rgba(60, 30, 140, .35); direction: rtl; }
		.ws-tl-suggest p { margin: 0 0 10px; font-size: 14px; line-height: 1.7; color: #f3eeff; }
		.ws-tl-suggest-actions { display: flex; gap: 8px; }
		.ws-tl-yes { flex: 1; padding: 7px 12px; border-radius: 999px; border: 0; background: #7c3aed; color: #fff; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
		.ws-tl-no { padding: 7px 12px; border-radius: 999px; border: 1px solid #5b3fb8; background: transparent; color: #f3eeff; font: inherit; font-size: 13px; cursor: pointer; }
		@media (max-width: 640px) { .ws-tl-suggest { bottom: 200px; left: 10px; width: calc(100vw - 20px); max-width: 300px; } }
		@media (max-width: 640px) { .ws-tl-chip { bottom: 150px; left: 10px; padding: 8px 13px; font-size: 13px; } }
	`],
})
export class TourLauncherComponent {
	private readonly router = inject(Router);
	private readonly tour = inject(TourService);
	private readonly doc = inject(DOCUMENT);
	private readonly auth = inject(AuthStore);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly path = signal((inject(Router).url || '/').split(/[?#]/)[0]);
	/** bumped by a light timer so the "form fields are on screen" check follows the page (the registration steps swap their content) */
	private readonly tick = signal(0);

	/** inside the dashboard of a role that has a tour, the signed-in user is offered THAT tour («جولة في لوحتك») */
	private roleEntry(): PageTourEntry | null {
		if (!this.auth.isAuthenticated()) return null;
		const role = this.auth.actingRole();
		const tour = role ? ROLE_TOURS[role] : undefined;
		const area = role ? ROLE_TOUR_AREAS[role] : undefined;
		if (!tour || !area) return null;
		const path = this.path();
		return path === area || path.startsWith(area + '/') ? { path: area, tour, label: 'جولة في لوحتك' } : null;
	}

	/** the one-time «تحب جولة؟» card: first visit to the dashboard of a role, per user, until it is accepted or dismissed */
	readonly suggestionHandled = signal(false);
	readonly suggesting = computed(() => {
		const e = this.entry();
		if (!e || !e.label || this.suggestionHandled() || this.tour.isDone(e.tour.id)) return false;
		return !this.suggestedBefore(e);
	});
	private suggestionKey(e: PageTourEntry) { return `${this.auth.currentUser()?.id ?? 'anon'}:${e.tour.id}`; }
	private suggestedBefore(e: PageTourEntry): boolean { try { return !!JSON.parse(safeGet(SUGGESTED_KEY) || '{}')[this.suggestionKey(e)]; } catch { return false; } }
	private markSuggested(e: PageTourEntry) { let all: Record<string, number> = {}; try { all = JSON.parse(safeGet(SUGGESTED_KEY) || '{}'); } catch { /* reset */ } all[this.suggestionKey(e)] = Date.now(); safeSet(SUGGESTED_KEY, JSON.stringify(all)); }
	dismissSuggestion(): void { const e = this.entry(); if (e) this.markSuggested(e); this.suggestionHandled.set(true); }

	readonly entry = computed<PageTourEntry | null>(() => {
		this.tick();
		if (this.tour.active()) return null;
		return this.roleEntry() ?? pageTourFor(this.path(), selector => !!this.doc.querySelector(selector));
	});
	/** re-read when a tour starts / ends, so a finished tour flips the label */
	readonly done = computed(() => { this.tick(); this.tour.active(); const e = this.entry(); return !!e && this.tour.isDone(e.tour.id); });

	constructor() {
		if (!this.isBrowser) return;
		this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(e => { this.path.set(e.urlAfterRedirects.split(/[?#]/)[0]); this.tick.update(n => n + 1); });
		const timer = setInterval(() => { if (pageToursFor(this.path()).some(e => e.presence)) this.tick.update(n => n + 1); }, 700);
		inject(DestroyRef).onDestroy(() => clearInterval(timer));
	}

	start(entry: PageTourEntry): void { this.markSuggested(entry); this.suggestionHandled.set(true); this.tour.start(entry.tour); }
}
