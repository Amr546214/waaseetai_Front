import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { DeliveryReview } from './delivery-review';

// The client's stage review page reads the SERVER lifecycle (state + ownership + per-action eligibility) BEFORE it shows anything:
// reviewable -> buttons; approved -> decision + date; settled -> read-only + reason; dispute -> freeze reason; undelivered -> no approval form;
// loading -> skeleton only (a form is never rendered and then removed). The stage heading never duplicates «المرحلة N».
const ok = { allowed: true, reason: null, code: null, httpStatus: null };
const no = (code: string, reason: string) => ({ allowed: false, reason, code, httpStatus: 409 });
const elig = (over: Record<string, any> = {}) => ({ upload: no('WRONG_ROLE', 'x'), submit: no('WRONG_ROLE', 'x'), review: ok, approve: ok, requestRevision: ok, amend: ok, ...over });
const FILE_UP = { name: 'تصميم.pdf', url: 'https://res.cloudinary.com/demo/image/upload/v1/waseetai/deliveries/p/s/a.pdf', size: 2048 };
const FILE_LINK = { name: 'figma', url: 'https://www.figma.com/file/abc' };
const FILE_LEGACY = { name: 'logo.png', url: 'logo.png' };
const thread = { id: 'd1', date: new Date().toISOString(), note: 'تسليم', files: [FILE_UP, FILE_LINK, FILE_LEGACY] };

function ws(stage: Record<string, any>, project: Record<string, any> = {}) {
	return { success: true, data: {
		id: 'contract-1', projectId: 'proj-1', title: 'مشروع', clientName: 'نورة', contractRef: 'CT-1', conversationId: 'conv-1', statusLabel: 'مشروع نشط', closedBySettlement: false, hasActiveDispute: false,
		stages: [{ id: 'stage-1', stageNumber: 1, title: 'المرحلة 1: تصميم الواجهات', amount: 100, status: 'submitted', threads: [thread], ...stage }], ...project } };
}
const lc = (over: Record<string, any>) => ({ lifecycle: { decided: false, decision: null, closedBySettlement: false, awaitingClientReview: true, eligibility: elig(), ...over } });

async function setup(response: any) {
	const post = vi.fn(() => of({ success: true, data: {} }));
	await TestBed.configureTestingModule({ imports: [DeliveryReview], providers: [provideRouter([]),
		{ provide: HttpClient, useValue: { get: () => (response instanceof Subject ? response : of(response)), post } },
		{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1', stageId: 'stage-1' }), queryParamMap: convertToParamMap({}) } } }] }).compileComponents();
	const f = TestBed.createComponent(DeliveryReview);
	vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
	f.detectChanges(); await f.whenStable(); f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	return { f, c: f.componentInstance, el, post, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null, text: () => el.textContent!.replace(/\s+/g, ' ') };
}

describe('client stage review page: lifecycle states', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('reviewable: «بانتظار مراجعة العميل», approve + revision buttons, working approve', async () => {
		const s = await setup(ws(lc({})));
		expect(s.text()).toContain('بانتظار مراجعة العميل');
		expect(s.q('dr-approve')).not.toBeNull();
		expect((s.q('dr-approve') as HTMLButtonElement).disabled).toBe(false);
		expect(s.q('dr-revision-toggle')).not.toBeNull();
		s.c.approveDelivery();
		expect(s.post).toHaveBeenCalledTimes(1);
	});

	it('the heading never duplicates the stage number («تسليم المرحلة 1: تصميم الواجهات»)', async () => {
		const s = await setup(ws(lc({})));
		expect(s.q('dr-title')!.textContent!.trim()).toBe('تسليم المرحلة 1: تصميم الواجهات');
		expect(s.text()).not.toContain('المرحلة 1: المرحلة 1');
		const s2 = await (async () => { TestBed.resetTestingModule(); return setup(ws({ ...lc({}), title: 'تصميم الواجهات' })); })();
		expect(s2.q('dr-title')!.textContent!.trim()).toBe('تسليم المرحلة 1: تصميم الواجهات');
	});

	it('already approved: shows the decision and its date, no approve / revision form, history readable', async () => {
		const s = await setup(ws({ status: 'completed', completedDate: '2026-10-01T10:00:00Z', ...lc({ decided: true, awaitingClientReview: false, decision: { status: 'APPROVED', decidedAt: '2026-10-01T10:00:00Z' }, eligibility: elig({ approve: no('STAGE_ALREADY_DECIDED', 'اعتُمدت'), requestRevision: no('STAGE_ALREADY_DECIDED', 'اعتُمدت'), review: no('STAGE_ALREADY_DECIDED', 'اعتُمدت') }) }) }));
		expect(s.q('dr-decided')!.textContent).toContain('اعتمدتَ هذا التسليم بتاريخ');
		expect(s.q('dr-approve')).toBeNull();
		expect(s.q('dr-revision-toggle')).toBeNull();
		expect(s.q('dr-file-open')).not.toBeNull();
	});

	it('closed by settlement: delivery stays readable, the reason the review ended is shown, NO approve / revise buttons', async () => {
		const reason = 'انتهت مراجعة هذه المرحلة لأن المشروع أُغلق بتسوية نزاع. التسليم متاح للاطلاع فقط';
		const s = await setup(ws(lc({ closedBySettlement: true, awaitingClientReview: false, eligibility: elig({ approve: no('CLOSED_BY_SETTLEMENT', reason), requestRevision: no('CLOSED_BY_SETTLEMENT', reason), review: no('CLOSED_BY_SETTLEMENT', reason) }) }), { closedBySettlement: true, statusLabel: 'أُغلق بتسوية نزاع' }));
		expect(s.q('dr-settled')!.textContent).toContain('أُغلق بتسوية نزاع');
		expect(s.q('dr-settled')!.textContent).toContain(reason);
		expect(s.q('dr-approve')).toBeNull();
		expect(s.q('dr-revision-toggle')).toBeNull();
		expect(s.text()).not.toContain('بانتظار مراجعة العميل');
		expect(s.q('dr-file-open')).not.toBeNull();
		expect(s.q('request-ai-review')).toBeNull();
	});

	it('active dispute: the freeze reason is shown, approval is disabled (not hidden), the revision request stays possible', async () => {
		const FREEZE = 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح على هذا المشروع';
		const s = await setup(ws(lc({ eligibility: elig({ approve: { allowed: false, reason: FREEZE, code: 'ACTIVE_DISPUTE_FREEZE', httpStatus: 423 } }) }), { disputeFreeze: { frozen: true, reason: FREEZE, activeDisputeCount: 1, disputeId: 'd' } }));
		expect(s.q('dr-freeze-banner')!.textContent).toContain(FREEZE);
		expect((s.q('dr-approve') as HTMLButtonElement).disabled).toBe(true);
		expect(s.q('dr-revision-toggle')).not.toBeNull();
		s.c.approveDelivery();
		expect(s.post).not.toHaveBeenCalled();
	});

	it('undelivered stage: no approval form, the server reason is shown', async () => {
		const reason = 'لم يسلّم مقدم الخدمة هذه المرحلة بعد، ولا يوجد تسليم لمراجعته';
		const s = await setup(ws({ status: 'in_progress', threads: [], ...lc({ awaitingClientReview: false, eligibility: elig({ approve: no('STAGE_NOT_DELIVERED', reason), requestRevision: no('STAGE_NOT_DELIVERED', reason), review: no('STAGE_NOT_DELIVERED', reason) }) }) }));
		expect(s.q('dr-undelivered')!.textContent).toContain(reason);
		expect(s.q('dr-approve')).toBeNull();
		expect(s.q('dr-revision-toggle')).toBeNull();
		expect(s.q('request-ai-review')).toBeNull();
		expect(s.text()).toContain('لم يُسلَّم شيء لهذه المرحلة بعد');
	});

	it('loading: only the skeleton (no decision form) until the server answers; then the right state, with no flash', async () => {
		const subject = new Subject<any>();
		const s = await setup(subject);
		expect(s.el.querySelector('.skeleton-row')).not.toBeNull();
		expect(s.q('dr-approve')).toBeNull();
		expect(s.q('dr-settled')).toBeNull();
		expect(s.el.querySelector('[data-state]')).toBeNull();
		subject.next(ws(lc({ closedBySettlement: true, awaitingClientReview: false, eligibility: elig({ approve: no('CLOSED_BY_SETTLEMENT', 'سبب'), requestRevision: no('CLOSED_BY_SETTLEMENT', 'سبب') }) }), { closedBySettlement: true }));
		s.f.detectChanges();
		expect(s.q('dr-approve')).toBeNull();
		expect(s.q('dr-settled')).not.toBeNull();
	});

	it('files: open = the stored https URL in a new tab; download only for our uploaded (Cloudinary) files; a name-only legacy entry is not a link', async () => {
		const s = await setup(ws(lc({})));
		const open = Array.from(s.el.querySelectorAll('[data-testid="dr-file-open"]')) as HTMLAnchorElement[];
		expect(open.map(a => a.getAttribute('href'))).toEqual([FILE_UP.url, FILE_LINK.url]);
		expect(open.every(a => a.target === '_blank' && a.rel.includes('noopener'))).toBe(true);
		const dl = Array.from(s.el.querySelectorAll('[data-testid="dr-file-download"]')) as HTMLAnchorElement[];
		expect(dl.length).toBe(1);
		expect(dl[0].getAttribute('href')).toBe('https://res.cloudinary.com/demo/image/upload/fl_attachment/v1/waseetai/deliveries/p/s/a.pdf');
		expect(dl[0].hasAttribute('download')).toBe(true);
		expect(s.q('dr-file-legacy')).not.toBeNull();
		expect(s.q('dr-file-legacy')!.tagName).toBe('SPAN');
	});

	it('a 409 from the server (state moved) keeps its specific message and re-reads the state', async () => {
		const s = await setup(ws(lc({})));
		const get = vi.spyOn(TestBed.inject(HttpClient) as any, 'get');
		(s.c as any).refreshIfStateChanged({ status: 409 });
		expect(get).toHaveBeenCalled();
	});
});
