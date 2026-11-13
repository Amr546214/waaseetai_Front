import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';

const handlers: Record<string, (p?: unknown) => void> = {}; const ioHandlers: Record<string, () => void> = {};
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: (e: string, h: (p?: unknown) => void) => { handlers[e] = h; }, io: { on: (e: string, h: () => void) => { ioHandlers[e] = h; } }, disconnect: vi.fn() })) }));
import { io } from 'socket.io-client';
import { PlatformInfoService } from './platform-info.service';
import { PLATFORM_STATE_POLL_MS, PlatformStateService } from './platform-state.service';

const URL = () => `${environment.url_api}/public/platform-state`;
const st = (on: boolean, at: number, message = 'نعود قريبًا') => ({ success: true, data: { maintenance: { on, message: on ? message : '' }, at } });
describe('PlatformStateService: live maintenance without a click or a reload', () => {
	let http: HttpTestingController; let svc: PlatformStateService; let info: PlatformInfoService;
	beforeEach(() => { vi.useFakeTimers(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); svc = TestBed.inject(PlatformStateService); info = TestBed.inject(PlatformInfoService); vi.mocked(io).mockClear(); });
	afterEach(() => { svc.stop(); vi.useRealTimers(); });

	it('reads the state when the site opens, connects ANONYMOUSLY, and a pushed event turns maintenance on and off at once (no HTTP call, no reload)', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1));
		expect(vi.mocked(io).mock.calls[0][1]).not.toHaveProperty('auth'); expect(info.maintenance()).toBeNull();
		handlers['platform:state']({ maintenance: { on: true, message: 'تحديث' }, at: 2 }); expect(info.maintenance()).toBe('تحديث');
		handlers['platform:state']({ maintenance: { on: true, message: 'رسالة معدّلة' }, at: 3 }); expect(info.maintenance()).toBe('رسالة معدّلة');
		handlers['platform:state']({ maintenance: { on: false, message: '' }, at: 4 }); expect(info.maintenance()).toBeNull();
		http.expectNone(URL());
	});
	it('an older answer never overwrites a newer one (a slow poll cannot bring the page back after a push turned it off)', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1)); handlers['platform:state']({ maintenance: { on: false, message: '' }, at: 10 });
		svc.apply({ maintenance: { on: true, message: 'قديم' }, at: 5 }); expect(info.maintenance()).toBeNull();
	});
	it('re-reads after a socket reconnect, when the tab becomes visible again, and by the light fallback poll', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1));
		ioHandlers['reconnect'](); http.expectOne(URL()).flush(st(true, 2)); expect(info.maintenance()).not.toBeNull();
		document.dispatchEvent(new Event('visibilitychange')); http.expectOne(URL()).flush(st(false, 3)); expect(info.maintenance()).toBeNull();
		vi.advanceTimersByTime(PLATFORM_STATE_POLL_MS); http.expectOne(URL()).flush(st(true, 4, 'عبر الاستطلاع')); expect(info.maintenance()).toBe('عبر الاستطلاع');
	});
	it('a failed read keeps the last known state and starts only once', () => {
		svc.start(); svc.start(); http.expectOne(URL()).flush(st(true, 1)); expect(info.maintenance()).not.toBeNull();
		svc.refresh(); http.expectOne(URL()).flush('x', { status: 500, statusText: 'x' }); expect(info.maintenance()).not.toBeNull(); expect(vi.mocked(io)).toHaveBeenCalledTimes(1);
	});
});
