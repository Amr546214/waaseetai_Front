import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectDetails } from './project-details';
import { AMENDMENT_EFFECT_NOTE, AMENDMENT_RECORDED_BADGE } from '../../../../../core/constants/amendment-effect';

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

const stage = (o: Record<string, unknown>) => ({ id: 's1', stageNumber: 1, title: 'التصميم', description: 'd', amount: 8.729999999999999, days: 5, percentage: 50, status: 'in_progress', threads: [], roundsCount: 0, amountHeld: true, ...o });
const data = (stages: any[]) => ({ id: 'p1', title: 'مشروع', progress: 10, durationDays: 20, stages, files: [], messages: [], aiInsights: null, price: 70, escrowTotal: 70, escrowHeld: 70, escrowReleased: 0, escrowFunded: true, contractStatus: 'ACTIVE' });
const AM = (o: Record<string, unknown> = {}) => ({ id: 'a1', projectId: 'proj-1', requestedByRole: 'CLIENT', type: 'BUDGET', title: 'زيادة', description: null, budgetDelta: 200, durationDeltaDays: null, status: 'APPROVED', ...o });

async function setup(ws: any, amendments: any[] = []) {
	const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: amendments }) : of({ success: true, data: ws }));
	await TestBed.configureTestingModule({ imports: [ProjectDetails], providers: [provideRouter([]),
		{ provide: HttpClient, useValue: { get, post: () => of({ success: true, data: {} }) } },
		{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } }] }).compileComponents();
	const f = TestBed.createComponent(ProjectDetails); f.detectChanges(); await f.whenStable(); f.detectChanges();
	return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement };
}

describe('client workspace: real stages only (e2e findings)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('renders every stage it receives with its title, days and rounded amount, and no invented single milestone', async () => {
		const s = await setup(data([stage({}), stage({ id: 's2', stageNumber: 2, title: 'التطوير', days: 9, amount: 61.06999999999999, status: 'pending', amountHeld: false })]));
		s.c.setTab('miles'); s.f.detectChanges();
		const txt = s.el.textContent!.replace(/\s+/g, ' ');
		expect(txt).toContain('التصميم'); expect(txt).toContain('التطوير');
		expect(txt).toContain('5 يوم'); expect(txt).toContain('9 يوم');
		expect(txt).toContain('محتجز 8.73 $'); expect(txt).toContain('قيمة المرحلة 61.07 $');
		expect(txt).not.toContain('8.729999'); expect(txt).not.toContain('تسليم المشروع النهائي');
		expect(s.el.querySelector('[data-testid="pd-no-stages"]')).toBeNull();
	});

	it('shows an honest empty state when the backend has no stages', async () => {
		const s = await setup(data([]));
		expect(s.el.querySelector('[data-testid="pd-no-stages"]')!.textContent).toContain('لم تُسجَّل مراحل');
		s.c.setTab('miles'); s.f.detectChanges();
		expect(s.el.querySelector('[data-testid="pd-no-stages-miles"]')!.textContent).toContain('لا توجد مراحل');
	});
});

describe('client workspace: amendments are record-only (e2e findings)', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('every amendment card carries the effect note, an answered one carries the neutral badge, and deltas are «تغيير مقترح»', async () => {
		const s = await setup(data([stage({})]), [AM(), AM({ id: 'a2', status: 'PENDING_OTHER_PARTY', effectNote: 'ملاحظة من الخادم' })]);
		s.c.openAmendments(); s.f.detectChanges();
		const notes = Array.from(s.el.querySelectorAll('[data-testid="amend-effect-note"]')).map(e => e.textContent!.trim());
		expect(notes).toEqual([AMENDMENT_EFFECT_NOTE, 'ملاحظة من الخادم']);
		const badges = s.el.querySelectorAll('[data-testid="amend-record-badge"]');
		expect(badges).toHaveLength(1); expect(badges[0].textContent).toContain(AMENDMENT_RECORDED_BADGE);
		expect(AMENDMENT_RECORDED_BADGE).toBe('مُسجَّل — لا يغيّر العقد');
		expect(s.el.querySelector('[data-testid="amend-deltas"]')!.textContent).toContain('تغيير مقترح');
		const all = s.el.textContent!;
		expect(all).not.toMatch(/تم التنفيذ|نافذ/);
	});
});
