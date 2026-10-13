import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Disputes } from './disputes';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';

// The client's dispute list is a read-only mirror of what the server says (open / under review / resolved / rejected). The only decisions
// (resolve / reject) belong to the admin, so the page offers no action that decides or fakes one.
const D = (o: Record<string, unknown> = {}) => ({ id: 'd1', status: 'OPEN', reason: 'تأخر التسليم', description: 'لم يسلّم المرحلة الثانية في الموعد', createdAt: new Date('2026-10-01').toISOString(), openedById: 'me', projectId: 'proj-1', request: { id: 'proj-1', title: 'مشروع الهوية' }, ...o });

describe('client disputes page', () => {
	async function setup(list: any[] | 'error', detail: any = null) {
		const getClientDisputes = vi.fn(() => list === 'error' ? throwError(() => ({ status: 500 })) : of({ success: true, data: { items: list, pagination: {} } }));
		const getClientDispute = vi.fn(() => detail instanceof Error ? throwError(() => ({ error: { message: 'لا تملك صلاحية الوصول لهذا النزاع' } })) : of({ success: true, data: detail }));
		await TestBed.configureTestingModule({ imports: [Disputes], providers: [provideRouter([]),
			{ provide: DisputeApiService, useValue: { getClientDisputes, getClientDispute } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ id: 'me', accountType: AccountType.CLIENT_INDIVIDUAL }) } }] }).compileComponents();
		const f = TestBed.createComponent(Disputes); f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, getClientDispute, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('shows each dispute with its honest state (open / under review / resolved / rejected) and the KPIs count those states', async () => {
		const s = await setup([D(), D({ id: 'd2', status: 'UNDER_REVIEW' }), D({ id: 'd3', status: 'RESOLVED', resolutionNote: 'تم رد جزء من المبلغ' }), D({ id: 'd4', status: 'REJECTED' })]);
		expect(s.text()).toContain('مفتوح'); expect(s.text()).toContain('قيد مراجعة الإدارة'); expect(s.text()).toContain('تم حل النزاع'); expect(s.text()).toContain('تم رفض النزاع');
		expect(s.c.kpis()).toEqual({ activeDisputes: 2, underReview: 1, resolved: 1, rejected: 1 });
		expect(s.text()).toContain('تم رد جزء من المبلغ');
	});

	it('no fake workflow: no mutual cancellation, no 48-hour promise, no chat/discussion button, no "awaiting my reply" tab, no admin-only action', async () => {
		const s = await setup([D()]);
		for (const gone of ['بالتراضي', 'إلغاء بالتراضي', '48 ساعة', 'متابعة النقاش', 'عرض النقاش', 'بانتظار ردي', 'تصعيد للإدارة', 'اعتماد الطرفين']) expect(s.text(), gone).not.toContain(gone);
		expect(s.el.querySelectorAll('button').length).toBeGreaterThan(0);
		const labels = Array.from(s.el.querySelectorAll('button')).map(b => b.textContent!.trim());
		expect(labels.some(l => /حل|رفض النزاع|قرار/.test(l) && !/تفاصيل/.test(l))).toBe(false);
	});

	it('the "raise a dispute" button is a real link to the projects (where the dialog lives), not a toast', async () => {
		const s = await setup([]);
		const a = s.q('raise-dispute') as HTMLAnchorElement;
		expect(a.tagName).toBe('A');
		expect(a.getAttribute('href')).toBe('/client-overview/projects/active');
	});

	it('details are loaded from the server on demand: reason, description, the held escrow and the project link; read-only', async () => {
		const s = await setup([D()], D({ heldEscrowAmount: 400, evidence: ['https://cdn.example.com/a.png'] }));
		s.q('dispute-details-btn')!.click(); await s.f.whenStable(); s.f.detectChanges();
		expect(s.getClientDispute).toHaveBeenCalledWith('d1');
		expect(s.q('dispute-details')!.textContent).toContain('لم يسلّم المرحلة الثانية');
		expect(s.q('dispute-held')!.textContent).toContain('400');
		expect(s.q('dispute-details')!.textContent).toContain('القرار للإدارة وحدها');
		expect(s.q('dispute-details')!.querySelector('a[href="/client-overview/projects/proj-1"]')).not.toBeNull();
		s.q('dispute-details-btn')!.click(); s.f.detectChanges();
		expect(s.q('dispute-details')).toBeNull();
	});

	it('a details failure is shown inside the card with the server message', async () => {
		const s = await setup([D()], new Error('x'));
		s.q('dispute-details-btn')!.click(); await s.f.whenStable(); s.f.detectChanges();
		expect(s.q('dispute-details-error')!.textContent).toContain('لا تملك صلاحية');
	});

	it('empty list and a failed list are told apart', async () => {
		const empty = await setup([]);
		expect(empty.text()).toContain('لا توجد نزاعات');
		TestBed.resetTestingModule();
		const failed = await setup('error');
		expect(failed.text()).toContain('تعذر تحميل سجلّ النزاعات');
	});

	it('the source carries none of the removed claims', () => {
		const html = readFileSync(join(__dirname, 'disputes.html'), 'utf8');
		for (const gone of ['48 ساعة', 'مُغلقة بالتراضي', 'إلغاء بالتراضي', 'سيُتاح رفع النزاع']) expect(html).not.toContain(gone);
	});
});
