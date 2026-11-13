import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ExamIntegrityService } from './exam-integrity.service';
import { SpecialtyService } from './specialty.service';

describe('ExamIntegrityService', () => {
	let log: ReturnType<typeof vi.fn>;
	let svc: ExamIntegrityService;
	beforeEach(() => {
		log = vi.fn(() => of({ success: true }));
		TestBed.configureTestingModule({ providers: [{ provide: SpecialtyService, useValue: { logAttemptEvent: log } }] });
		svc = TestBed.inject(ExamIntegrityService);
	});
	afterEach(() => { svc.stop(); vi.restoreAllMocks(); });

	it('records page hidden / visible, window blur / focus and reload as plain events for the attempt (information only)', () => {
		svc.start('att-1', true);
		document.dispatchEvent(new Event('visibilitychange'));
		window.dispatchEvent(new Event('blur'));
		window.dispatchEvent(new Event('focus'));
		expect(log.mock.calls.map(c => c[1])).toEqual(['PAGE_RELOADED', 'PAGE_VISIBLE', 'WINDOW_BLUR', 'WINDOW_FOCUS']);
		expect(log.mock.calls.every(c => c[0] === 'att-1')).toBe(true);
	});
	it('a blur on its own is only an event: nothing is blocked, failed or thrown, and nothing starts without an attempt', () => {
		svc.log('WINDOW_BLUR');
		expect(log).not.toHaveBeenCalled();
		svc.start('att-2');
		expect(() => window.dispatchEvent(new Event('blur'))).not.toThrow();
		expect(log).toHaveBeenCalledWith('att-2', 'WINDOW_BLUR');
	});
	it('a failing request is swallowed silently (no throw, no retry storm)', () => {
		log.mockReturnValue(throwError(() => new Error('offline')));
		svc.start('att-3');
		expect(() => window.dispatchEvent(new Event('blur'))).not.toThrow();
		expect(log).toHaveBeenCalledTimes(1);
	});
	it('offline: events wait and go out when the connection returns; after stop() nothing is recorded', () => {
		const nav = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		svc.start('att-4');
		window.dispatchEvent(new Event('blur'));
		expect(log).not.toHaveBeenCalled();
		nav.mockReturnValue(true);
		window.dispatchEvent(new Event('online'));
		expect(log.mock.calls.map(c => c[1])).toContain('WINDOW_BLUR');
		svc.stop(); log.mockClear();
		window.dispatchEvent(new Event('blur'));
		expect(log).not.toHaveBeenCalled();
	});
});
