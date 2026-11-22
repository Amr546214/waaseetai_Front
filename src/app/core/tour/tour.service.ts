import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { TourDefinition, TourEndReason, TourStep, tourAudioUrl } from './tour.types';

const DONE_KEY = 'ws.tour.done.v1';
const MUTE_KEY = 'ws.tour.muted.v1';
const AUTO_KEY = 'ws.tour.auto.v1';
/** pause after the narration ends, before the tour moves on by itself */
export const TOUR_AUTO_ADVANCE_DELAY_MS = 900;
const safeGet = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* storage blocked: the tour still works */ } };

/**
 * Runs a guided tour: one active tour, one current step. It finds the element to point at (navigating first when the step lives on another page),
 * scrolls it into view, reports its rectangle, and plays the step's pre-rendered audio. A missing target or a missing audio file never stops the tour.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
	private readonly router = inject(Router);
	private readonly doc = inject(DOCUMENT);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	readonly tour = signal<TourDefinition | null>(null);
	readonly index = signal(0);
	/** viewport rectangle of the current target, or null (centred card) */
	readonly targetRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);
	/** true while the step's audio is playing: Bebo is "speaking" */
	readonly speaking = signal(false);
	readonly muted = signal(safeGet(MUTE_KEY) === '1');
	/** move to the next step by itself when the narration of this one ends (on by default; the user can turn it off) */
	readonly autoAdvance = signal(safeGet(AUTO_KEY) !== '0');

	readonly active = computed(() => this.tour() !== null);
	readonly step = computed<TourStep | null>(() => this.tour()?.steps[this.index()] ?? null);
	readonly total = computed(() => this.tour()?.steps.length ?? 0);
	readonly isFirst = computed(() => this.index() === 0);
	readonly isLast = computed(() => this.total() > 0 && this.index() === this.total() - 1);

	private audio: HTMLAudioElement | null = null;
	private seq = 0;
	private pollTimer: ReturnType<typeof setTimeout> | null = null;
	private autoTimer: ReturnType<typeof setTimeout> | null = null;
	/** called when a tour ends (for "mark as done" and for chaining a follow-up) */
	onEnd: ((tour: TourDefinition, reason: TourEndReason) => void) | null = null;

	isDone(tourId: string): boolean { try { return !!JSON.parse(safeGet(DONE_KEY) || '{}')[tourId]; } catch { return false; } }
	private markDone(tourId: string) { let all: Record<string, number> = {}; try { all = JSON.parse(safeGet(DONE_KEY) || '{}'); } catch { /* reset */ } all[tourId] = Date.now(); safeSet(DONE_KEY, JSON.stringify(all)); }

	start(tour: TourDefinition, from = 0): void {
		if (!this.isBrowser || !tour.steps.length) return;
		this.halt();
		this.tour.set(tour);
		this.go(Math.min(Math.max(0, from), tour.steps.length - 1));
	}
	next(): void { if (!this.active()) return; if (this.isLast()) this.stop('completed'); else this.go(this.index() + 1); }
	back(): void { if (this.active() && !this.isFirst()) this.go(this.index() - 1); }
	skip(): void { this.stop('skipped'); }
	close(): void { this.stop('closed'); }

	stop(reason: TourEndReason): void {
		const tour = this.tour();
		this.halt();
		this.tour.set(null);
		this.index.set(0);
		this.targetRect.set(null);
		if (!tour) return;
		if (reason === 'completed') this.markDone(tour.id);
		this.onEnd?.(tour, reason);
	}

	toggleAuto(): void {
		const on = !this.autoAdvance();
		this.autoAdvance.set(on);
		safeSet(AUTO_KEY, on ? '1' : '0');
		if (!on) this.clearAuto();
	}

	toggleMute(): void {
		const muted = !this.muted();
		this.muted.set(muted);
		safeSet(MUTE_KEY, muted ? '1' : '0');
		if (muted) this.stopAudio(); else if (this.step()) this.playAudio(this.step()!, this.seq);
	}

	/** re-measure the target (the overlay calls this on scroll / resize) */
	refreshRect(): void {
		const step = this.step();
		if (!step?.target || !this.isBrowser) return;
		const el = this.doc.querySelector(step.target);
		if (el) this.targetRect.set(this.measure(el));
	}

	private halt(): void {
		this.seq++;
		if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
		this.clearAuto();
		this.stopAudio();
	}

	private go(index: number): void {
		const tour = this.tour();
		if (!tour) return;
		this.halt();
		const seq = this.seq;
		this.index.set(index);
		this.targetRect.set(null);
		const step = tour.steps[index];
		const onRoute = !step.route || this.currentPath() === step.route.split(/[?#]/)[0];
		const proceed = () => { if (seq === this.seq) this.reveal(step, seq); };
		if (onRoute) proceed();
		else void this.router.navigateByUrl(step.route!).then(proceed, proceed);
	}

	private currentPath(): string { return (this.router.url || '/').split(/[?#]/)[0].replace(/\/$/, '') || '/'; }

	private reveal(step: TourStep, seq: number): void {
		this.playAudio(step, seq);
		if (step.click) { try { this.doc.querySelector<HTMLElement>(step.click)?.click(); } catch { /* a missing tab never stops the tour */ } }
		if (!step.target) return;
		const deadline = Date.now() + (step.waitMs ?? 4000);
		const look = () => {
			if (seq !== this.seq) return;
			const el = this.doc.querySelector(step.target!);
			if (el) {
				try { el.scrollIntoView({ block: el.getBoundingClientRect().height > (this.doc.defaultView?.innerHeight ?? 800) * 0.8 ? 'start' : 'center', behavior: this.reducedMotion() ? 'auto' : 'smooth' }); } catch { /* old browser */ }
				// measure after the scroll settles, then keep following (the overlay refreshes on scroll/resize)
				this.pollTimer = setTimeout(() => { if (seq === this.seq) this.targetRect.set(this.measure(el)); }, this.reducedMotion() ? 0 : 450);
				return;
			}
			if (Date.now() < deadline) this.pollTimer = setTimeout(look, 120);
			/* not found in time: no spotlight, the card is centred and the tour goes on */
		};
		look();
	}

	/** the rectangle of the target, or null when it takes no space (collapsed / hidden: e.g. the sidebar on a phone): then the card is centred */
	private measure(el: Element) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null; }
	private reducedMotion(): boolean { try { return !!this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

	private playAudio(step: TourStep, seq: number): void {
		this.stopAudio();
		if (this.muted() || !this.isBrowser || typeof Audio === 'undefined') return;
		const audio = new Audio(tourAudioUrl(step.id));
		this.audio = audio;
		audio.onplaying = () => { if (seq === this.seq) this.speaking.set(true); };
		audio.onended = () => { this.speaking.set(false); if (seq === this.seq) this.scheduleAutoAdvance(seq); };
		audio.onerror = () => this.speaking.set(false); // no audio file for this step: text only
		audio.play().catch(() => this.speaking.set(false)); // autoplay blocked / file missing: text only
	}

	private clearAuto(): void { if (this.autoTimer) { clearTimeout(this.autoTimer); this.autoTimer = null; } }

	/** the narration ended on its own (not stopped, not an error): after a short pause go to the next step. The last step waits for the user to finish. */
	private scheduleAutoAdvance(seq: number): void {
		this.clearAuto();
		if (!this.autoAdvance() || this.isLast()) return;
		this.autoTimer = setTimeout(() => { this.autoTimer = null; if (seq === this.seq && this.active() && !this.isLast()) this.next(); }, TOUR_AUTO_ADVANCE_DELAY_MS);
	}

	private stopAudio(): void {
		this.speaking.set(false);
		if (!this.audio) return;
		const audio = this.audio; this.audio = null;
		audio.onplaying = audio.onended = audio.onerror = null;
		try { audio.pause(); } catch { /* ignore */ }
	}
}
