import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';

const handlers: Record<string, (p?: unknown) => void> = {};
vi.mock('socket.io-client', () => ({ io: vi.fn(() => ({ on: (e: string, h: (p?: unknown) => void) => { handlers[e] = h; }, disconnect: vi.fn() })) }));
import { io } from 'socket.io-client';
import { PlatformInfoService } from './platform-info.service';
import { PlatformStateService } from './platform-state.service';
import { SiteIdentityService } from '../identity/site-identity.service';

const URL = () => `${environment.url_api}/public/platform-state`;
const st = (on: boolean, revision: number, message = 'نعود قريبًا') => ({ success: true, data: { maintenance: { on, message: on ? message : '' }, revision } });
describe('PlatformStateService: live maintenance without a click or a reload', () => {
	let http: HttpTestingController; let svc: PlatformStateService; let info: PlatformInfoService;
	beforeEach(() => { vi.useFakeTimers(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); http = TestBed.inject(HttpTestingController); svc = TestBed.inject(PlatformStateService); info = TestBed.inject(PlatformInfoService); vi.mocked(io).mockClear(); });
	afterEach(() => { svc.stop(); vi.useRealTimers(); });

	it('reads the state when the site opens, connects ANONYMOUSLY, and a pushed event turns maintenance on and off at once (no HTTP call, no reload)', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1));
		expect(vi.mocked(io).mock.calls[0][1]).not.toHaveProperty('auth'); expect(info.maintenance()).toBeNull();
		handlers['platform:state']({ maintenance: { on: true, message: 'تحديث' }, revision: 2 }); expect(info.maintenance()).toBe('تحديث');
		handlers['platform:state']({ maintenance: { on: true, message: 'رسالة معدّلة' }, revision: 3 }); expect(info.maintenance()).toBe('رسالة معدّلة');
		handlers['platform:state']({ maintenance: { on: false, message: '' }, revision: 4 }); expect(info.maintenance()).toBeNull();
		http.expectNone(URL());
	});
	it('an older answer never overwrites a newer one (a slow resync cannot bring the page back after a push turned it off)', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1)); handlers['platform:state']({ maintenance: { on: false, message: '' }, revision: 10 });
		svc.apply({ maintenance: { on: true, message: 'قديم' }, revision: 5 }); expect(info.maintenance()).toBeNull();
	});
	it('re-reads after a socket reconnect, when the tab becomes visible again, and when the browser goes online', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1));
		handlers['connect'](); handlers['connect'](); http.expectOne(URL()).flush(st(true, 2)); expect(info.maintenance()).not.toBeNull();
		document.dispatchEvent(new Event('visibilitychange')); http.expectOne(URL()).flush(st(false, 3)); expect(info.maintenance()).toBeNull();
		window.dispatchEvent(new Event('online')); http.expectOne(URL()).flush(st(true, 4, 'بعد عودة الاتصال')); expect(info.maintenance()).toBe('بعد عودة الاتصال');
	});
	it('does not poll while idle; a pushed change is still applied after five minutes', () => {
		svc.start(); http.expectOne(URL()).flush(st(false, 1));
		vi.advanceTimersByTime(5 * 60_000); http.expectNone(URL());
		handlers['platform:state']({ maintenance: { on: true, message: 'تحديث فوري' }, revision: 2 });
		expect(info.maintenance()).toBe('تحديث فوري'); http.expectNone(URL());
	});
	it('a failed read keeps the last known state and starts only once', () => {
		svc.start(); svc.start(); http.expectOne(URL()).flush(st(true, 1)); expect(info.maintenance()).not.toBeNull();
		svc.refresh(); http.expectOne(URL()).flush('x', { status: 500, statusText: 'x' }); expect(info.maintenance()).not.toBeNull(); expect(vi.mocked(io)).toHaveBeenCalledTimes(1);
	});

	it('identity:changed re-reads the identity once per event (no polling), a reconnect re-reads it once, and the listener is registered once however often the socket reconnects', () => {
		const refresh = vi.spyOn(TestBed.inject(SiteIdentityService), 'refresh').mockResolvedValue(true);
		const on = vi.fn(); vi.mocked(io).mockImplementationOnce((() => ({ on: (e: string, h: (p?: unknown) => void) => { on(e); handlers[e] = h; }, disconnect: vi.fn() })) as never);
		svc.start(); http.expectOne(URL()).flush(st(false, 1));
		expect(on.mock.calls.filter(c => c[0] === 'identity:changed').length).toBe(1);
		handlers['identity:changed']({ at: 1 }); expect(refresh).toHaveBeenCalledTimes(1); expect(refresh).toHaveBeenLastCalledWith(true);
		handlers['connect'](); expect(refresh).toHaveBeenCalledTimes(1); // first connection: nothing missed
		http.match(URL()).forEach(r => r.flush(st(false, 1)));
		handlers['connect'](); handlers['connect'](); expect(refresh).toHaveBeenCalledTimes(3); // each reconnect reads once, no listener duplication
		expect(on.mock.calls.filter(c => c[0] === 'identity:changed').length).toBe(1);
		vi.advanceTimersByTime(10 * 60_000); expect(refresh).toHaveBeenCalledTimes(3);
		http.match(URL());
	});
});
