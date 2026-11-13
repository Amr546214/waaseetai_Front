import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ExamAutosaveService } from './exam-autosave.service';
import { SpecialtyService } from './specialty.service';

describe('ExamAutosaveService', () => {
	let save: ReturnType<typeof vi.fn>, keepalive: ReturnType<typeof vi.fn>;
	let svc: ExamAutosaveService;
	beforeEach(() => {
		vi.useFakeTimers();
		save = vi.fn(); keepalive = vi.fn();
		TestBed.configureTestingModule({ providers: [{ provide: SpecialtyService, useValue: { saveAttemptAnswers: save, saveAttemptAnswersKeepalive: keepalive } }] });
		svc = TestBed.inject(ExamAutosaveService);
	});
	afterEach(() => { svc.stop(); vi.useRealTimers(); vi.restoreAllMocks(); });

	it('unconfirmed until the server answers; confirmed only with the server\'s own answer map; never claims saved on its own', () => {
		const resp = new Subject<any>(); save.mockReturnValueOnce(resp).mockReturnValue(of({ data: { saved: true, answers: { '1': 'a' } } }));
		svc.start('a1'); svc.answersChanged({ '1': 'a' });
		expect(svc.status()).toEqual({ state: 'unconfirmed', unconfirmed: 1 });
		vi.advanceTimersByTime(1600);
		expect(save).toHaveBeenCalledWith('a1', { '1': 'a' }, expect.any(Number));
		expect(svc.status()?.state).toBe('saving');
		resp.next({ data: { saved: true, answers: {} } }); // the server does NOT hold it (e.g. stale): still unconfirmed
		expect(svc.unconfirmedCount()).toBe(1);
		vi.advanceTimersByTime(2500); // the retry (with back-off, not a tight loop) that follows
		expect(svc.status()).toEqual({ state: 'saved', unconfirmed: 0 });
	});
	it('one request at a time with increasing seq; answers that arrive while one is out go in the next', () => {
		const first = new Subject<any>(); save.mockReturnValueOnce(first).mockReturnValue(of({ data: { saved: true, answers: { '1': 'a', '2': 'b' } } }));
		svc.start('a1'); svc.answersChanged({ '1': 'a' }); vi.advanceTimersByTime(1600);
		svc.answersChanged({ '1': 'a', '2': 'b' }); vi.advanceTimersByTime(1600);
		expect(save).toHaveBeenCalledTimes(1); // the second waits for the first
		first.next({ data: { saved: true, answers: { '1': 'a' } } });
		expect(save).toHaveBeenCalledTimes(2);
		const seqs = save.mock.calls.map(c => c[2]); expect(seqs[1]).toBeGreaterThan(seqs[0]);
		expect(svc.status()?.state).toBe('saved');
	});
	it('a failed save is retried with back-off, and again when the browser comes back online, without a new answer', () => {
		save.mockReturnValue(throwError(() => new Error('net')));
		svc.start('a1'); svc.answersChanged({ '1': 'a' }); vi.advanceTimersByTime(1600);
		expect(save).toHaveBeenCalledTimes(1); expect(svc.status()?.state).toBe('unconfirmed');
		vi.advanceTimersByTime(2100); expect(save).toHaveBeenCalledTimes(2);
		vi.advanceTimersByTime(4100); expect(save).toHaveBeenCalledTimes(3);
		save.mockReturnValue(of({ data: { saved: true, answers: { '1': 'a' } } }));
		const nav = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		window.dispatchEvent(new Event('online')); // flush is skipped while the browser says offline
		nav.mockReturnValue(true); window.dispatchEvent(new Event('online'));
		expect(svc.status()?.state).toBe('saved');
	});
	it('offline: nothing is polled; the retry waits for the online event', () => {
		const nav = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		save.mockReturnValue(of({ data: { saved: true, answers: { '1': 'a' } } }));
		svc.start('a1'); svc.answersChanged({ '1': 'a' }); vi.advanceTimersByTime(60_000);
		expect(save).not.toHaveBeenCalled();
		nav.mockReturnValue(true); window.dispatchEvent(new Event('online'));
		expect(save).toHaveBeenCalledTimes(1);
	});
	it('leaving (page hide / tab hidden / route leave) sends the latest unconfirmed answers with a keepalive request before the debounce ends', () => {
		svc.start('a1'); svc.answersChanged({ '1': 'a', '2': 'b' });
		window.dispatchEvent(new Event('pagehide'));
		expect(keepalive).toHaveBeenCalledWith('a1', { '1': 'a', '2': 'b' }, expect.any(Number));
		keepalive.mockClear();
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
		document.dispatchEvent(new Event('visibilitychange'));
		expect(keepalive).toHaveBeenCalledTimes(1);
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
		svc.adopt({ '1': 'a', '2': 'b' }); keepalive.mockClear(); svc.flushOnLeave();
		expect(keepalive).not.toHaveBeenCalled(); // nothing unconfirmed: nothing to send
	});
	it('resume: answers the server already holds are confirmed from the start', () => {
		svc.start('a1', { '1': 'b' });
		expect(svc.status()).toEqual({ state: 'saved', unconfirmed: 0 });
		svc.answersChanged({ '1': 'b', '2': 'a' });
		expect(svc.unconfirmedCount()).toBe(1);
	});
});
