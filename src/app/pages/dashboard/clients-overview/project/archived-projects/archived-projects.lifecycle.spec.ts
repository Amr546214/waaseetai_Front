import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ArchivedProjects } from './archived-projects';
import { AuthStore } from '../../../../../core/store/auth.store';

// Client archive counters / filters on the server lifecycle: completed-by-delivery, cancelled, archived and CLOSED BY SETTLEMENT are separate counters;
// the total comes from the server's pagination (never under-reported); a settled row shows its value as the contractual value before the settlement.
const ITEM = (o: Record<string, unknown>) => ({ id: 'p', projectId: 'p', title: 'مشروع', status: 'COMPLETED', provider: { name: 'نورة' }, totalPrice: 25, completedAt: '2026-10-01T00:00:00Z', canRate: true, hasRated: false, adminSettled: null, closedBySettlement: false, completedByDelivery: true, ...o });

describe('client archive: lifecycle counters', () => {
	async function setup(items: any[], pagination?: any) {
		const get = vi.fn(() => of({ success: true, data: { items, pagination } }));
		await TestBed.configureTestingModule({ imports: [ArchivedProjects], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post: vi.fn() } }, { provide: AuthStore, useValue: { currentUser: () => null } }] }).compileComponents();
		const f = TestBed.createComponent(ArchivedProjects); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, get };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('keeps four separate counters and its own «أُغلقت بتسوية نزاع» KPI; the flag from the lifecycle is enough', async () => {
		const s = await setup([ITEM({ id: 'a' }), ITEM({ id: 'b', closedBySettlement: true, completedByDelivery: false, statusLabel: 'أُغلق بتسوية نزاع' }), ITEM({ id: 'c', status: 'CANCELLED' })]);
		const kpi = (label: string) => s.c.kpis().find(k => k.label === label)?.value;
		expect(kpi('مكتملة')).toBe(1);
		expect(kpi('ملغاة')).toBe(1);
		expect(kpi('أُغلقت بتسوية نزاع')).toBe(1);
		expect(kpi('إجمالي المنتهية')).toBe(3);
		expect(s.c.projects().find(p => p.id === 'b')!.canRate).toBe(false);
	});

	it('asks for up to 100 rows and shows the server total when there are more', async () => {
		const s = await setup([ITEM({ id: 'a' })], { page: 1, limit: 100, total: 130, totalPages: 2 });
		expect(String((s.get.mock.calls[0] as any[])[0])).toContain('limit=100');
		expect(s.c.kpis().find(k => k.label === 'إجمالي المنتهية')!.value).toBe(130);
	});

	it('a settled row says its value is the contractual value before the settlement', async () => {
		const s = await setup([ITEM({ id: 'b', closedBySettlement: true })]);
		expect(s.c.projects()[0].amount).toContain('قيمة العقد قبل التسوية');
	});
});
