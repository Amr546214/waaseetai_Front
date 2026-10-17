import { ChangeDetectorRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
(globalThis as any).__socketIoModule = () => ({ default: () => fakeSocket, io: () => fakeSocket });

import { MarketerAssets } from './marketer-overview/assets/assets';
import { MarketingBrokerOverview } from './marketer-overview/marketing-broker-overview/marketing-broker-overview';
import { InvoicesComponent } from './provider-overview/finance/invoices/invoices';
import { Wallet } from './clients-overview/finance/wallet/wallet';
import { NotificationsCenter } from './clients-overview/notifications/notifications-center/notifications-center';
import { MarketerOverviewService } from '../../core/services/marketer-overview.service';
import { ProviderApiService } from '../../core/services/provider-api.service';
import { ClientFinanceService } from '../../core/services/client-finance.service';
import { LAST_RATE_LIMIT_SCOPE } from '../../core/wait/wait-timer.service';
import { installMemoryStorage } from '../../core/wait/memory-storage.testkit';

// The flag-only load pages: a 429 with NOTHING loaded shows the ticking sentence and a retry that stays disabled until the stored end (no auto retry);
// a 429 while data is on screen keeps the data and shows a ticking note. The end timestamp is the one the rate-limit interceptor stores for the request.
const rl = () => new HttpErrorResponse({ status: 429, error: { message: 'طلبات كثيرة' } });
let restore: () => void = () => undefined;
beforeEach(() => { restore = installMemoryStorage(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T10:00:00Z')); });
afterEach(() => { vi.useRealTimers(); restore(); TestBed.resetTestingModule(); });

function storedEnd(seconds: number) {
	// what the rate-limit interceptor stores for the rate-limited request (the service loads it when a page first looks at the scope)
	localStorage.setItem('ws:wait:v1:' + LAST_RATE_LIMIT_SCOPE, JSON.stringify({ endsAt: Date.now() + seconds * 1000 }));
}
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const retryBtn = (el: HTMLElement) => q(el, 'load-retry-btn') as HTMLButtonElement;
const noteBtn = (el: HTMLElement) => q(el, 'rate-limit-note-btn') as HTMLButtonElement;

describe('marketer assets on 429', () => {
	function mount(getAssets: () => any) {
		TestBed.configureTestingModule({ imports: [MarketerAssets], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: { getAssets, getRefLinks: () => of({ success: true, data: null }) } }] });
		const f = TestBed.createComponent(MarketerAssets);
		f.detectChanges(); f.componentRef.injector.get(ChangeDetectorRef).markForCheck(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
	}
	it('nothing loaded: ticking sentence, retry disabled until the stored end, enabled at zero with no automatic load', () => {
		storedEnd(30);
		const getAssets = vi.fn(() => throwError(rl));
		const { f, el } = mount(getAssets);
		expect(q(el, 'load-retry-msg')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:30');
		expect(retryBtn(el).disabled).toBe(true);
		expect(el.textContent).not.toContain('تعذر تحميل المواد التسويقية');
		vi.advanceTimersByTime(31_000); f.detectChanges();
		expect(retryBtn(el).disabled).toBe(false);
		expect(getAssets).toHaveBeenCalledTimes(1);
	});
	it('files already shown stay, with a ticking note and a guarded refresh', () => {
		storedEnd(20);
		const ok = of({ success: true, data: { items: [{ id: 'a1', kind: 'BANNER', title: 'بنر 1', description: null, downloadUrl: 'https://x/y.png' }] } });
		const getAssets = vi.fn().mockReturnValueOnce(ok);
		const { f, c, el } = mount(getAssets);
		getAssets.mockReturnValueOnce(throwError(rl));
		c.load(); f.detectChanges();
		expect(el.querySelectorAll('[data-testid="asset-row"]').length).toBe(1);
		expect(q(el, 'rate-limit-note-text')!.textContent).toContain('بعد 0:20');
		expect(noteBtn(el).disabled).toBe(true);
	});
});

describe('provider invoices on 429', () => {
	it('nothing loaded: load-retry instead of the generic error; kept data: note', () => {
		storedEnd(45);
		const get = vi.fn().mockReturnValueOnce(throwError(rl));
		TestBed.configureTestingModule({ imports: [InvoicesComponent], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getProviderInvoices: get } }] });
		const f = TestBed.createComponent(InvoicesComponent); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(retryBtn(el).disabled).toBe(true);
		expect(el.querySelector('.error-card')).toBeNull();
		expect(q(el, 'load-retry-msg')!.textContent).toContain('0:45');
		vi.advanceTimersByTime(46_000); f.detectChanges();
		expect(retryBtn(el).disabled).toBe(false);
		expect(get).toHaveBeenCalledTimes(1);
	});
	it('invoices on screen stay when a reload is rate limited, with the ticking note', () => {
		storedEnd(15);
		const inv = { success: true, data: { invoices: [{ id: 'i1', status: 'paid', date: '2026-01-01T00:00:00Z', paymentDate: '2026-01-02T00:00:00Z', net: 1, total: 1, stageValue: 1, platformCommission: 0, tax: 0, currency: 'USD' }], summary: { totalCount: 1, paidCount: 1, dueCount: 0, paidNetTotal: 1, dueNetTotal: 0, platformCommissionTotal: 0, currency: 'USD' } } };
		const get = vi.fn().mockReturnValueOnce(of(inv));
		TestBed.configureTestingModule({ imports: [InvoicesComponent], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getProviderInvoices: get } }] });
		const f = TestBed.createComponent(InvoicesComponent); f.detectChanges();
		get.mockReturnValueOnce(throwError(rl));
		f.componentInstance.loadInvoices(); f.detectChanges();
		expect(f.componentInstance.invoices().length).toBe(1);
		expect(q(f.nativeElement, 'rate-limit-note-text')!.textContent).toContain('بعد 0:15');
	});
});

describe('client wallet on 429', () => {
	it('nothing loaded: load-retry (disabled until the end); data on screen: kept with a note', () => {
		storedEnd(25);
		const getWallet = vi.fn().mockReturnValueOnce(throwError(rl));
		TestBed.configureTestingModule({ imports: [Wallet], providers: [provideRouter([]), { provide: ClientFinanceService, useValue: { getWallet } }] });
		const f = TestBed.createComponent(Wallet); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(retryBtn(el).disabled).toBe(true);
		expect(el.querySelector('.error-card')).toBeNull();
		vi.advanceTimersByTime(26_000); f.detectChanges();
		expect(retryBtn(el).disabled).toBe(false);
		expect(getWallet).toHaveBeenCalledTimes(1);
		getWallet.mockReturnValueOnce(of({ success: true, data: { summary: { availableBalance: 40, escrowBalance: 0, activeProjectsCount: 0 }, transactions: [] } }));
		f.componentInstance.retryLoading(); f.detectChanges();
		expect(f.componentInstance.balance()).toBe(40);
	});
	it('a reload that is rate limited keeps the wallet and shows the ticking note', () => {
		storedEnd(12);
		const getWallet = vi.fn().mockReturnValueOnce(of({ success: true, data: { summary: { availableBalance: 40, escrowBalance: 0, activeProjectsCount: 0 }, transactions: [] } }));
		TestBed.configureTestingModule({ imports: [Wallet], providers: [provideRouter([]), { provide: ClientFinanceService, useValue: { getWallet } }] });
		const f = TestBed.createComponent(Wallet); f.detectChanges();
		getWallet.mockReturnValueOnce(throwError(rl));
		f.componentInstance.loadWalletData(); f.detectChanges();
		expect(f.componentInstance.balance()).toBe(40);
		expect(f.componentInstance.hasError()).toBe(false);
		expect(q(f.nativeElement, 'rate-limit-note-text')!.textContent).toContain('بعد 0:12');
	});
});

describe('marketer dashboard on 429', () => {
	it('shows the ticking sentence instead of the generic reload note; the page content stays', () => {
		storedEnd(40);
		TestBed.configureTestingModule({ imports: [MarketingBrokerOverview], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: {
			getSummary: () => throwError(rl), getChannelPerformance: () => of({ success: true, data: [] }), getRecentCommissions: () => of({ success: true, data: [] }),
			getAiInsights: () => of({ success: true, data: { status: 'NOT_ENOUGH_DATA', source: 'NONE', score: null, confidence: null, summary: null, recommendation: null, details: null, generatedAt: null } }),
		} }] });
		const f = TestBed.createComponent(MarketingBrokerOverview); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		expect(q(el, 'rate-limit-note-text')!.textContent).toContain('طلبات كثيرة، يمكنك إعادة المحاولة بعد 0:40');
		expect(el.textContent).not.toContain('أعد تحديث الصفحة');
		expect(el.textContent).toContain('ملخص لأدائك');
		vi.advanceTimersByTime(41_000); f.detectChanges();
		expect(q(el, 'rate-limit-note-text')!.textContent).not.toMatch(/\d:\d\d/); // after the wait only the honest line is left, no stale clock
	});
});

describe('client notifications on 429', () => {
	function mount(get: ReturnType<typeof vi.fn>) {
		TestBed.configureTestingModule({ imports: [NotificationsCenter], providers: [{ provide: HttpClient, useValue: { get, patch: vi.fn() } }, { provide: Router, useValue: { navigateByUrl: vi.fn(), navigate: vi.fn() } }] });
		const f = TestBed.createComponent(NotificationsCenter); f.detectChanges();
		return f;
	}
	it('nothing loaded: load-retry disabled until the end, no auto retry; the retry reloads only when pressed', () => {
		storedEnd(18);
		const get = vi.fn(() => throwError(() => rl()));
		const f = mount(get);
		const el = f.nativeElement as HTMLElement;
		expect(retryBtn(el).disabled).toBe(true);
		expect(el.textContent).not.toContain('تعذر تحميل الإشعارات');
		const calls = get.mock.calls.length;
		vi.advanceTimersByTime(19_000); f.detectChanges();
		expect(retryBtn(el).disabled).toBe(false);
		expect(get.mock.calls.length).toBe(calls);
		retryBtn(el).click();
		expect(get.mock.calls.length).toBeGreaterThan(calls);
	});
	it('notifications on screen stay on a rate limited reload, with the note', () => {
		storedEnd(9);
		const get = vi.fn(() => of({ success: true, data: [{ id: 'n1', title: 'عنوان', message: 'رسالة', type: 'GENERAL', category: 'ALL', isRead: false, createdAt: new Date().toISOString() }] }));
		const f = mount(get);
		get.mockReturnValue(throwError(() => rl()) as any);
		f.componentInstance.retry(); f.detectChanges();
		expect(f.componentInstance.notifications().length).toBeGreaterThan(0);
		expect(q(f.nativeElement, 'rate-limit-note-text')!.textContent).toContain('بعد 0:09');
	});
});
