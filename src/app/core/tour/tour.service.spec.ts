import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { TourService, TOUR_AUTO_ADVANCE_DELAY_MS } from './tour.service';
import { TourDefinition, tourAudioUrl } from './tour.types';
import { VISITOR_TOUR } from './tours/visitor.tour';

const store: Record<string, string> = {};
class FakeAudio {
	static instances: FakeAudio[] = [];
	onplaying: (() => void) | null = null; onended: (() => void) | null = null; onerror: (() => void) | null = null;
	paused = false;
	constructor(public src: string) { FakeAudio.instances.push(this); }
	play() { return Promise.resolve(); }
	pause() { this.paused = true; }
}
const tour = (over: Partial<TourDefinition> = {}): TourDefinition => ({ id: 't1', title: 'T', steps: [
	{ id: 's1', title: 'أول', text: 'نص أول' },
	{ id: 's2', title: 'ثاني', text: 'نص ثاني', target: '#tour-target' },
	{ id: 's3', title: 'ثالث', text: 'نص ثالث', route: '/other' },
], ...over });

describe('TourService', () => {
	let svc: TourService; let navigated: string[];
	beforeEach(() => {
		vi.useFakeTimers();
		for (const k of Object.keys(store)) delete store[k];
		FakeAudio.instances = [];
		vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
		vi.stubGlobal('Audio', FakeAudio);
		navigated = [];
		TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { url: '/', navigateByUrl: (u: string) => { navigated.push(u); return Promise.resolve(true); } } }] });
		svc = TestBed.inject(TourService);
	});
	afterEach(() => { svc.close(); document.getElementById('tour-target')?.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

	it('start shows the first step; next / back move; the last next completes and marks the tour done', () => {
		const ended: string[] = []; svc.onEnd = (_t, r) => ended.push(r);
		svc.start(tour());
		expect(svc.active()).toBe(true); expect(svc.step()?.id).toBe('s1'); expect(svc.isFirst()).toBe(true);
		svc.next(); expect(svc.step()?.id).toBe('s2');
		svc.back(); expect(svc.step()?.id).toBe('s1');
		svc.next(); svc.next(); expect(svc.isLast()).toBe(true);
		svc.next();
		expect(svc.active()).toBe(false); expect(ended).toEqual(['completed']); expect(svc.isDone('t1')).toBe(true);
	});
	it('skip and close end the tour WITHOUT marking it done', () => {
		const ended: string[] = []; svc.onEnd = (_t, r) => ended.push(r);
		svc.start(tour()); svc.skip(); svc.start(tour()); svc.close();
		expect(ended).toEqual(['skipped', 'closed']); expect(svc.isDone('t1')).toBe(false);
	});
	it('a step on another route navigates there first; a step on the current route does not', async () => {
		svc.start(tour(), 2);
		await Promise.resolve(); await Promise.resolve();
		expect(navigated).toEqual(['/other']);
		navigated.length = 0; svc.start(tour(), 0);
		expect(navigated).toEqual([]);
	});
	it('the target is found, scrolled into view and measured; a missing target gives no rectangle and the tour keeps working', () => {
		const el = document.createElement('div'); el.id = 'tour-target'; document.body.appendChild(el);
		el.scrollIntoView = vi.fn();
		el.getBoundingClientRect = () => ({ top: 10, left: 20, width: 100, height: 40 } as DOMRect);
		svc.start(tour(), 1);
		vi.advanceTimersByTime(600);
		expect(el.scrollIntoView).toHaveBeenCalled();
		expect(svc.targetRect()).toEqual({ top: 10, left: 20, width: 100, height: 40 });
		el.remove();
		svc.start(tour(), 1);
		vi.advanceTimersByTime(5000);
		expect(svc.targetRect()).toBeNull(); expect(svc.active()).toBe(true);
		svc.next(); expect(svc.step()?.id).toBe('s3');
	});
	it('a target that appears late (after navigation) is still found within the wait window', () => {
		svc.start(tour(), 1);
		vi.advanceTimersByTime(1000);
		expect(svc.targetRect()).toBeNull();
		const el = document.createElement('div'); el.id = 'tour-target'; document.body.appendChild(el);
		el.scrollIntoView = vi.fn(); el.getBoundingClientRect = () => ({ top: 1, left: 2, width: 3, height: 4 } as DOMRect);
		vi.advanceTimersByTime(800);
		expect(svc.targetRect()).toEqual({ top: 1, left: 2, width: 3, height: 4 });
	});
	it('each step plays its pre-rendered audio file; changing step stops the previous one; Bebo speaks only while it plays', () => {
		svc.start(tour());
		expect(FakeAudio.instances.at(-1)!.src).toBe(tourAudioUrl('s1'));
		const first = FakeAudio.instances.at(-1)!;
		first.onplaying?.(); expect(svc.speaking()).toBe(true);
		first.onended?.(); expect(svc.speaking()).toBe(false);
		svc.next();
		expect(first.paused).toBe(true); expect(FakeAudio.instances.at(-1)!.src).toBe(tourAudioUrl('s2'));
	});
	it('a missing audio file is not an error: text only, Bebo is not "speaking"', () => {
		svc.start(tour());
		const a = FakeAudio.instances.at(-1)!;
		a.onplaying?.(); a.onerror?.();
		expect(svc.speaking()).toBe(false); expect(svc.active()).toBe(true);
	});
	it('mute is remembered, stops the audio and prevents new audio; unmute plays the current step again', () => {
		svc.start(tour());
		svc.toggleMute();
		expect(svc.muted()).toBe(true); expect(store['ws.tour.muted.v1']).toBe('1'); expect(FakeAudio.instances.at(-1)!.paused).toBe(true);
		const before = FakeAudio.instances.length;
		svc.next(); expect(FakeAudio.instances.length).toBe(before);
		svc.toggleMute(); expect(FakeAudio.instances.length).toBe(before + 1);
	});
	it('the visitor tour is well formed: unique ids (audio file names), Arabic text, never inside the dashboard', () => {
		const ids = VISITOR_TOUR.steps.map(s => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of VISITOR_TOUR.steps) { expect(s.text.length).toBeGreaterThan(20); expect(/[؀-ۿ]/.test(s.text)).toBe(true); expect(s.route === '/' || s.route === '/auth/register').toBe(true); }
	});

	describe('auto-advance when the narration ends', () => {
		const wait = () => vi.advanceTimersByTime(TOUR_AUTO_ADVANCE_DELAY_MS + 50);
		it('after the audio ends, the tour goes to the next step by itself (after a short pause)', () => {
			svc.start(tour());
			FakeAudio.instances.at(-1)!.onended?.();
			expect(svc.step()?.id).toBe('s1');           // not instantly: a pause first
			wait();
			expect(svc.step()?.id).toBe('s2');
			expect(FakeAudio.instances.at(-1)!.src).toBe(tourAudioUrl('s2')); // and the next narration starts
		});
		it('the last step does not close the tour by itself', async () => {
			svc.start(tour(), 2);
			await Promise.resolve(); await Promise.resolve(); // the last step lives on another route: its narration starts after the navigation
			FakeAudio.instances.at(-1)!.onended?.(); wait();
			expect(svc.active()).toBe(true); expect(svc.isLast()).toBe(true);
		});
		it('the user moving first cancels the pending auto-advance (no double jump)', () => {
			svc.start(tour());
			FakeAudio.instances.at(-1)!.onended?.();
			svc.next();                                   // the user pressed «التالي» during the pause
			wait();
			expect(svc.step()?.id).toBe('s2');            // not s3
		});
		it('turning it off stops the jump and is remembered; turning it on again works from the next step', () => {
			svc.start(tour());
			svc.toggleAuto();
			expect(svc.autoAdvance()).toBe(false); expect(store['ws.tour.auto.v1']).toBe('0');
			FakeAudio.instances.at(-1)!.onended?.(); wait();
			expect(svc.step()?.id).toBe('s1');
			svc.toggleAuto(); svc.next();
			FakeAudio.instances.at(-1)!.onended?.(); wait();
			expect(svc.step()?.id).toBe('s3');
		});
		it('a missing audio file or a muted tour never moves on by itself (the user reads and presses next)', () => {
			svc.start(tour());
			FakeAudio.instances.at(-1)!.onerror?.(); wait();
			expect(svc.step()?.id).toBe('s1');
			svc.toggleMute(); svc.next(); wait();
			expect(svc.step()?.id).toBe('s2');
		});
		it('closing the tour while a jump is pending does nothing afterwards', () => {
			svc.start(tour());
			FakeAudio.instances.at(-1)!.onended?.();
			svc.close(); wait();
			expect(svc.active()).toBe(false);
		});
	});
});
