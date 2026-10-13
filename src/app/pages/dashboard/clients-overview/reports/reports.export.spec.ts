import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Reports } from './reports';
import { ClientReportsService } from '../../../../core/services/client-reports.service';
import { ThemeService } from '../../../../core/services/theme.service';

const data = {
	kpis: { totalRequests: 1, requestsDeltaThisMonth: 0, completedProjectsCount: 0, completedDeltaThisMonth: 0, totalSpent: 0, avgRating: 0, ratingDelta: 0 },
	orders: { items: [{ id: 'o1', title: 'طلب "تصميم", شعار', specialty: 'تصميم', budget: 100, proposalsCount: 2, status: 'OPEN', bucket: 'منشور', createdAt: '2026-10-01T10:00:00Z' }], statusDistribution: {}, acceptanceBySpecialty: [], counts: { all: 1, active: 0, completed: 0, published: 1, cancelled: 0 } },
	projects: { activeCount: 0, completedCount: 0, completedOnTime: 0, completedTotal: 0, avgDurationDays: 0, avgRating: 0 },
	finance: { totalSpent: 0, escrowHeld: 0, transactions: [{ id: 't1', type: 'DEPOSIT', amount: 50, currency: 'USD', status: 'COMPLETED', description: 'إيداع', createdAt: '2026-10-02T10:00:00Z' }] },
	disputes: { items: [], counts: { all: 0, open: 0, resolved: 0, rejected: 0 } },
};

function mount() {
	const getReports = vi.fn((_r: string) => of({ success: true, data }));
	const getAiSummary = vi.fn((_r: string) => of({ success: true, data: { status: 'NOT_ENOUGH_DATA' } as any }));
	TestBed.configureTestingModule({ imports: [Reports], providers: [provideRouter([]), { provide: ThemeService, useValue: { isDark: () => true, theme: () => 'dark' } }, { provide: ClientReportsService, useValue: { getReports, getAiSummary } }] });
	const f = TestBed.createComponent(Reports);
	f.detectChanges();
	return { f, c: f.componentInstance, getReports };
}

describe('client reports — export and period', () => {
	afterEach(() => vi.restoreAllMocks());

	it('CSV is the real loaded data (quoted where needed), downloaded from the browser — no alert', async () => {
		const alertSpy = vi.fn(); (globalThis as any).alert = alertSpy;
		let blob: Blob | null = null;
		(URL as any).createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x'; });
		(URL as any).revokeObjectURL = vi.fn();
		const { c } = mount();
		c.exportRpt('csv');
		expect(alertSpy).not.toHaveBeenCalled();
		const body = await new Promise<string>(res => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsText(blob as unknown as Blob); });
		expect(body).toContain('"طلب ""تصميم"", شعار"');
		expect(body).toContain('إيداع');
		expect(body).toContain('2026-10-02');
	});

	it('PDF is the browser print dialog', () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {});
		mount().c.exportRpt('pdf');
		expect(print).toHaveBeenCalledTimes(1);
	});

	it('the "مخصص" placeholder calendar is gone: the fifth period is the real "all periods" range', () => {
		const { f, c, getReports } = mount();
		const el = f.nativeElement as HTMLElement;
		expect(el.textContent).not.toContain('واجهة التقويم هنا');
		expect(el.textContent).not.toContain('مخصص');
		c.setDate('all');
		f.detectChanges();
		expect(getReports).toHaveBeenLastCalledWith('all');
	});
});
