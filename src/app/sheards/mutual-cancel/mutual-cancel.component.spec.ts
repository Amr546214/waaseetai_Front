import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { MutualCancelComponent } from './mutual-cancel.component';

const REQ = (o: Record<string, unknown> = {}) => ({ id: 'r1', contractId: 'c1', contractRef: 'CT-C1', projectId: 'p1', projectTitle: 'مشروع', contractStatus: 'ACTIVE', clientName: 'عميل', providerName: 'مزود', requestedByRole: 'CLIENT', reason: 'تغيّرت احتياجات المشروع', note: null,
	status: 'PENDING_OTHER_PARTY', statusLabel: 'بانتظار موافقة الطرف الآخر', settlementStatus: 'NOT_APPLICABLE', settlementLabel: null, respondedAt: null, responseNote: null, withdrawnAt: null, createdAt: '2026-11-05T10:00:00Z', updatedAt: '2026-11-05T10:00:00Z',
	myRole: 'CLIENT', mine: true, canRespond: false, canWithdraw: true, moneyNote: 'لا يُنقل أو يُردّ أي مبلغ', moneyMoved: false, ...o });
const LIST = (requests: any[], eligibility = { canRequest: true, reason: null as string | null }) => ({ success: true, data: { requests, eligibility, financial: { contractPrice: 20, escrowStatus: 'HELD', escrowAmount: 20, escrowReleased: 0, escrowHeld: 20 }, moneyNote: 'لا يُنقل أو يُردّ أي مبلغ' } });

describe('MutualCancelComponent («الإلغاء بالتراضي»)', () => {
	async function setup(list: any, side: 'client' | 'provider' = 'client', post?: (url: string, body: any) => any, variant: 'tile' | 'card' = 'tile') {
		const http = { get: vi.fn(() => (list instanceof Subject ? list : of(list))), post: vi.fn(post ?? (() => of({ success: true, data: REQ() }))) };
		await TestBed.configureTestingModule({ imports: [MutualCancelComponent], providers: [provideRouter([]), { provide: HttpClient, useValue: http }] }).compileComponents();
		const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const f = TestBed.createComponent(MutualCancelComponent);
		f.componentRef.setInput('side', side); f.componentRef.setInput('projectKey', 'contract-1'); f.componentRef.setInput('variant', variant);
		f.detectChanges(); await f.whenStable(); f.detectChanges();
		const el = f.nativeElement as HTMLElement; const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
		const click = (id: string) => { (q(id) as HTMLButtonElement).click(); f.detectChanges(); };
		const type = (id: string, v: string) => { const i = q(id) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); f.detectChanges(); };
		return { f, c: f.componentInstance, http, nav, q, click, type, el };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('reads the request state from the server on load (client URL) and shows the form only after the tile is clicked', async () => {
		const s = await setup(LIST([]));
		expect(s.http.get).toHaveBeenCalledWith(expect.stringContaining('/client/projects/contract-1/cancellation-requests'));
		expect(s.q('mutual-cancel-modal')).toBeNull();
		s.click('open-mutual-cancel');
		expect(s.q('mutual-cancel-modal')).not.toBeNull();
		expect(s.el.textContent).toContain('إلغاء المشروع بالتراضي');
		expect(s.q('mutual-cancel-money-note')!.textContent).toContain('لا يُنقل أو يُردّ أي مبلغ');
		expect(s.el.textContent).not.toMatch(/يُعاد المبلغ|يُعاد إليك/);
	});

	it('provider side uses the provider URLs (project routes and request-id routes match the backend)', async () => {
		const s = await setup(LIST([REQ({ requestedByRole: 'CLIENT', canRespond: true, canWithdraw: false })]), 'provider');
		s.click('open-mutual-cancel'); s.click('mutual-cancel-reject');
		expect(s.http.post).toHaveBeenCalledWith(expect.stringMatching(/\/provider\/cancellation-requests\/r1\/respond$/), { decision: 'reject' });
		TestBed.resetTestingModule(); const s2 = await setup(LIST([REQ({ canWithdraw: true })]), 'provider'); s2.click('open-mutual-cancel'); s2.click('mutual-cancel-withdraw');
		expect(s2.http.post).toHaveBeenCalledWith(expect.stringMatching(/\/provider\/cancellation-requests\/r1\/withdraw$/), {});
		TestBed.resetTestingModule();
		const s3 = await setup(LIST([]), 'provider');
		expect(s3.http.get).toHaveBeenCalledWith(expect.stringContaining('/provider/projects/contract-1/cancellation-requests'));
		s3.click('open-mutual-cancel'); expect(s3.el.textContent).toContain('ملاحظة للعميل');
	});

	it('the reason is required: nothing is sent and the message sits under the field', async () => {
		const s = await setup(LIST([])); s.click('open-mutual-cancel');
		s.click('mutual-cancel-submit');
		expect(s.http.post).not.toHaveBeenCalled(); expect(s.q('mutual-cancel-reason-error')!.textContent).toContain('اكتب سبب الإلغاء');
	});

	it('submit sends reason + note + ONE request key, then opens the project chat tab; a double click sends once', async () => {
		const reply = new Subject<any>();
		const s = await setup(LIST([]), 'client', () => reply);
		s.click('open-mutual-cancel'); s.type('mutual-cancel-reason-input', 'تغيّرت احتياجات المشروع'); s.type('mutual-cancel-note-input', 'ملاحظة');
		s.click('mutual-cancel-submit'); s.click('mutual-cancel-submit');
		expect(s.http.post).toHaveBeenCalledTimes(1);
		const [url, body] = s.http.post.mock.calls[0] as unknown as [string, any];
		expect(url).toContain('/client/projects/contract-1/cancellation-requests'); expect(body.reason).toBe('تغيّرت احتياجات المشروع'); expect(body.note).toBe('ملاحظة'); expect(String(body.requestKey).length).toBeGreaterThan(8);
		reply.next({ success: true, data: REQ() }); reply.complete(); s.f.detectChanges();
		expect(s.nav).toHaveBeenCalledWith(['/client-overview/projects', 'contract-1'], { queryParams: { tab: 'messages' } });
	});

	it('a server refusal is shown (no fake success) and the form stays open', async () => {
		const s = await setup(LIST([]), 'client', () => throwError(() => ({ status: 409, error: { message: 'يوجد طلب إلغاء بالتراضي معلّق على هذا المشروع' } })));
		s.click('open-mutual-cancel'); s.type('mutual-cancel-reason-input', 'سبب كاف'); s.click('mutual-cancel-submit');
		expect(s.q('mutual-cancel-error')!.textContent).toContain('يوجد طلب إلغاء بالتراضي معلّق'); expect(s.nav).not.toHaveBeenCalled(); expect(s.q('mutual-cancel-modal')).not.toBeNull();
	});

	it('the requester sees the pending state with withdraw (no accept/reject); the other party sees accept/reject', async () => {
		const mine = await setup(LIST([REQ()])); mine.click('open-mutual-cancel');
		expect(mine.q('mutual-cancel-status')!.textContent).toContain('بانتظار موافقة الطرف الآخر'); expect(mine.q('mutual-cancel-withdraw')).not.toBeNull(); expect(mine.q('mutual-cancel-accept')).toBeNull(); expect(mine.q('mutual-cancel-submit')).toBeNull();
		TestBed.resetTestingModule();
		const theirs = await setup(LIST([REQ({ requestedByRole: 'PROVIDER', myRole: 'CLIENT', mine: false, canRespond: true, canWithdraw: false })])); theirs.click('open-mutual-cancel');
		expect(theirs.q('mutual-cancel-accept')).not.toBeNull(); expect(theirs.q('mutual-cancel-reject')).not.toBeNull(); expect(theirs.q('mutual-cancel-withdraw')).toBeNull();
	});

	it('accept posts the decision once and shows the AGREED state with the settlement-pending line (still no money)', async () => {
		const post = vi.fn(() => of({ success: true, data: REQ({ status: 'ACCEPTED', statusLabel: 'وافق الطرفان على الإلغاء', canRespond: false, canWithdraw: false, settlementStatus: 'PENDING_ADMIN_DECISION', settlementLabel: 'التسوية المالية بانتظار قرار الإدارة ولم يُنقل أي مبلغ' }) }));
		const s = await setup(LIST([REQ({ requestedByRole: 'PROVIDER', mine: false, canRespond: true, canWithdraw: false })]), 'client', post);
		s.click('open-mutual-cancel'); s.click('mutual-cancel-accept'); (s.q('mutual-cancel-accept') as HTMLButtonElement | null)?.click();
		expect(post).toHaveBeenCalledTimes(1); expect(post.mock.calls[0]).toEqual([expect.stringContaining('/client/projects/cancellation-requests/r1/respond'), { decision: 'accept' }]);
		expect(s.q('mutual-cancel-status')!.textContent).toContain('وافق الطرفان'); expect(s.q('mutual-cancel-settlement')!.textContent).toContain('لم يُنقل أي مبلغ'); expect(s.q('mutual-cancel-accept')).toBeNull();
	});

	it('a conflict on answer (already answered elsewhere) shows the server message and reloads the real state', async () => {
		const s = await setup(LIST([REQ({ requestedByRole: 'PROVIDER', canRespond: true, canWithdraw: false })]), 'client', () => throwError(() => ({ status: 409, error: { message: 'تم الرد على هذا الطلب أو سحبه مسبقًا' } })));
		s.click('open-mutual-cancel'); const before = s.http.get.mock.calls.length; s.click('mutual-cancel-reject');
		expect(s.q('mutual-cancel-error')!.textContent).toContain('تم الرد على هذا الطلب'); expect(s.http.get.mock.calls.length).toBeGreaterThan(before);
	});

	it('not eligible (e.g. open dispute): the real reason is shown instead of the form', async () => {
		const s = await setup(LIST([], { canRequest: false, reason: 'يوجد نزاع مفتوح على هذا المشروع' })); s.click('open-mutual-cancel');
		expect(s.q('mutual-cancel-ineligible')!.textContent).toContain('نزاع مفتوح'); expect(s.q('mutual-cancel-submit')).toBeNull();
	});

	it('a load error is shown with a retry (never an empty form that pretends all is well)', async () => {
		const s = await setup(new Subject()); (s.http.get as any).mockReturnValue(throwError(() => ({ status: 500, error: { message: 'تعذر' } }))); s.c.reload(); s.f.detectChanges();
		s.click('open-mutual-cancel'); expect(s.q('mutual-cancel-load-error')).not.toBeNull(); expect(s.q('mutual-cancel-submit')).toBeNull();
	});

	it('card variant: only while a request is open; says whose answer is awaited; opens the same modal state', async () => {
		const none = await setup(LIST([]), 'client', undefined, 'card'); expect(none.q('mutual-cancel-card')).toBeNull();
		TestBed.resetTestingModule();
		const pend = await setup(LIST([REQ({ requestedByRole: 'PROVIDER', canRespond: true, canWithdraw: false })]), 'client', undefined, 'card');
		expect(pend.q('mutual-cancel-card')!.textContent).toContain('بانتظار ردك');
		pend.click('mutual-cancel-card-open'); expect(pend.q('mutual-cancel-state')).not.toBeNull(); expect(pend.q('mutual-cancel-accept')).not.toBeNull();
	});

	it('the blocked reason disables the tile and is the title', async () => {
		const http = { get: vi.fn(() => of(LIST([]))), post: vi.fn() };
		await TestBed.configureTestingModule({ imports: [MutualCancelComponent], providers: [provideRouter([]), { provide: HttpClient, useValue: http }] }).compileComponents();
		const f = TestBed.createComponent(MutualCancelComponent); f.componentRef.setInput('side', 'client'); f.componentRef.setInput('projectKey', 'x'); f.componentRef.setInput('blockedReason', 'العقد غير نشط'); f.detectChanges();
		const b = f.nativeElement.querySelector('[data-testid="open-mutual-cancel"]') as HTMLButtonElement; expect(b.disabled).toBe(true); expect(b.title).toBe('العقد غير نشط');
	});
});
