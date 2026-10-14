import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';

import { MarketingBrokerOverview } from './marketing-broker-overview/marketing-broker-overview';
import { RefLinks } from './ref-links/ref-links';
import { Commissions } from './commissions/commissions';
import { MarketerOverviewService } from '../../../core/services/marketer-overview.service';
import { channelLabel, commissionTypeLabel, copyText } from '../../../core/utils/marketer-labels.util';

const EMPTY_SUMMARY = { tier: 'مساعد', successfulReferrals: 0, totalCommissions: 0, overallConversionRate: 0, totalVisits: 0, totalReferrals: 0, pendingReferrals: 0, qualifiedReferrals: 0, pendingCommissions: 0, paidCommissions: 0 };

function svc(over: any = {}) {
	return {
		getSummary: () => of({ success: true, data: EMPTY_SUMMARY }),
		getChannelPerformance: () => of({ success: true, data: [] }),
		getRecentCommissions: () => of({ success: true, data: [] }),
		getAiInsights: () => of({ success: false, data: null }),
		getRefLinks: () => of({ success: true, data: { primarySlug: 'abc', primaryLink: '', customLinks: [{ id: 'c1', channelName: 'x', utmSource: 'x' }], settings: { notifyOnNewReferral: true, sharePerformanceStats: false } } }),
		createCustomLink: () => of({ success: true, data: {} }),
		deleteCustomLink: () => of({ success: true, data: { id: 'c1' } }),
		updateSettings: () => of({ success: true, data: {} }),
		...over,
	};
}

function make<T>(cmp: new (...a: any[]) => T, service: any) {
	TestBed.configureTestingModule({ imports: [cmp as any], providers: [provideRouter([]), { provide: MarketerOverviewService, useValue: service }] });
	const fixture = TestBed.createComponent(cmp as any);
	fixture.detectChanges();
	return fixture;
}

describe('Marketer dashboard (M1)', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('shows zeros and honest empty states when the marketer has no data', () => {
		const f = make(MarketingBrokerOverview, svc());
		const text = (f.nativeElement as HTMLElement).textContent!;
		expect(text).toContain('لا توجد عمولات سابقة حالياً');
		expect(text).toContain('لا توجد زيارات مسجّلة لروابطك بعد');
		const vals = Array.from((f.nativeElement as HTMLElement).querySelectorAll('.kpi-val')).map((e) => e.textContent!.trim());
		expect(vals.slice(0, 4)).toEqual(['0', '0', '0', '0']);
	});

	it('renders real aggregates from the backend (no fixed numbers)', () => {
		const f = make(MarketingBrokerOverview, svc({
			getSummary: () => of({ success: true, data: { ...EMPTY_SUMMARY, totalReferrals: 7, totalVisits: 42, totalCommissions: 120, pendingCommissions: 15 } }),
			getChannelPerformance: () => of({ success: true, data: [{ channel: 'TIKTOK', visitors: 10, clients: 2, conversionPercentage: 20 }] }),
			getRecentCommissions: () => of({ success: true, data: [{ id: '1', source: 'إحالة: Sara', type: 'STAGE_RELEASE', time: '2026-01-01', amount: 9, currency: 'USD', status: 'APPROVED' }] }),
		}));
		const el = f.nativeElement as HTMLElement;
		const vals = Array.from(el.querySelectorAll('.kpi-val')).map((e) => e.textContent!.trim());
		expect(vals.slice(0, 4)).toEqual(['7', '42', '120', '15']);
		expect(el.textContent).toContain('تيك توك');
		expect(el.textContent).toContain('إفراج مرحلة');
		expect(el.textContent).toContain('مؤكد');
	});

	it('tells the user when a dashboard request failed instead of silently showing zeros', () => {
		const f = make(MarketingBrokerOverview, svc({ getSummary: () => throwError(() => new Error('x')) }));
		expect((f.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeTruthy();
	});
});

describe('Referral links (M1)', () => {
	afterEach(() => { vi.restoreAllMocks(); TestBed.resetTestingModule(); });

	it('copy really writes the link to the clipboard', async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		const f = make(RefLinks, svc());
		await (f.componentInstance as RefLinks).copyToClipboard('https://x/ref/abc');
		expect(writeText).toHaveBeenCalledWith('https://x/ref/abc');
		expect((f.componentInstance as RefLinks).toastMessage()).toContain('تم نسخ');
	});

	it('copy failure is reported, not swallowed', async () => {
		Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
		const f = make(RefLinks, svc());
		await (f.componentInstance as RefLinks).copyToClipboard('https://x/ref/abc');
		expect((f.componentInstance as RefLinks).toastMessage()).toContain('تعذر');
	});

	it('share uses Web Share when available and falls back to copy otherwise', async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'share', { value: share, configurable: true });
		const f = make(RefLinks, svc());
		const c = f.componentInstance as RefLinks;
		await c.shareLink('https://x/ref/abc');
		expect(share).toHaveBeenCalledWith({ title: 'رابط الإحالة في وسيط', url: 'https://x/ref/abc' });

		Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
		await c.shareLink('https://x/ref/abc');
		expect(writeText).toHaveBeenCalledWith('https://x/ref/abc');
	});

	it('removing a channel link calls the backend and drops it from the list; a failure keeps it', () => {
		const del = vi.fn(() => of({ success: true, data: { id: 'c1' } }));
		const f = make(RefLinks, svc({ deleteCustomLink: del }));
		const c = f.componentInstance as RefLinks;
		c.removeCustomLink('c1');
		expect(del).toHaveBeenCalledWith('c1');
		expect(c.data()!.customLinks.length).toBe(0);
	});

	it('a failed link removal keeps the link and says so', () => {
		const f2 = make(RefLinks, svc({ deleteCustomLink: () => throwError(() => new Error('x')) }));
		(f2.componentInstance as RefLinks).removeCustomLink('c1');
		expect((f2.componentInstance as RefLinks).data()!.customLinks.length).toBe(1);
		expect((f2.componentInstance as RefLinks).toastMessage()).toContain('تعذر');
	});
});

describe('Commissions page (M1)', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('held / withdrawn come from the server totals, not from the loaded page', () => {
		const f = make(Commissions, svc({ getSummary: () => of({ success: true, data: { ...EMPTY_SUMMARY, pendingCommissions: 30, paidCommissions: 70 } }) }));
		const c = f.componentInstance as Commissions;
		expect(c.heldAmount()).toBe(30);
		expect(c.withdrawnAmount()).toBe(70);
	});
});

describe('marketer labels', () => {
	it('maps backend enums to Arabic and passes unknown values through', () => {
		expect(channelLabel('X_TWITTER')).toContain('إكس');
		expect(commissionTypeLabel('STAGE_RELEASE')).toBe('إفراج مرحلة');
		expect(commissionTypeLabel('NEW')).toBe('NEW');
	});
	it('copyText resolves false without a clipboard', async () => {
		Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
		expect(await copyText('a')).toBe(false);
	});
});
