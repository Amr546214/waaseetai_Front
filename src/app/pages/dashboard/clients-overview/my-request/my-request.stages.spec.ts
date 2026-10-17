import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MyRequest } from './my-request';
import { ProjectApiService } from '../../../../core/services/project-api.service';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';

// The requests list shows the server's derived stage: a request waiting for the contract / funding is never "active", tabs are the server's groups,
// and search / sort / filter are real.
const row = (id: string, stage: string, group: string, o: any = {}) => ({ id, title: `طلب ${id}`, specialty: 'تصميم', stage, stageLabel: `label-${stage}`, stageGroup: group, budgetMin: 100, budgetMax: 200, proposalsCount: 0, createdAt: '2026-01-0' + (id.length), ...o });
const rows = [
	row('a', 'OPEN', 'open'), row('bb', 'OFFERS_RECEIVED', 'open', { proposalsCount: 3, budgetMax: 900, specialty: 'برمجة' }),
	row('ccc', 'AWAITING_FUNDING', 'pending'), row('dddd', 'ACTIVE', 'active'), row('eeeee', 'CANCELLED', 'closed')
];
const filters = { allCount: 5, draftCount: 0, openCount: 2, pendingCount: 1, activeCount: 1, closedCount: 1 };

async function setup(res: any) {
	const setCount = vi.fn();
	await TestBed.configureTestingModule({
		imports: [MyRequest],
		providers: [provideRouter([]),
			{ provide: ProjectApiService, useValue: { getMyRequests: () => (res instanceof Error ? throwError(() => res) : of(res)) } },
			{ provide: DashboardStore, useValue: { setTotalActiveRequestsCount: setCount } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL' }) } }]
	}).compileComponents();
	const f = TestBed.createComponent(MyRequest);
	f.detectChanges(); await f.whenStable(); f.detectChanges();
	return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, setCount };
}
afterEach(() => TestBed.resetTestingModule());

describe('MyRequest - server stages', () => {
	it('shows each request with the server stage label; only the running one is in «قيد التنفيذ»', async () => {
		const s = await setup({ success: true, filters, data: rows });
		s.c.sortBy.set('oldest'); s.f.detectChanges();
		const pills = Array.from(s.el.querySelectorAll('.opill')).map(p => p.textContent!.trim());
		expect(pills).toEqual(['label-OPEN', 'label-OFFERS_RECEIVED', 'label-AWAITING_FUNDING', 'label-ACTIVE', 'label-CANCELLED']);
		expect(s.c.tabs().map(t => [t.id, t.count])).toEqual([['all', 5], ['open', 2], ['pending', 1], ['active', 1], ['closed', 1], ['draft', 0]]);
		s.c.setFilter('active');
		expect(s.c.filteredRequests().map((r: any) => r.id)).toEqual(['dddd']);
		s.c.setFilter('pending');
		expect(s.c.filteredRequests().map((r: any) => r.id)).toEqual(['ccc']);
		expect(s.setCount).toHaveBeenCalledWith(1);
	});

	it('the row action opens the request details; offers waiting get «عرض العروض», a waiting contract gets «متابعة»', async () => {
		const s = await setup({ success: true, filters, data: rows });
		s.c.sortBy.set('oldest'); s.f.detectChanges();
		const links = Array.from(s.el.querySelectorAll('a.ord-act')) as HTMLAnchorElement[];
		expect(links.map(a => a.textContent!.trim())).toEqual(['التفاصيل', 'عرض العروض', 'متابعة', 'التفاصيل', 'التفاصيل']);
		expect(links[2].getAttribute('href')).toBe('/client-overview/my-requests/ccc');
	});

	it('search, sort and the specialty filter are real', async () => {
		const s = await setup({ success: true, filters, data: rows });
		s.c.searchText.set('label-ACTIVE');
		expect(s.c.filteredRequests().map((r: any) => r.id)).toEqual(['dddd']);
		s.c.searchText.set('');
		s.c.specialtyFilter.set('برمجة');
		expect(s.c.filteredRequests().map((r: any) => r.id)).toEqual(['bb']);
		s.c.specialtyFilter.set('');
		s.c.sortBy.set('offers');
		expect(s.c.filteredRequests()[0].id).toBe('bb');
		s.c.sortBy.set('budget');
		expect(s.c.filteredRequests()[0].id).toBe('bb');
		s.c.sortBy.set('oldest');
		expect(s.c.filteredRequests()[0].id).toBe('a');
	});

	it('no fake filter badge, no unbacked sort option; the unavailable view toggle is disabled with a reason', async () => {
		const s = await setup({ success: true, filters, data: rows });
		expect(s.el.querySelector('.tb-badge')).toBeNull();
		expect(s.el.querySelector('[data-testid="sort-select"]')!.textContent).not.toContain('قرب التسليم');
		const disabled = Array.from(s.el.querySelectorAll('.ord-toolbar button[disabled]')) as HTMLButtonElement[];
		expect(disabled).toHaveLength(1);
		expect(disabled[0].getAttribute('title')).toBeTruthy();
	});

	it('empty list and a load failure are both stated, not an empty table', async () => {
		const e = await setup({ success: true, filters: {}, data: [] });
		expect(e.el.querySelector('[data-testid="empty-state"]')!.textContent).toContain('لا توجد طلبات');
		TestBed.resetTestingModule();
		const f = await setup(Object.assign(new Error('x'), { error: { message: 'تعذر الاتصال' } }));
		expect(f.el.querySelector('[data-testid="load-error"]')!.textContent).toContain('تعذر الاتصال');
	});
});
