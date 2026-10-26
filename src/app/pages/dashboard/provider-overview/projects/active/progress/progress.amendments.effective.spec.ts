import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Progress } from './progress';

// Effective amendments (provider side): answering a client request APPLIES it; a client-raised increase waits for the client's payment authorization (visible, disabled, with the reason).
const DATA = { projectId: 'project-9', conversationId: 'conv-9', title: 'مشروع', stages: [], edits: [], messages: [], files: [], deliveries: [] };
const AM = (o: Record<string, unknown> = {}) => ({ id: 'c1', projectId: 'project-9', projectTitle: 'مشروع', type: 'BUDGET', title: 'زيادة', description: 'سبب', budgetDelta: 5, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY', requestedByRole: 'CLIENT', createdAt: '2026-10-01T00:00:00Z', respondedAt: null, conversationId: null, effect: 'PENDING', needsClientPayment: true, fundingAuthorized: false, contractPrice: 20, contractDurationDays: 14, ...o });

// the list is newest-first by createdAt (tie: id desc); the fixtures keep their written order as the display order
const NEWEST_FIRST = (l: any[]) => l.map((a, i) => ({ ...a, createdAt: new Date(Date.UTC(2026, 9, 10) - i * 60000).toISOString() }));
describe('provider progress: effective amendments', () => {
	async function setup(list: any[]) {
		const post = vi.fn(() => of({ success: true, data: {} }));
		const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: NEWEST_FIRST(list) }) : of({ success: true, data: DATA }));
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } },
			{ provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { paramMap: convertToParamMap({ id: 'contract-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const qa = (id: string) => Array.from(el.querySelectorAll(`[data-testid="${id}"]`)) as HTMLElement[];
		return { f, c: f.componentInstance, post, get, qa };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('a client-raised increase WITHOUT the client\'s payment authorization: the approve button is visible but disabled, with the reason; nothing can be posted', async () => {
		const s = await setup([AM()]);
		s.c.openAmendments(); s.f.detectChanges();
		const approve = s.qa('amend-respond-approve')[0] as HTMLButtonElement;
		expect(approve.disabled).toBe(true);
		expect(s.qa('amend-awaiting-payment')[0].textContent).toContain('بانتظار اعتماد العميل لدفع الزيادة');
		s.c.askAmendDecision(s.c.amendments()[0], 'approve'); s.f.detectChanges();
		expect(s.c.pendingAmendDecision()).toBeNull();
		s.c.respondAmendment(s.c.amendments()[0], 'approve');
		expect(s.post).not.toHaveBeenCalled(); // blocked in the component too (the API still answers 409 if it were reached)
	});

	it('once the client authorized, approving shows the effect lines (amount, new price, new stage) and the applying wording, then posts the plain decision', async () => {
		const s = await setup([AM({ fundingAuthorized: true })]);
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.qa('amend-awaiting-payment')).toHaveLength(0);
		(s.qa('amend-respond-approve')[0] as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.qa('amend-confirm-text')[0].textContent).toContain('يُخصم المبلغ من محفظة العميل الذي اعتمد الدفع مسبقًا');
		const lines = s.qa('amend-effect-lines')[0].textContent!.replace(/\s+/g, ' ');
		expect(lines).toContain('20 USD ← 25 USD'); expect(lines).toContain('مرحلة جديدة في آخر العقد');
		expect(s.post).not.toHaveBeenCalled();
		(s.qa('amend-confirm-yes')[0] as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.post.mock.calls[0]).toEqual([expect.stringContaining('/provider/amendments/c1/respond'), { decision: 'approve' }]);
	});

	it('an APPLIED row shows «طُبّق على العقد»; a legacy approved row keeps the record-only badge; a rejected row has no badge', async () => {
		const s = await setup([
			AM({ id: 'a', status: 'APPROVED', effect: 'APPLIED', effectNote: 'طُبّق التعديل على العقد والضمان والمراحل.' }),
			AM({ id: 'b', status: 'APPROVED', effect: 'RECORD_ONLY', effectNote: 'القرار يُسجَّل للمتابعة فقط ولا يغيّر سعر العقد أو مدته أو الضمان حاليًا.', needsClientPayment: false }),
			AM({ id: 'c', status: 'REJECTED', effect: 'NONE', effectNote: 'لم يتغيّر شيء في العقد.' })
		]);
		s.c.openAmendments(); s.f.detectChanges();
		const badges = s.qa('amend-record-badge').map(e => e.textContent!.trim());
		expect(badges).toEqual(['طُبّق على العقد', 'مُسجَّل — لا يغيّر العقد']);
	});

	it('my own pending request can be cancelled (real endpoint) and shows no answer buttons', async () => {
		const s = await setup([AM({ id: 'p1', requestedByRole: 'PROVIDER' })]);
		s.c.openAmendments(); s.f.detectChanges();
		expect(s.qa('amend-respond-approve')).toHaveLength(0);
		(s.qa('amend-cancel-own')[0] as HTMLButtonElement).click(); s.f.detectChanges();
		expect((s.post.mock.calls[0] as unknown as [string])[0]).toContain('/provider/amendments/p1/cancel');
		expect(s.get.mock.calls.filter(x => String(x[0]).includes('/amendments'))).toHaveLength(2); // reloaded from the server
	});

	it('static: the provider screen no longer hardcodes the record-only claims', () => {
		const html = readFileSync(join(__dirname, 'progress.html'), 'utf8');
		const ts = readFileSync(join(__dirname, 'progress.ts'), 'utf8');
		expect(html).not.toContain('رد العميل يُسجَّل فقط');
		expect(html).not.toContain('تأكيد وتسجيل القرار');
		expect(ts).not.toContain('AMENDMENT_CONFIRM_TEXT');
		expect(ts).not.toContain('AMENDMENT_RECORDED_BADGE');
	});
});
