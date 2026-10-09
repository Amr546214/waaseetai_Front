import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

// The assessment result/errors must never claim an approval the backend did not make (the specialty is approved by an admin).
const handlers: Record<string, (...args: any[]) => any> = {};
const fakeSocket = {
	connected: false,
	on: vi.fn((event: string, cb: (...args: any[]) => any) => { handlers[event] = cb; }),
	once: vi.fn(),
	off: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(() => { fakeSocket.connected = false; handlers['disconnect']?.('io client disconnect'); }),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Specialties } from './specialties';
import { AntiCheatService } from '../../../../../core/services/anti-cheat.service';

describe('Specialties — assessment result and errors never claim an approval', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let anti: AntiCheatService;
	let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

	beforeEach(async () => {
		postSpy = vi.fn(() => of({ success: true }));
		fakeSocket.connected = false;
		fakeSocket.emit.mockClear();
		for (const k of Object.keys(handlers)) delete handlers[k];
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...a: any[]) => postSpy(...a) } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		component.providerSpecialtyId.set('spec-1');
		anti = TestBed.inject(AntiCheatService);
		fixture.detectChanges();
	});

	afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

	function submitSocketResult(payload: any) {
		component.currentStep.set(4);
		anti.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		fakeSocket.connected = true;
		component.quizSessionId.set('attempt-1');
		component.userAnswers.set({ '1': 'b' });
		(component as any).submitQuizAnswers();
		anti.evaluationComplete$.next({ attemptId: 'attempt-1', score: 80, scorePercentage: 80, ...payload });
		fixture.detectChanges();
		return (fixture.nativeElement as HTMLElement).textContent || '';
	}

	it('pass + awaitingAdminApproval: waits for the admin decision and never says approved', () => {
		const text = submitSocketResult({ status: 'PASSED', isPassed: true, specialtyApproved: false, awaitingAdminApproval: true, specialtyStatus: 'UNDER_AI_REVIEW' });
		expect(component.quizResult()?.outcome).toBe('awaiting');
		expect(text).toContain('بانتظار قرار الإدارة');
		expect(text).toContain('اعتماد التخصص ومنح الشارة يتمّان بعد قرار الإدارة');
		expect(text).not.toContain('تم اعتماد');
		expect(text).not.toContain('واعتماد تخصصك');
		expect(text).not.toContain('مفعلة وموثقة');
	});

	it('pass with the approval fields absent falls back to awaiting, never approved', () => {
		submitSocketResult({ status: 'PASSED', isPassed: true });
		expect(component.quizResult()?.outcome).toBe('awaiting');
		expect(component.quizResult()?.specialtyApproved).toBe(false);
	});

	it('a legacy status APPROVED does not make it an approval; it is only a pass for display', () => {
		submitSocketResult({ status: 'APPROVED', isPassed: true });
		expect(component.quizResult()?.passed).toBe(true);
		expect(component.quizResult()?.outcome).toBe('awaiting');
	});

	it('pass + specialtyApproved: shows the pass and the badge as granted', () => {
		const text = submitSocketResult({ status: 'PASSED', isPassed: true, specialtyApproved: true, awaitingAdminApproval: false, specialtyStatus: 'APPROVED' });
		expect(component.quizResult()?.outcome).toBe('approved');
		expect(text).toContain('اجتزت التقييم');
		expect(text).toContain('معتمد');
		expect(text).not.toContain('بانتظار قرار الإدارة');
	});

	it('fail + specialtyApproved: tells the provider the approved specialty is unaffected', () => {
		const text = submitSocketResult({ status: 'FAILED', isPassed: false, specialtyApproved: true, awaitingAdminApproval: false, specialtyStatus: 'APPROVED' });
		expect(component.quizResult()?.outcome).toBe('failed');
		expect(text).toContain('تخصصك المعتمد لم يتأثر');
	});

	it('fail without approval does not mention an unaffected approval', () => {
		const text = submitSocketResult({ status: 'FAILED', isPassed: false, specialtyApproved: false });
		expect(text).not.toContain('تخصصك المعتمد لم يتأثر');
	});

	it('expired result is not a pass', () => {
		submitSocketResult({ status: 'EXPIRED', isPassed: false, message: 'انتهى الوقت' });
		expect(component.quizResult()?.outcome).toBe('expired');
		expect(component.quizResult()?.passed).toBe(false);
	});

	function emitError(err: any) {
		component.isStreamingQuestions.set(true);
		anti.assessmentError$.next(err);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}
	const retryButton = (el: HTMLElement) => Array.from(el.querySelectorAll('button')).find(b => (b.textContent || '').includes('إعادة المحاولة'));

	it('ASSESSMENT_NOT_ELIGIBLE shows the server message with no retry button', () => {
		component.currentStep.set(4);
		const el = emitError({ message: 'تخصصك معتمد بالفعل', code: 'ASSESSMENT_NOT_ELIGIBLE' });
		expect(component.quizGenerationError()).toContain('تخصصك معتمد بالفعل');
		expect(el.textContent).toContain('تخصصك معتمد بالفعل');
		expect(retryButton(el)).toBeUndefined();
	});

	it('ASSESSMENT_COOLDOWN shows the wait computed from retryAfterSeconds, no retry button', () => {
		component.currentStep.set(4);
		const el = emitError({ message: 'يجب الانتظار', code: 'ASSESSMENT_COOLDOWN', retryAfterSeconds: 7000 });
		expect(component.quizGenerationError()).toContain('يمكنك المحاولة بعد ساعتين');
		expect(retryButton(el)).toBeUndefined();
	});

	it('cooldown under an hour is shown in minutes', () => {
		emitError({ message: 'x', code: 'ASSESSMENT_COOLDOWN', retryAfterSeconds: 600 });
		expect(component.quizGenerationError()).toContain('يمكنك المحاولة بعد 10 دقائق');
	});

	it('ASSESSMENT_ATTEMPT_LIMIT and SPECIALTY_NOT_FOUND are not retryable', () => {
		emitError({ message: 'حد المحاولات', code: 'ASSESSMENT_ATTEMPT_LIMIT' });
		expect(component.quizErrorRetryable()).toBe(false);
		emitError({ message: 'غير موجود', code: 'SPECIALTY_NOT_FOUND' });
		expect(component.quizErrorRetryable()).toBe(false);
	});

	it('a genuine generation failure stays retryable', () => {
		component.currentStep.set(4);
		const el = emitError({ message: 'فشل', code: 'ASSESSMENT_GENERATION_FAILED' });
		expect(component.quizErrorRetryable()).toBe(true);
		expect(retryButton(el)).toBeDefined();
	});

	it('GENERATION_IN_PROGRESS is a notice: no error, still loading, and no second start', () => {
		component.isQuizActive.set(true);
		emitError({ message: 'قيد التوليد', code: 'GENERATION_IN_PROGRESS' });
		expect(component.quizGenerationError()).toBeNull();
		expect(component.generationInProgress()).toBe(true);
		expect(component.isStreamingQuestions()).toBe(true);
		fakeSocket.connected = true;
		anti.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		fakeSocket.emit.mockClear();
		component.retryQuizGeneration();
		(component as any).initiateDynamicQuiz();
		expect(fakeSocket.emit.mock.calls.filter(c => c[0] === 'start_assessment').length).toBe(0);
	});

	it('a second start while one is in flight sends nothing', () => {
		fakeSocket.connected = true;
		anti.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		fakeSocket.emit.mockClear();
		(component as any).initiateDynamicQuiz();
		(component as any).initiateDynamicQuiz();
		(component as any).initiateDynamicQuiz();
		expect(fakeSocket.emit.mock.calls.filter(c => c[0] === 'start_assessment').length).toBe(1);
		(component as any).stopTimer();
	});

	it('a second submit is not sent while pending nor after a result', () => {
		submitSocketResult({ status: 'FAILED', isPassed: false });
		fakeSocket.emit.mockClear();
		(component as any).submitQuizAnswers();
		(component as any).submitQuizAnswers();
		expect(fakeSocket.emit.mock.calls.filter(c => c[0] === 'submit_answer').length).toBe(0);
	});

	it('REST submit 409 / 404 is terminal: a clear message, no retry', () => {
		for (const status of [404, 409]) {
			postSpy.mockReturnValue(throwError(() => ({ status, error: { message: 'رسالة الخادم' } })));
			(component as any).runRestFallbackSubmission(`att-${status}`, {});
			expect(component.quizGenerationError()).toBe('رسالة الخادم');
			expect(component.quizErrorRetryable()).toBe(false);
		}
	});

	it('REST submit 500 stays retryable', () => {
		postSpy.mockReturnValue(throwError(() => ({ status: 500 })));
		(component as any).runRestFallbackSubmission('att-500', {});
		expect(component.quizErrorRetryable()).toBe(true);
	});

	it('REST generation refusal (HTTP 429 cooldown) renders the server message without retry', () => {
		const generate = vi.fn(() => throwError(() => ({ status: 429, error: { code: 'ASSESSMENT_COOLDOWN', message: 'انتظر', retryAfterSeconds: 3600 } })));
		(component as any).specialtyService.generateAiAssessment = generate;
		vi.useFakeTimers();
		(component as any).initiateDynamicQuiz();
		vi.advanceTimersByTime(3600);
		expect(component.quizGenerationError()).toContain('يمكنك المحاولة بعد ساعة');
		expect(component.quizErrorRetryable()).toBe(false);
	});
});
