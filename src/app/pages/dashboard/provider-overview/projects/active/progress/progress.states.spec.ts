import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Progress } from './progress';

// The workspace renders the server's delivery / revision / escrow state as it is: no invented fallback.
const stage = (o: Record<string, unknown> = {}) => ({ id: 'st1', stageNumber: 1, title: 'المرحلة 1', description: '', amount: 100, status: 'in_progress', statusText: 'قيد التنفيذ', isDone: false, isWait: true, roundsCount: 0, threads: [], canUploadDelivery: true, uploadBlockedReason: null, amountHeld: true, revisionRequested: false, ...o });
const data = (o: Record<string, unknown> = {}, stages = [stage()], edits: any[] = []) => ({ title: 'م', contractRef: 'CT-1', clientName: 'ع', statusLabel: 'مشروع نشط', status: 'ACTIVE', price: 100, daysLeft: 5, progress: 0, escrowTotal: 100, escrowHeld: 100, escrowReleased: 0, stages, edits, deliveries: [], messages: [], files: [], conversationId: null, aiInsights: {}, ...o });

describe('provider progress: contract / revision states', () => {
	async function setup(first: any, next?: any) {
		const get = vi.fn().mockReturnValueOnce(of({ success: true, data: first })).mockReturnValue(of({ success: true, data: next ?? first }));
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get, post: vi.fn(() => of({ success: true, data: {} })) } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, get };
	}
	afterEach(() => TestBed.resetTestingModule());
	const q = (el: HTMLElement, sel: string) => el.querySelectorAll(sel);
	const uploadBtns = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).filter(b => /رفع تسليم المرحلة|إعادة التسليم|رفع جديد/.test(b.textContent || ''));

	it('pending-signature contract: no upload button, the server reason is shown, nothing is called "held"', async () => {
		const reason = 'العقد بانتظار توقيعك، ولا يمكن التسليم قبل بدء العقد';
		const s = await setup(data({ contractStatus: 'PENDING_PROVIDER_SIGNATURE', statusLabel: 'بانتظار توقيعك على العقد', status: 'PENDING_PROVIDER_SIGNATURE', escrowHeld: 0 },
			[stage({ status: 'pending', statusText: 'لم تبدأ بعد', canUploadDelivery: false, uploadBlockedReason: reason, amountHeld: false })]));
		expect(uploadBtns(s.el)).toHaveLength(0);
		expect(s.el.textContent).toContain(reason);
		expect(s.el.textContent).toContain('بانتظار توقيعك على العقد');
		expect(s.el.textContent).not.toContain('محتجز 100');
		expect(s.el.textContent).toContain('قيمة المرحلة 100');
	});

	it('a stage waiting for the client shows no "رفع جديد" (the server would refuse it)', async () => {
		const s = await setup(data({}, [stage({ status: 'submitted', statusText: 'بانتظار مراجعة العميل', canUploadDelivery: false, uploadBlockedReason: 'x', awaitingClientReview: true, threads: [{ id: 't', note: 'n', files: [] }], roundsCount: 1 })]));
		expect(uploadBtns(s.el)).toHaveLength(0);
		expect(s.el.textContent).toContain('بانتظار اعتماد العميل');
	});

	it('an allowed stage shows the upload button, and revision-requested says "إعادة التسليم"', async () => {
		const s = await setup(data({}, [stage({ status: 'revision', revisionRequested: true })]));
		expect(uploadBtns(s.el).length).toBeGreaterThan(0);
		expect(uploadBtns(s.el).some(b => /إعادة التسليم/.test(b.textContent || ''))).toBe(true);
	});

	it('edits tab: waiting shows the upload button; after re-delivery / approval the card is not "awaiting re-delivery" and offers no upload', async () => {
		const edit = (o: any) => ({ id: 'e1', stageId: 'st1', stageTitle: 'المرحلة 1', title: 'ملاحظات', clientNotes: 'عدّل', createdAt: '2026-10-01', canUploadDelivery: false, uploadBlockedReason: null, ...o });
		const waiting = data({}, [stage({ status: 'revision', revisionRequested: true })], [edit({ status: 'waiting', statusText: 'بانتظار إعادة التسليم', canUploadDelivery: true })]);
		const resub = data({}, [stage({ status: 'submitted', canUploadDelivery: false, uploadBlockedReason: 'x' })], [edit({ status: 'resubmitted', statusText: 'أُعيد التسليم، بانتظار مراجعة العميل' })]);
		const approved = data({}, [stage({ status: 'completed', isDone: true, canUploadDelivery: false, amountHeld: false })], [edit({ status: 'approved', statusText: 'اعتُمدت المرحلة بعد التعديل' })]);
		const s = await setup(waiting, resub);
		s.c.setTab('edits'); // re-reads the workspace: the client's reply is decided on the other side
		s.f.detectChanges();
		// the embedded read-only rating summary also reads rating-status; only the workspace reads are counted here
		expect(s.get.mock.calls.filter((c: any[]) => !String(c[0]).includes('rating-status')).length).toBe(2);
		const card = () => s.el.querySelector('.edit-card')!.textContent || '';
		expect(card()).toContain('أُعيد التسليم، بانتظار مراجعة العميل');
		expect(card()).not.toContain('بانتظار إعادة التسليم');
		expect(Array.from(q(s.el, 'button')).some(b => /رفع النسخة المعدلة/.test(b.textContent || ''))).toBe(false);
		s.get.mockReturnValue(of({ success: true, data: approved }));
		s.c.setTab('edits'); s.f.detectChanges();
		expect(card()).toContain('اعتُمدت المرحلة بعد التعديل');
		expect(card()).not.toContain('بانتظار إعادة التسليم');
	});

	it('edits tab while still owed: the upload button is offered', async () => {
		const waiting = data({}, [stage({ status: 'revision', revisionRequested: true })], [{ id: 'e1', stageId: 'st1', stageTitle: 'م', title: 'ملاحظات', clientNotes: 'عدّل', status: 'waiting', statusText: 'بانتظار إعادة التسليم', createdAt: '2026-10-01', canUploadDelivery: true }]);
		const s = await setup(waiting);
		s.c.setTab('edits'); s.f.detectChanges();
		expect(Array.from(q(s.el, 'button')).some(b => /رفع النسخة المعدلة/.test(b.textContent || ''))).toBe(true);
	});

	it('openDelivery refuses a stage the server marked as not deliverable', async () => {
		const s = await setup(data());
		s.c.openDelivery({ id: 'st1', canUploadDelivery: false, uploadBlockedReason: 'سبب' });
		expect(s.c.deliveryStage()).toBeNull();
		expect(s.c.error()).toBe('سبب');
	});
});
