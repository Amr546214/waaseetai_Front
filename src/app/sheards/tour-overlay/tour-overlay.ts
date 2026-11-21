import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, viewChild } from '@angular/core';
import { TourService } from '../../core/tour/tour.service';
import { BeboAvatarComponent } from '../bebo-avatar/bebo-avatar';

const PAD = 8;
const CARD_W = 380;

/**
 * The guided-tour layer: a dimmed page with a spotlight around the element Bebo points at, and a card (Bebo + the step's text + controls) next to it.
 * The audio, the navigation and the target lookup live in TourService; this component only draws and handles the keyboard.
 */
@Component({
	selector: 'app-tour-overlay',
	standalone: true,
	imports: [BeboAvatarComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (tour.step(); as step) {
			<!-- data-ws-theme-owned: the site's light-theme polish script (public/assets/ws-light-polish.js) must not recolour this layer (it forced a white background on the spotlight and dark text on the card) -->
			<div class="ws-tx-layer" data-ws-theme-owned data-testid="tour-overlay">
				<div class="ws-tx-shield" aria-hidden="true"></div>
				@if (tour.targetRect(); as r) {
					<div class="ws-tx-hole" [class.ws-tx-hole--outline]="isBig()" aria-hidden="true"
						[style.top.px]="r.top - pad" [style.left.px]="r.left - pad" [style.width.px]="r.width + pad * 2" [style.height.px]="r.height + pad * 2"></div>
				} @else {
					<div class="ws-tx-dim" aria-hidden="true"></div>
				}
				<div #card class="ws-tx-panel" role="dialog" aria-modal="true" [attr.aria-label]="step.title" tabindex="-1" data-testid="tour-card"
					[class.ws-tx-panel--center]="!cardPos()" [style.top.px]="cardPos()?.top" [style.left.px]="cardPos()?.left">
					<div class="ws-tx-bebo" aria-hidden="true">
						<app-bebo-avatar [floating]="false" [size]="84" [state]="tour.speaking() ? 'speaking' : 'idle'" label="وسيط AI" />
					</div>
					<div class="ws-tx-body">
						<div class="ws-tx-meta">
							<span class="ws-tx-aimark" aria-hidden="true" title="وسيط AI"><svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/></svg></span><span class="ws-tx-count" data-testid="tour-count">{{ tour.index() + 1 }} / {{ tour.total() }}</span>
							<button type="button" class="ws-tx-icon" (click)="tour.toggleAuto()" [attr.aria-pressed]="tour.autoAdvance()" [attr.aria-label]="tour.autoAdvance() ? 'إيقاف الانتقال التلقائي' : 'تشغيل الانتقال التلقائي'" [title]="tour.autoAdvance() ? 'ينتقل تلقائيًا بعد انتهاء الصوت' : 'الانتقال التلقائي متوقف'" data-testid="tour-auto" [style.opacity]="tour.autoAdvance() ? 1 : .5">⏭</button>
							<button type="button" class="ws-tx-icon" (click)="tour.toggleMute()" [attr.aria-pressed]="tour.muted()" [attr.aria-label]="tour.muted() ? 'تشغيل الصوت' : 'كتم الصوت'" data-testid="tour-mute">{{ tour.muted() ? '🔇' : '🔊' }}</button>
							<button type="button" class="ws-tx-icon" (click)="tour.close()" aria-label="إغلاق الجولة" data-testid="tour-close">×</button>
						</div>
						<h2 class="ws-tx-title">{{ step.title }}</h2>
						<p class="ws-tx-text" aria-live="polite" data-testid="tour-text">{{ step.text }}</p>
						<div class="ws-tx-actions">
							<button type="button" class="ws-tx-act ws-tx-act--ghost" (click)="tour.skip()" data-testid="tour-skip">تخطي الجولة</button>
							<span class="ws-tx-spacer"></span>
							@if (!tour.isFirst()) { <button type="button" class="ws-tx-act" (click)="tour.back()" data-testid="tour-back">السابق</button> }
							<button type="button" class="ws-tx-act ws-tx-act--primary" (click)="tour.next()" data-testid="tour-next">{{ tour.isLast() ? 'إنهاء' : 'التالي' }}</button>
						</div>
					</div>
				</div>
			</div>
		}
	`,
	styles: [`
		:host { display: contents; }
		.ws-tx-layer { position: fixed; inset: 0; z-index: 100000; direction: rtl; font-family: inherit; }
		.ws-tx-shield { position: absolute; inset: 0; background: transparent; }
		.ws-tx-dim { position: absolute; inset: 0; background: rgba(2, 8, 12, .62); }
		.ws-tx-hole { position: absolute; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(2, 8, 12, .62), 0 0 0 3px #8b5cf6, 0 0 24px 4px rgba(139, 92, 246, .55); transition: top .25s ease, left .25s ease, width .25s ease, height .25s ease; pointer-events: none; }
		.ws-tx-panel { position: absolute; width: min(${CARD_W}px, calc(100vw - 24px)); display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 18px; background: #0f1b24; color: #eaf2f5; border: 1px solid #2a4350; box-shadow: 0 18px 50px rgba(0, 0, 0, .5); outline: none; }
		.ws-tx-panel--center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
		.ws-tx-bebo { flex: 0 0 84px; width: 84px; height: 84px; position: relative; }
		.ws-tx-body { flex: 1; min-width: 0; }
		.ws-tx-meta { display: flex; align-items: center; gap: 6px; }
		.ws-tx-aimark { display: inline-flex; color: #A56BE0; }
		.ws-tx-count { margin-inline-end: auto; font-size: 12px; opacity: .7; }
		.ws-tx-icon { background: none; border: 0; color: inherit; cursor: pointer; font-size: 17px; line-height: 1; padding: 4px 6px; border-radius: 8px; }
		.ws-tx-icon:hover, .ws-tx-icon:focus-visible { background: rgba(255, 255, 255, .1); }
		/* the site's global heading / paragraph colours would otherwise win on this dark card */
		.ws-tx-panel .ws-tx-title { margin: 4px 0 6px; font-size: 17px; font-weight: 800; color: #ffffff; }
		.ws-tx-panel .ws-tx-text { margin: 0 0 12px; font-size: 15px; line-height: 1.75; color: #dbe8ee; }
		.ws-tx-actions { display: flex; align-items: center; gap: 8px; }
		.ws-tx-spacer { flex: 1; }
		.ws-tx-act { white-space: nowrap; border: 1px solid #2f4b5a; background: transparent; color: inherit; border-radius: 999px; padding: 7px 16px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
		.ws-tx-act--primary { background: #7c3aed; border-color: #7c3aed; color: #fff; }
		.ws-tx-hole--outline { box-shadow: 0 0 0 3px #8b5cf6, 0 0 28px 6px rgba(139, 92, 246, .5); }
		.ws-tx-act--ghost { border-color: transparent; opacity: .75; font-weight: 600; }
		.ws-tx-act:hover, .ws-tx-act:focus-visible { filter: brightness(1.15); }
		@media (max-width: 640px) {
			.ws-tx-panel { left: 12px !important; right: 12px; top: auto !important; bottom: 12px; width: auto; transform: none; }
			.ws-tx-panel--center { top: auto; left: 12px; transform: none; }
			.ws-tx-bebo { flex-basis: 64px; width: 64px; height: 64px; }
		}
		@media (prefers-reduced-motion: reduce) { .ws-tx-hole { transition: none; } }
	`],
})
export class TourOverlayComponent {
	readonly tour = inject(TourService);
	readonly pad = PAD;
	private readonly card = viewChild<ElementRef<HTMLElement>>('card');

	/** a target as big as the screen (a whole page section) cannot be a cut-out: it only gets an outline, and the page stays visible */
	readonly isBig = computed(() => {
		const r = this.tour.targetRect();
		if (!r || typeof window === 'undefined') return false;
		return (Math.min(r.height, window.innerHeight) * Math.min(r.width, window.innerWidth)) > 0.55 * window.innerWidth * window.innerHeight;
	});

	/** where the card sits next to the spotlight (below when there is room, else above); null = centred */
	readonly cardPos = computed(() => {
		const r = this.tour.targetRect();
		if (!r || typeof window === 'undefined' || window.innerWidth <= 640) return null;
		const vh = window.innerHeight, vw = window.innerWidth, cardH = 230;
		if (this.isBig()) return { top: 76, left: Math.max(12, vw - CARD_W - 24) }; // the target fills the screen: park the card at the top edge instead of on top of the content
		const below = r.top + r.height + PAD + 14;
		const top = below + cardH <= vh ? below : Math.max(12, r.top - PAD - 14 - cardH);
		const left = Math.min(Math.max(12, r.left + r.width / 2 - CARD_W / 2), Math.max(12, vw - CARD_W - 12));
		return { top, left };
	});

	constructor() {
		// every new step: move keyboard focus into the card so a screen reader reads it and Esc / arrows work
		effect(() => { this.tour.step(); queueMicrotask(() => this.card()?.nativeElement.focus({ preventScroll: true })); });
		// the spotlight follows the target while any scroll container moves (the page itself or a dashboard panel): scroll events do not bubble, so listen in the capture phase
		if (typeof document !== 'undefined') {
			const follow = () => this.tour.refreshRect();
			document.addEventListener('scroll', follow, true);
			inject(DestroyRef).onDestroy(() => document.removeEventListener('scroll', follow, true));
		}
	}

	@HostListener('window:resize') onViewportChange() { this.tour.refreshRect(); }

	@HostListener('document:keydown', ['$event'])
	onKey(e: KeyboardEvent) {
		if (!this.tour.active()) return;
		if (e.key === 'Escape') { e.preventDefault(); this.tour.close(); }
		// the page is right-to-left: ArrowLeft goes forward, ArrowRight goes back
		else if (e.key === 'ArrowLeft') { e.preventDefault(); this.tour.next(); }
		else if (e.key === 'ArrowRight') { e.preventDefault(); this.tour.back(); }
	}
}
