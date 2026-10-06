import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';

import { Reports } from './reports';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProviderApiService } from '../../../../core/services/provider-api.service';

// The reports page has no data source of its own except GET /provider/statistics (monthly earnings + client rating).
// Everything else used to be invented (12 orders, 8 projects, 47.2K, fake order rows, per-specialty rates, team members);
// it now shows real values or an honest "لا توجد بيانات بعد" / "—".
function setup(stats: any = { success: true, data: { summary: { monthlyEarnings: 1200, humanRating: 4.5 } } }, fail = false) {
	TestBed.configureTestingModule({
		imports: [Reports],
		providers: [
			{ provide: AuthStore, useValue: { currentUser: signal(null) } },
			{ provide: ProviderApiService, useValue: { getProviderStatistics: () => (fail ? throwError(() => new Error('x')) : of(stats)) } },
		],
	});
	const fixture: ComponentFixture<Reports> = TestBed.createComponent(Reports);
	return { fixture, component: fixture.componentInstance };
}
const text = (f: ComponentFixture<Reports>) => ((f.nativeElement as HTMLElement).textContent || '').replace(/\s+/g, ' ');

describe('Reports (provider) — real data only', () => {
	it('tab badges carry no invented counts', () => {
		const { component } = setup();
		for (const t of component.tabs()) expect(t.count).toBeNull();
	});

	it('KPI cards use the real statistics; unavailable KPIs show "—"', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const t = text(fixture);
		expect(t).toContain('إيرادات هذا الشهر');
		expect(t).toContain('1,200');
		expect(t).toContain('4.5');
		for (const invented of ['47.2K', '#ORD-2026', '15,000', '▲ 3 هذا الشهر', 'قيد التطوير']) expect(t, invented).not.toContain(invented);
		expect(t).toContain('لا توجد بيانات بعد');
	});

	it('when the statistics call fails the KPIs fall back to "—" (no invented numbers)', () => {
		const { fixture } = setup(undefined, true);
		fixture.detectChanges();
		const t = text(fixture);
		expect(t).not.toContain('47.2K');
		expect(t).toMatch(/إيرادات هذا الشهر\s*—/);
	});

	it('renders no pagination controls over non-existent rows', () => {
		const { fixture } = setup();
		fixture.detectChanges();
		const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).filter((el: any) => ['1', '2', '3'].includes(el.textContent?.trim()));
		expect(buttons.length).toBe(0);
	});
});
