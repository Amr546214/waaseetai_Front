import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SpecialtyService } from './specialty.service';

/**
 * Silent autosave of a live test's answers, honest about what the SERVER has confirmed.
 *  - One request in flight at a time, each carrying a monotonic `seq`: an older request can never replace a newer answer (the server also ignores a stale seq per question).
 *  - The page never claims "saved" on its own: `confirmed` is whatever the server answered with; an answer that is not in it is UNCONFIRMED and is shown as such.
 *  - A failed save is retried: with exponential back-off (2 s up to 30 s) while online, and immediately when the browser comes back online (event, not polling); a new answer is not needed.
 *  - Leaving (tab hidden, page hide, reload, route leave): the latest answers go out with a keepalive request that outlives the page; they stay unconfirmed until the server answers a later read.
 *  - No loader, no toast, no spinner for the whole page: background calls only.
 */
export type AutosaveState = 'saved' | 'saving' | 'unconfirmed' | 'idle';

@Injectable({ providedIn: 'root' })
export class ExamAutosaveService {
	private readonly api = inject(SpecialtyService);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private attemptId: string | null = null;
	private local: Record<string, string> = {};
	private seq = 0;
	private inFlight = false;
	private debounce: ReturnType<typeof setTimeout> | null = null;
	private retryTimer: ReturnType<typeof setTimeout> | null = null;
	private retryDelay = 2000;
	private cleanup: (() => void) | null = null;

	/** what the server last confirmed it holds */
	readonly confirmed = signal<Record<string, string>>({});
	readonly sending = signal(false);
	private readonly localSig = signal<Record<string, string>>({});
	/** answers the page has but the server has not confirmed */
	readonly unconfirmedCount = computed(() => { const c = this.confirmed(); return Object.entries(this.localSig()).filter(([q, a]) => c[q] !== a).length; });
	readonly state = computed<AutosaveState>(() => (this.attemptId === null && Object.keys(this.localSig()).length === 0 ? 'idle' : this.unconfirmedCount() === 0 ? 'saved' : this.sending() ? 'saving' : 'unconfirmed'));
	private readonly active = signal(false);
	readonly status = computed(() => (this.active() ? { state: this.state(), unconfirmed: this.unconfirmedCount() } : null));

	/** `initial` = answers the server already holds (resume): they are confirmed from the start. */
	start(attemptId: string, initial: Record<string, string> = {}): void {
		if (this.attemptId === attemptId) return;
		this.stop();
		this.attemptId = attemptId; this.active.set(true);
		this.local = { ...initial }; this.localSig.set({ ...initial }); this.confirmed.set({ ...initial });
		this.seq = Date.now();
		if (!this.browser) return;
		const d = document, w = window;
		const onHide = () => { if (d.visibilityState === 'hidden') this.flushKeepalive(); };
		const onPageHide = () => this.flushKeepalive();
		const onOnline = () => { this.retryDelay = 2000; this.flush(); };
		d.addEventListener('visibilitychange', onHide); w.addEventListener('pagehide', onPageHide); w.addEventListener('online', onOnline);
		this.cleanup = () => { d.removeEventListener('visibilitychange', onHide); w.removeEventListener('pagehide', onPageHide); w.removeEventListener('online', onOnline); };
	}

	/** Resume: the answers the server already holds are both the page's answers and confirmed. */
	adopt(answers: Record<string, string>): void {
		if (!this.attemptId) return;
		this.local = { ...answers }; this.localSig.set({ ...answers }); this.confirmed.set({ ...answers });
	}

	stop(): void {
		this.cleanup?.(); this.cleanup = null;
		if (this.debounce) clearTimeout(this.debounce); if (this.retryTimer) clearTimeout(this.retryTimer);
		this.debounce = this.retryTimer = null; this.attemptId = null; this.inFlight = false; this.sending.set(false); this.active.set(false);
		this.local = {}; this.localSig.set({}); this.confirmed.set({});
	}

	/** The page's current answers (all of them). Schedules a debounced save. */
	answersChanged(answers: Record<string, string>): void {
		if (!this.attemptId) return;
		this.local = { ...answers }; this.localSig.set({ ...answers });
		if (this.debounce) return;
		this.debounce = setTimeout(() => { this.debounce = null; this.flush(); }, 1500);
	}

	/** Save now (not debounced): used before submitting and when the connection returns. */
	flush(): void {
		const id = this.attemptId;
		if (!id || this.inFlight || this.unconfirmedCount() === 0) return;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) return; // the online event resumes it
		if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
		const snapshot = { ...this.local };
		const seq = Math.max(this.seq + 1, Date.now()); this.seq = seq;
		this.inFlight = true; this.sending.set(true);
		this.api.saveAttemptAnswers(id, snapshot, seq).subscribe({
			next: (r: any) => {
				if (this.attemptId !== id) return;
				this.inFlight = false; this.sending.set(false); this.retryDelay = 2000;
				const server = r?.data?.answers;
				if (server && typeof server === 'object') this.confirmed.set({ ...server });
				else if (r?.data?.saved) this.confirmed.update(c => ({ ...c, ...snapshot }));
				if (r?.data?.expired) return; // the test is over for this attempt: nothing more to save
				if (this.unconfirmedCount() === 0) return;
				// answers arrived while this request was out: send them now. If the server simply did not take what was sent, retry with back-off (never a tight loop)
				if (JSON.stringify(snapshot) !== JSON.stringify(this.local)) this.flush();
				else if (!this.retryTimer) { this.retryTimer = setTimeout(() => { this.retryTimer = null; this.flush(); }, this.retryDelay); this.retryDelay = Math.min(30000, this.retryDelay * 2); }
			},
			error: () => {
				if (this.attemptId !== id) return;
				this.inFlight = false; this.sending.set(false);
				const online = typeof navigator === 'undefined' || navigator.onLine !== false;
				if (online && !this.retryTimer) { this.retryTimer = setTimeout(() => { this.retryTimer = null; this.flush(); }, this.retryDelay); this.retryDelay = Math.min(30000, this.retryDelay * 2); }
			}
		});
	}

	private flushKeepalive(): void {
		const id = this.attemptId;
		if (!id || this.unconfirmedCount() === 0) return;
		this.seq = Math.max(this.seq + 1, Date.now());
		this.api.saveAttemptAnswersKeepalive(id, { ...this.local }, this.seq);
	}

	/** Called by the page just before it leaves the test through the app (route change / confirm leave). */
	flushOnLeave(): void { this.flushKeepalive(); }
}
