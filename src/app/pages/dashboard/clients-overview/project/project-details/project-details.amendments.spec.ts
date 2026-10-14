import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectDetails, CLIENT_AMENDMENT_SUCCESS_TEXT } from './project-details';

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

// «طلب تعديل» is a REAL request (POST /client/projects/:projectId/amendments) that waits for the provider; it never opens the chat instead.
// «إلغاء بالتراضي» is gone (no backend): the real channel is «فتح نزاع».
const AM = (o: Record<string, unknown> = {}) => ({ id: 'a1', projectId: 'proj-1', requestedByRole: 'CLIENT', type: 'BUDGET', title: 'زيادة', description: null, budgetDelta: 200, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY', ...o });

describe('client project details: change request', () => {
	async function setup(opts: { list?: any[]; postError?: any } = {}) {
		const post = vi.fn((_u: string, body: any) => (opts.postError ? throwError(() => opts.postError) : of({ success: true, data: AM(body) })));
		const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: opts.list ?? [] }) : of({ success: true, data: null }));
		await TestBed.configureTestingModule({ imports: [ProjectDetails], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get, post } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } }] }).compileComponents();
		const f = TestBed.createComponent(ProjectDetails); f.detectChanges(); await f.whenStable();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, get, post, nav, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null, posts: () => post.mock.calls.filter(x => String(x[0]).includes('/amendments')) };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('«إلغاء بالتراضي» and the support/cancel modal are gone from the source', () => {
		const html = readFileSync(join(__dirname, 'project-details.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'project-details.ts'), 'utf8');
		for (const gone of ['بالتراضي', 'lc-qa-canc', "openSupport(", 'supportAction', 'supportNote', 'continueInConversation', 'إرسال الطلب وفتح الشات', 'ملاحظة لمقدم الخدمة']) { expect(html).not.toContain(gone); expect(ts).not.toContain(gone); }
		expect(html).toContain('openDisputeModal()'); // the real channel stays
	});

	it('opening the form loads MY previous requests for this project only (not the provider\'s, not other projects\')', async () => {
		const s = await setup({ list: [AM(), AM({ id: 'a2', status: 'APPROVED', projectId: 'proj-1' }), AM({ id: 'a3', projectId: 'other' }), AM({ id: 'a4', requestedByRole: 'PROVIDER' })] });
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.q('amend-modal')).not.toBeNull();
		expect(s.q('amend-note')!.textContent).toContain(CLIENT_AMENDMENT_SUCCESS_TEXT);
		const items = Array.from(s.el.querySelectorAll('[data-testid="amend-item"]')).map(e => e.textContent!.replace(/\s+/g, ' '));
		expect(items).toHaveLength(2);
		expect(items[0]).toContain('بانتظار رد مقدم الخدمة'); expect(items[1]).toContain('وافق مقدم الخدمة');
		expect(CLIENT_AMENDMENT_SUCCESS_TEXT).toBe('يصل الطلب إلى مقدم الخدمة، ولا يتغير السعر أو المدة أو الضمان أو محفظتك قبل موافقته؛ وعند موافقته يُطبَّق التعديل فورًا.');
	});

	it('empty state is clear', async () => {
		const s = await setup();
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.q('amend-list-empty')!.textContent).toContain('لا توجد طلبات تعديل سابقة');
	});

	it('submitting calls the real endpoint with exactly the typed fields and NEVER opens the chat', async () => {
		const s = await setup();
		s.c.openAmendments(); s.c.amendKind = 'BUDGET'; s.c.amendTitle = '  زيادة الميزانية '; s.c.amendBudget = 200; s.c.amendDescription = 'توسيع النطاق';
		s.c.submitAmendment(); s.f.detectChanges();
		expect(s.posts()).toHaveLength(1);
		const [url, body] = s.posts()[0] as [string, any];
		expect(url).toContain('/client/projects/proj-1/amendments');
		expect(body).toEqual({ type: 'BUDGET', title: 'زيادة الميزانية', description: 'توسيع النطاق', budgetDelta: 200 });
		expect(s.nav).not.toHaveBeenCalled();
		expect(s.q('amend-success')!.textContent).toContain('بانتظار رد مقدم الخدمة');
		expect(s.q('amend-success')!.textContent).toContain('لا يتغير السعر أو المدة أو الضمان أو محفظتك قبل موافقته');
	});

	it('payload per type: DURATION, SCOPE, MIXED; nothing extra', async () => {
		let s = await setup();
		s.c.openAmendments(); s.c.amendKind = 'DURATION'; s.c.amendTitle = 'تمديد'; s.c.amendDays = 5; s.c.submitAmendment();
		expect(s.posts()[0][1]).toEqual({ type: 'DURATION', title: 'تمديد', durationDeltaDays: 5 });
		TestBed.resetTestingModule();
		s = await setup();
		s.c.openAmendments(); s.c.amendKind = 'MIXED'; s.c.amendTitle = 'مزيج'; s.c.amendBudget = -100; s.c.amendDays = 2; s.c.amendDescription = 'x'; s.c.submitAmendment();
		expect(s.posts()[0][1]).toEqual({ type: 'MIXED', title: 'مزيج', description: 'x', budgetDelta: -100, durationDeltaDays: 2 });
	});

	it('invalid input is blocked before any request (title, per-type fields, whole days, a second dimension for MIXED)', async () => {
		const s = await setup();
		s.c.openAmendments();
		s.c.amendKind = 'SCOPE'; s.c.amendTitle = ''; s.c.submitAmendment();
		s.c.amendTitle = 't'; s.c.submitAmendment();
		s.c.amendKind = 'BUDGET'; s.c.amendBudget = 0; s.c.submitAmendment();
		s.c.amendKind = 'DURATION'; s.c.amendDays = 2.5; s.c.submitAmendment();
		s.c.amendKind = 'MIXED'; s.c.amendBudget = 10; s.c.amendDays = null; s.c.amendDescription = ''; s.c.submitAmendment();
		expect(s.posts()).toHaveLength(0);
		expect(s.c.amendReady()).toBe(false);
	});

	it('a pending request of mine disables sending with a clear message', async () => {
		const s = await setup({ list: [AM()] });
		s.c.openAmendments(); s.c.amendTitle = 't'; s.c.amendDescription = 'x'; s.f.detectChanges();
		expect(s.q('amend-pending-note')!.textContent).toContain('لا يمكن إرسال طلب آخر');
		expect((s.q('amend-submit') as HTMLButtonElement).disabled).toBe(true);
		s.c.submitAmendment();
		expect(s.posts()).toHaveLength(0);
	});

	it('a server refusal shows its message and never a success', async () => {
		const s = await setup({ postError: { error: { message: 'لديك طلب تعديل معلّق لهذا المشروع بانتظار رد مقدم الخدمة' } } });
		s.c.openAmendments(); s.c.amendTitle = 't'; s.c.amendDescription = 'x'; s.c.submitAmendment(); s.f.detectChanges();
		expect(s.q('amend-error')!.textContent).toContain('لديك طلب تعديل معلّق');
		expect(s.q('amend-success')).toBeNull();
	});
});
