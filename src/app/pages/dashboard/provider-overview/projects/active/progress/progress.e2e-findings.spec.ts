import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { Progress } from './progress';

const stage = (o: Record<string, unknown> = {}) => ({ id: 'st1', stageNumber: 1, title: 'التصميم', description: '', amount: 8.729999999999999, days: 4, status: 'in_progress', statusText: 'قيد التنفيذ', isDone: false, isWait: true, roundsCount: 0, threads: [], canUploadDelivery: true, canSubmitDelivery: true, uploadBlockedReason: null, amountHeld: true, ...o });
const data = (stages: any[]) => ({ projectId: 'p1', title: 'م', contractRef: 'CT-1', clientName: 'ع', statusLabel: 'مشروع نشط', status: 'ACTIVE', contractStatus: 'ACTIVE', price: 70, daysLeft: 5, progress: 0, escrowTotal: 70, escrowHeld: 70, escrowReleased: 0, stages, edits: [], messages: [], files: [], deliveries: [] });

describe('provider progress: delivery buttons follow the server flags (e2e findings)', () => {
	async function setup(stages: any[]) {
		const post = vi.fn(() => of({ success: true, data: {} }));
		const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: [] }) : of({ success: true, data: data(stages) }));
		await TestBed.configureTestingModule({ imports: [Progress], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } },
			{ provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(Progress); f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, post };
	}
	afterEach(() => TestBed.resetTestingModule());
	const uploadBtns = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).filter(b => /رفع تسليم المرحلة|إعادة التسليم/.test(b.textContent || ''));

	it('real stages are listed (no «لم تُجهَّز مراحل المشروع»), and the upload button follows canUploadDelivery', async () => {
		const s = await setup([stage(), stage({ id: 'st2', stageNumber: 2, title: 'التطوير', canUploadDelivery: false, canSubmitDelivery: false, status: 'pending', uploadBlockedReason: 'تبدأ بعد اعتماد المرحلة السابقة', amountHeld: false })]);
		expect(s.el.textContent).not.toContain('لم تُجهَّز مراحل المشروع');
		expect(s.el.textContent).toContain('التطوير');
		expect(uploadBtns(s.el)).toHaveLength(1); // only the stage the server allows
		expect(s.el.textContent).toContain('تبدأ بعد اعتماد المرحلة السابقة');
		expect(s.el.textContent).toContain('8.73 USD');
		expect(s.el.textContent).not.toContain('8.729999');
	});

	it('openDelivery is refused with the server reason when canUploadDelivery is false', async () => {
		const s = await setup([stage({ canUploadDelivery: false, canSubmitDelivery: false, uploadBlockedReason: 'بانتظار مراجعة العميل' })]);
		s.c.openDelivery(s.c.projectData().stages[0]);
		expect(s.c.deliveryStage()).toBeNull();
		expect(s.c.error()).toBe('بانتظار مراجعة العميل');
	});

	it('submitDelivery sends nothing and shows uploadBlockedReason when canSubmitDelivery is false; the send button is disabled', async () => {
		const s = await setup([stage({ canSubmitDelivery: false, uploadBlockedReason: 'لا يمكن الإرسال الآن' })]);
		s.c.deliveryStage.set(s.c.projectData().stages[0]); s.c.deliveryStep.set(2); s.f.detectChanges();
		s.c.submitDelivery();
		expect(s.post).not.toHaveBeenCalled();
		expect(s.c.error()).toBe('لا يمكن الإرسال الآن');
		const btn = s.el.querySelector('[data-testid="submit-delivery-btn"]') as HTMLButtonElement | null;
		if (btn) expect(btn.disabled).toBe(true);
	});
});
