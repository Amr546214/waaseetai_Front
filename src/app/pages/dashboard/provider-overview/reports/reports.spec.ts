import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { Reports } from './reports';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProviderApiService } from '../../../../core/services/provider-api.service';

// The reports page reads GET /provider/reports (range) for offers / projects / payments / disputes and GET /provider/statistics for the
// client rating. Nothing is invented: a figure without a source shows "—" and an empty list shows "لا توجد بيانات بعد".
const REPORTS = {
	range: 'month',
	requests: {
		total: 3,
		byStatus: { pending: 1, accepted: 1, rejected: 1, cancelled: 0 },
		items: [
			{ id: 'p1', title: 'موقع تعريفي', specialty: 'برمجة', price: 500, status: 'ACCEPTED', bucket: 'accepted', createdAt: '2026-10-01T00:00:00Z' },
		],
	},
	offersBySpecialty: [{ specialty: 'برمجة', total: 2, accepted: 1, rate: 50 }],
	projects: { totalCount: 2, activeCount: 1, completedCount: 1, avgDurationDays: null, completedOnTime: 0, completedWithAgreedDuration: 0 },
	payments: { releasedTotal: 1200, heldInEscrow: null, transactions: [] },
	disputes: { items: [], counts: { all: 0, open: 0, resolved: 0, rejected: 0 }, ratioPercent: null },
};

function setup(reports: any = { success: true, data: REPORTS }, fail = false) {
	const getProviderReports = vi.fn((_range: string) => (fail ? throwError(() => ({ error: { message: 'x' } })) : of(reports)));
	TestBed.configureTestingModule({
		imports: [Reports],
		providers: [
			{ provide: AuthStore, useValue: { currentUser: signal(null) } },
			{
				provide: ProviderApiService,
				useValue: { getProviderStatistics: () => of({ success: true, data: { summary: { humanRating: 4.5 } } }), getProviderReports },
			},
		],
	});
	const fixture: ComponentFixture<Reports> = TestBed.createComponent(Reports);
	return { fixture, component: fixture.componentInstance, getProviderReports };
}
const text = (f: ComponentFixture<Reports>) => ((f.nativeElement as HTMLElement).textContent || '').replace(/\s+/g, ' ');

describe('Reports (provider) — real data only', () => {
	it('loads GET /provider/reports for the selected range and reloads on period change', () => {
		const { fixture, component, getProviderReports } = setup();
		fixture.detectChanges();
		expect(getProviderReports).toHaveBeenCalledWith('month');
		component.setPeriod('3m');
		expect(getProviderReports).toHaveBeenLastCalledWith('3m');
	});

	it('KPI cards and tab badges come from the reports; unsourced figures show "—"', () => {
		const { fixture, component } = setup();
		fixture.detectChanges();
		const t = text(fixture);
		expect(t).toContain('1,200');
		expect(t).toContain('4.5');
		expect(component.tabs().find(x => x.id === 'orders')?.count).toBe(3);
		for (const invented of ['47.2K', '#ORD-2026', '15,000', '▲ 3 هذا الشهر', 'قيد التطوير', '﷼']) expect(t, invented).not.toContain(invented);
	});

	it('when the reports call fails there are no invented numbers and the badges show "—"', () => {
		const { fixture, component } = setup(undefined, true);
		fixture.detectChanges();
		const t = text(fixture);
		expect(t).not.toContain('47.2K');
		expect(t).toMatch(/إيرادات الفترة \(مُفرَج عنها\)\s*—/);
		for (const tab of component.tabs()) expect(tab.count).toBeNull();
	});

	it('renders no pagination controls', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).filter((el: any) => ['1', '2', '3'].includes(el.textContent?.trim()));
		expect(buttons.length).toBe(0);
	});
});
