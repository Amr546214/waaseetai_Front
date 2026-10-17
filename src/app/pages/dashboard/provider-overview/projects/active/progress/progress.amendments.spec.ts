import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Progress, AMENDMENT_SUCCESS_TEXT } from './progress';

// "طلب تعديل" is a REAL request (POST /provider/projects/:projectId/amendments) that waits for the client; it never opens the chat instead and
// never claims the contract changes by itself. "إلغاء بالتراضي" is gone (no backend).
const DATA = { projectId: 'project-9', conversationId: 'conv-9', title: 'مشروع', stages: [], edits: [], messages: [], files: [], deliveries: [] };
const AM = (o: Record<string, unknown> = {}) => ({ id: 'a1', projectId: 'project-9', projectTitle: 'مشروع', type: 'BUDGET', title: 'زيادة الميزانية', description: null, budgetDelta: 200, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY', requestedByRole: 'PROVIDER', createdAt: '2026-10-01T00:00:00Z', respondedAt: null, conversationId: null, ...o });

// the list is newest-first by createdAt (tie: id desc); the fixtures keep their written order as the display order
const NEWEST_FIRST = (l: any[]) => l.map((a, i) => ({ ...a, createdAt: new Date(Date.UTC(2026, 9, 10) - i * 60000).toISOString() }));
describe('provider project progress: change request', () => {
	async function setup(opts: { list?: any[]; listError?: boolean; postError?: any } = {}) {
		const post = vi.fn((url: string, body: any) => (opts.postError ? throwError(() => opts.postError) : of({ success: true, data: AM({ ...body, id: 'a-new' }) })));
		const get = vi.fn((url: string) => String(url).includes('/amendments') ? (opts.listError ? throwError(() => ({ status: 500 })) : of({ success: true, data: NEWEST_FIRST(opts.list ?? []) })) : of({ success: true, data: DATA }));
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get, post } },
			{ provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { paramMap: convertToParamMap({ id: 'contract-id-from-the-route' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, nav, get, post, q: (id: string) => el.querySelector(`[data-testid="${id}"]`), amendGets: () => get.mock.calls.filter(x => String(x[0]).includes('/amendments')), amendPosts: () => post.mock.calls.filter(x => String(x[0]).includes('/amendments')) };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('"إلغاء بالتراضي" is gone from the quick actions, the modal and the whole page', async () => {
		const s = await setup();
		expect(s.el.querySelector('.lc-qa-canc')).toBeNull();
		expect(s.el.textContent).not.toContain('بالتراضي');
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.el.textContent).not.toContain('بالتراضي');
		const html = readFileSync(join(__dirname, 'progress.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'progress.ts'), 'utf8');
		for (const gone of ['بالتراضي', 'lc-qa-canc', "openSupport('cancel')", 'continueInConversation']) { expect(html).not.toContain(gone); expect(ts).not.toContain(gone); }
	});

	it('"طلب تعديل" opens the request form (with the note that nothing changes by itself) and loads the provider\'s previous requests for the REAL project', async () => {
		const s = await setup({ list: [AM(), AM({ id: 'a2', status: 'APPROVED', title: 'تمديد', type: 'DURATION', budgetDelta: null, durationDeltaDays: 5 }), AM({ id: 'a3', status: 'REJECTED', title: 'نطاق', type: 'SCOPE', budgetDelta: null })] });
		expect(s.q('open-amendments')).not.toBeNull();
		(s.q('open-amendments') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('amend-modal')).not.toBeNull();
		expect(String(s.amendGets()[0][0])).toContain('/provider/projects/project-9/amendments'); // data.projectId, not the route param
		expect(s.q('amend-note')!.textContent).toContain('لا يتغير السعر أو المدة أو الضمان أو المراحل بمجرد إرسال الطلب');
		const items = Array.from(s.el.querySelectorAll('[data-testid="amend-item"]')).map(e => e.textContent!.replace(/\s+/g, ' '));
		expect(items).toHaveLength(3);
		expect(items[0]).toContain('زيادة الميزانية'); expect(items[0]).toContain('+200 $'); expect(items[0]).toContain('بانتظار رد العميل');
		expect(items[1]).toContain('+5 يوم'); expect(items[1]).toContain('وافق العميل');
		expect(items[2]).toContain('رفضه العميل');
	});

	it('submitting sends the new endpoint, shows the clear "waiting for the client / nothing changes" result, and NEVER opens the chat', async () => {
		const s = await setup();
		s.c.openAmendments(); s.c.amendKind = 'BUDGET'; s.c.amendTitle = '  زيادة الميزانية  '; s.c.amendBudget = 200; s.c.amendDescription = 'توسيع النطاق';
		s.c.submitAmendment(); s.f.detectChanges();
		expect(s.amendPosts()).toHaveLength(1);
		const [url, body] = s.amendPosts()[0] as [string, any];
		expect(url).toContain('/provider/projects/project-9/amendments');
		expect(body).toEqual({ type: 'BUDGET', title: 'زيادة الميزانية', description: 'توسيع النطاق', budgetDelta: 200 });
		expect(s.nav).not.toHaveBeenCalled(); // no chat, no navigation
		expect(s.q('amend-success')!.textContent).toContain('تم إرسال طلب التعديل وهو بانتظار رد العميل');
		expect(s.q('amend-success')!.textContent).toContain('لا يتغير السعر أو المدة أو الضمان قبل موافقته');
		expect(AMENDMENT_SUCCESS_TEXT).toBe('تم إرسال طلب التعديل وهو بانتظار رد العميل. لا يتغير السعر أو المدة أو الضمان قبل موافقته، وعند موافقته يُطبَّق التعديل فورًا.');
		expect(s.amendGets()).toHaveLength(2); // the list is reloaded to show the new request
	});

	it('payload per type: DURATION (signed integer days), SCOPE (description), no extra fields', async () => {
		const d = await setup();
		d.c.openAmendments(); d.c.amendKind = 'DURATION'; d.c.amendTitle = 'تمديد'; d.c.amendDays = -3; d.c.submitAmendment();
		expect((d.amendPosts()[0] as any)[1]).toEqual({ type: 'DURATION', title: 'تمديد', durationDeltaDays: -3 });
		TestBed.resetTestingModule();
		const sc = await setup();
		sc.c.openAmendments(); sc.c.amendKind = 'SCOPE'; sc.c.amendTitle = 'صفحة جديدة'; sc.c.amendDescription = 'إضافة صفحة الدعم'; sc.c.amendBudget = 999; sc.c.amendDays = 9; sc.c.submitAmendment();
		expect((sc.amendPosts()[0] as any)[1]).toEqual({ type: 'SCOPE', title: 'صفحة جديدة', description: 'إضافة صفحة الدعم' }); // stale budget/days of other kinds are not sent
	});

	it('client-side rules mirror the server: title required; SCOPE needs details; BUDGET a non-zero amount; DURATION a non-zero whole number of days — nothing is sent otherwise', async () => {
		const s = await setup();
		s.c.openAmendments();
		expect(s.c.amendBlocker()).toMatch(/عنوان/);
		s.c.amendTitle = 'ت'; expect(s.c.amendBlocker()).toMatch(/النطاق/);
		s.c.amendDescription = 'شرح'; expect(s.c.amendBlocker()).toBeNull();
		s.c.amendKind = 'BUDGET'; expect(s.c.amendBlocker()).toMatch(/الميزانية/);
		s.c.amendBudget = 0; expect(s.c.amendBlocker()).toMatch(/الميزانية/);
		s.c.amendBudget = -50; expect(s.c.amendBlocker()).toBeNull();
		s.c.amendKind = 'DURATION'; expect(s.c.amendBlocker()).toMatch(/الأيام/);
		s.c.amendDays = 2.5; expect(s.c.amendBlocker()).toMatch(/الأيام/);
		s.c.amendDays = 0; expect(s.c.amendBlocker()).toMatch(/الأيام/);
		s.c.amendDays = 4; expect(s.c.amendBlocker()).toBeNull();
		s.c.amendKind = 'BUDGET'; s.c.amendBudget = null; s.c.submitAmendment();
		expect(s.amendPosts()).toHaveLength(0);
		expect(s.c.amendError()).toMatch(/الميزانية/);
	});

	it('a pending request of the provider blocks another one (note shown, button disabled, nothing sent)', async () => {
		const s = await setup({ list: [AM()] });
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.q('amend-pending-note')!.textContent).toContain('بانتظار رد العميل');
		expect((s.q('amend-submit') as HTMLButtonElement).disabled).toBe(true);
		s.c.amendTitle = 'ت'; s.c.amendDescription = 'ش'; s.c.submitAmendment();
		expect(s.amendPosts()).toHaveLength(0);
	});

	it('a server refusal (e.g. 409 pending / 403 contract) is shown as is and is never shown as success', async () => {
		const s = await setup({ postError: { status: 409, error: { message: 'لديك طلب تعديل معلّق لهذا المشروع بانتظار رد العميل' } } });
		s.c.openAmendments(); s.c.amendKind = 'DURATION'; s.c.amendTitle = 'ت'; s.c.amendDays = 3; s.c.submitAmendment(); s.f.detectChanges();
		expect(s.c.amendSuccess()).toBe(false);
		expect(s.q('amend-error')!.textContent).toContain('لديك طلب تعديل معلّق');
		expect(s.q('amend-success')).toBeNull();
		expect(s.nav).not.toHaveBeenCalled();
	});

	it('the previous-requests list shows an honest error with retry when it cannot load, and an empty state when there are none', async () => {
		const bad = await setup({ listError: true });
		bad.c.openAmendments(); bad.f.detectChanges();
		expect(bad.q('amend-list-error')!.textContent).toContain('تعذر تحميل');
		TestBed.resetTestingModule();
		const empty = await setup({ list: [] });
		empty.c.openAmendments(); empty.f.detectChanges();
		expect(empty.q('amend-list-empty')!.textContent).toContain('لا توجد طلبات تعديل سابقة');
	});
});
