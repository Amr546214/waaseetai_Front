import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthStore } from '../store/auth.store';
import { NotificationEngineService, NOTIFICATION_SOCKET_FACTORY } from './notification-engine.service';
import { RatingSummary } from '../../sheards/rating-summary/rating-summary.component';
import { RatingApiService } from './rating-api.service';
import { AccountActionsPage } from '../../pages/dashboard/provider-overview/account-actions/account-actions';
import { ProviderApiService } from './provider-api.service';
import { ProviderAccessService } from './provider-access.service';

/**
 * Deploy-window compatibility: the NEW frontend running against the OLD backend (before the backend swap). Each case is a response/404 the old server really gives.
 * The old server: GET /notifications ignores `since` and has no unreadCount; has no provider stage rating-status; has no /provider/account-actions.
 */
const n = (id: string, at: string) => ({ id, title: id, message: 'm', createdAt: at, isRead: false });

describe('new FE vs old BE: notification recovery (no since / unreadCount on the server)', () => {
	let engine: NotificationEngineService; let http: HttpTestingController;
	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: NOTIFICATION_SOCKET_FACTORY, useValue: () => ({ on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() }) }, { provide: AuthStore, useValue: { currentUser: signal({ id: 'u1' }), token: () => 't' } }] });
		engine = TestBed.inject(NotificationEngineService); http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

	it('an old server answers EVERY unread row: rows older than what is held are not announced, the bell becomes the exact unread total', async () => {
		engine.registerArrival(n('held', '2026-10-15T10:00:00.000Z'));
		(engine as any).recoveredOnce = true; (engine as any).joinedUserId = 'u1'; // a reconnect inside a page that already did its first (silent) recovery
		const shown: string[] = []; const toast = vi.spyOn(engine, 'triggerToast');
		const orig = engine.realtimeNewNotification.set.bind(engine.realtimeNewNotification);
		engine.realtimeNewNotification.set = (v: any) => { shown.push(v.id); orig(v); };
		engine.recoverMissed();
		const req = http.expectOne(r => r.url.endsWith('/notifications'));
		expect(req.request.params.get('since')).toBe('2026-10-15T10:00:00.000Z');
		// no unreadCount: an old server. "ancient" was unread long ago and never loaded here; "missed" really arrived while offline.
		req.flush({ success: true, data: [n('missed', '2026-10-15T10:05:00.000Z'), n('held', '2026-10-15T10:00:00.000Z'), n('ancient', '2026-10-01T08:00:00.000Z')] });
		expect(shown).toEqual(['missed']);
		await vi.waitFor(() => expect(toast).toHaveBeenCalledTimes(1)); // the popup claim is async (cross-tab lock)
		expect(engine.unreadCount()).toBe(3);
	});
	it('first connect against an old server (nothing held): everything unread is shown once and the bell is the list size', () => {
		engine.recoverMissed();
		const req = http.expectOne(r => r.url.endsWith('/notifications'));
		expect(req.request.params.has('since')).toBe(false);
		req.flush({ success: true, data: [n('b', '2026-10-15T10:05:00.000Z'), n('a', '2026-10-15T10:00:00.000Z')] });
		expect(engine.unreadCount()).toBe(2);
		engine.recoverMissed();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('b', '2026-10-15T10:05:00.000Z'), n('a', '2026-10-15T10:00:00.000Z')] });
		expect(engine.unreadCount()).toBe(2); // the same payload again changes nothing
	});
	it('a new server (numeric unreadCount) is unchanged: the server total wins and nothing is filtered client-side', () => {
		engine.registerArrival(n('held', '2026-10-15T10:00:00.000Z'));
		engine.recoverMissed();
		http.expectOne(r => r.url.endsWith('/notifications')).flush({ success: true, data: [n('x', '2026-10-15T10:05:00.000Z')], unreadCount: 9 });
		expect(engine.unreadCount()).toBe(9);
	});
});

describe('new FE vs old BE: reads the old server does not have', () => {
	afterEach(() => TestBed.resetTestingModule());
	const notFound = () => throwError(() => ({ status: 404, error: { message: 'Not found' } }));

	it('provider stage rating (404 on an old server): nothing is drawn, no dead retry button', () => {
		TestBed.configureTestingModule({ providers: [{ provide: RatingApiService, useValue: { getProviderStageRatingStatus: vi.fn(notFound) } }] });
		const f = TestBed.createComponent(RatingSummary);
		f.componentRef.setInput('side', 'provider'); f.componentRef.setInput('key', 'p1'); f.componentRef.setInput('stageId', 's1'); f.detectChanges();
		expect((f.nativeElement as HTMLElement).textContent?.trim()).toBe('');
		expect(f.nativeElement.querySelector('[data-testid="rating-summary-retry"]')).toBeNull();
	});
	it('a 500 on the same read still shows the retry (only the 404 is silent)', () => {
		TestBed.configureTestingModule({ providers: [{ provide: RatingApiService, useValue: { getProviderStageRatingStatus: vi.fn(() => throwError(() => ({ status: 500 }))) } }] });
		const f = TestBed.createComponent(RatingSummary);
		f.componentRef.setInput('side', 'provider'); f.componentRef.setInput('key', 'p1'); f.componentRef.setInput('stageId', 's1'); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="rating-summary-retry"]')).not.toBeNull();
	});
	it('account-actions page on an old server: the access banner works, the log says unavailable (not "no requests", no dead retry)', () => {
		const access = { load: () => of({ state: 'PENDING_REVIEW', canAccessDashboard: false, message: 'قيد المراجعة', reason: null, hasSample: true, specialties: [] }), invalidate: vi.fn() };
		TestBed.configureTestingModule({ imports: [AccountActionsPage], providers: [provideRouter([]), { provide: ProviderAccessService, useValue: access }, { provide: ProviderApiService, useValue: { getAccountActions: vi.fn(notFound) } }] });
		const f = TestBed.createComponent(AccountActionsPage); f.detectChanges();
		const el = f.nativeElement as HTMLElement; const q = (id: string) => el.querySelector(`[data-testid="${id}"]`);
		expect(q('status-message')?.textContent).toContain('قيد المراجعة');
		expect(q('log-unavailable')).not.toBeNull(); expect(q('log-empty')).toBeNull(); expect(q('log-error')).toBeNull();
	});
	it('account-actions page: a 500 on the log is still the error with retry', () => {
		const access = { load: () => of({ state: 'PENDING_REVIEW', canAccessDashboard: false, message: 'x', reason: null, hasSample: true, specialties: [] }), invalidate: vi.fn() };
		TestBed.configureTestingModule({ imports: [AccountActionsPage], providers: [provideRouter([]), { provide: ProviderAccessService, useValue: access }, { provide: ProviderApiService, useValue: { getAccountActions: () => throwError(() => ({ status: 500 })) } }] });
		const f = TestBed.createComponent(AccountActionsPage); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="log-error"]')).not.toBeNull();
	});
});
