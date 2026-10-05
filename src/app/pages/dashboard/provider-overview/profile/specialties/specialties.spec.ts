import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

// Batch 3D-2 — assessment_error frontend handling. socket.io-client is
// mocked at the module boundary (same pattern as ai-assistant.spec.ts); the
// component subscribes to the real AntiCheatService singleton's
// assessmentError$ Subject, which is fed directly here (no real socket
// round-trip needed to prove the component-level wiring).
//
// Batch 3D-4: the final cumulative review found that `disconnect: vi.fn()`
// was a defective mock — a real socket.io-client fires its registered
// 'disconnect' handler (synchronously, for a client-initiated disconnect)
// when `.disconnect()` is called, but this stub did nothing, so no 3D-3 test
// ever exercised what an intentional `stopMonitoring()` call actually
// triggers. Fixed: `on()` captures handlers, `disconnect()` marks the socket
// disconnected and invokes the captured 'disconnect' handler with a realistic
// reason string, matching real client-initiated-disconnect behavior closely
// enough to catch this exact class of bug without overbuilding a full
// socket.io simulator.
const handlers: Record<string, (...args: any[]) => any> = {};
const fakeSocket = {
	connected: false,
	on: vi.fn((event: string, cb: (...args: any[]) => any) => { handlers[event] = cb; }),
	once: vi.fn(),
	off: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(() => {
		fakeSocket.connected = false;
		handlers['disconnect']?.('io client disconnect');
	}),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { Specialties } from './specialties';
import { AntiCheatService } from '../../../../../core/services/anti-cheat.service';

describe('Specialties — assessment_error handling (Batch 3D-2)', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let antiCheatService: AntiCheatService;
	let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

	beforeEach(async () => {
		getSpy = vi.fn(() => of({ success: false }));
		postSpy = vi.fn(() => of({ success: true }));

		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});

		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [
				{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		antiCheatService = TestBed.inject(AntiCheatService);
		fixture.detectChanges();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('a real assessment_error reaches the component and sets an honest, sanitized failure message', () => {
		component.isStreamingQuestions.set(true);

		antiCheatService.assessmentError$.next({ message: 'حدث خطأ أثناء بث أسئلة التقييم الفني عبر الذكاء الاصطناعي.' });

		expect(component.quizGenerationError()).toBe('حدث خطأ أثناء بث أسئلة التقييم الفني عبر الذكاء الاصطناعي.');
	});

	it('stops the streaming loading UI when a real generation error arrives', () => {
		// Batch 3D-3: generation and submission are mutually exclusive phases —
		// a generation-phase assessment_error only ever arrives while
		// isStreamingQuestions is true and isSubmittingQuiz is still false.
		component.isStreamingQuestions.set(true);

		antiCheatService.assessmentError$.next({ message: 'فشل توليد الأسئلة.' });

		expect(component.isStreamingQuestions()).toBe(false);
		expect(component.isSubmittingQuiz()).toBe(false);
	});

	it('never fabricates a quiz result/success when a real error arrives', () => {
		antiCheatService.assessmentError$.next({ message: 'فشل توليد الأسئلة.' });

		expect(component.quizResult()).toBeNull();
	});

	it('never automatically invokes the legacy quiz fallback (no HTTP call at all) when a real error arrives', () => {
		postSpy.mockClear();

		antiCheatService.assessmentError$.next({ message: 'فشل توليد الأسئلة.' });

		expect(postSpy).not.toHaveBeenCalled();
	});

	it('retryQuizGeneration clears the error state and re-initiates generation', () => {
		antiCheatService.assessmentError$.next({ message: 'فشل توليد الأسئلة.' });
		expect(component.quizGenerationError()).toBe('فشل توليد الأسئلة.');

		component.retryQuizGeneration();

		expect(component.quizGenerationError()).toBeNull();
	});
});

describe('Specialties — submission transport consolidation (Batch 3D-3 + 3D-4 lifecycle fix)', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let antiCheatService: AntiCheatService;
	let getSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;
	let postSpy: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

	function submitViaSocket() {
		antiCheatService.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		fakeSocket.connected = true;
		component.quizSessionId.set('attempt-1');
		component.userAnswers.set({ '1': 'b' });
		(component as any).submitQuizAnswers(false);
	}

	function watchersActive(): boolean {
		const c = component as any;
		return !!(c.submissionEvaluationSub || c.submissionErrorSub || c.submissionDisconnectSub || c.submissionFallbackTimer);
	}

	beforeEach(async () => {
		getSpy = vi.fn(() => of({ success: false }));
		postSpy = vi.fn(() => of({ success: true, data: { isPassed: true, score: 90, feedbackAr: 'ممتاز', strengths: [], weaknesses: [] }, message: 'نجحت' }));
		fakeSocket.connected = false;
		fakeSocket.emit.mockClear();
		fakeSocket.on.mockClear();
		fakeSocket.disconnect.mockClear();
		for (const key of Object.keys(handlers)) delete handlers[key];

		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});

		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [
				{ provide: HttpClient, useValue: { get: (...args: any[]) => getSpy(...args), post: (...args: any[]) => postSpy(...args) } },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		antiCheatService = TestBed.inject(AntiCheatService);
		fixture.detectChanges();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('normal primary submission starts exactly once via the socket, not REST', () => {
		submitViaSocket();

		const submitCalls = fakeSocket.emit.mock.calls.filter((c: any) => c[0] === 'submit_answer');
		expect(submitCalls.length).toBe(1);
		expect(submitCalls[0][1]).toEqual({ attemptId: 'attempt-1', answers: { '1': 'b' } });
	});

	it('REST is NOT fired in parallel with the socket for a normal submission', () => {
		submitViaSocket();

		expect(postSpy).not.toHaveBeenCalled();
	});

	// Batch 3D-4, requirement 1 — watchers must be attached BEFORE the emit.
	// Proven by making the emit itself synchronously deliver a response (the
	// fastest possible server reply): if watchers were armed even one tick
	// later, this synchronous evaluation_complete would be lost entirely.
	it('submission watchers are attached before submit_answer is emitted (a synchronous response is not lost)', () => {
		fakeSocket.emit.mockImplementation((event: string) => {
			if (event === 'submit_answer') {
				antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 100, status: 'APPROVED' });
			}
		});

		submitViaSocket();

		expect(component.quizResult()?.passed).toBe(true);
		fakeSocket.emit.mockReset();
	});

	// Batch 3D-4, requirement 2 — the socket must not be torn down the
	// instant the request is sent; it must stay connected while the
	// submission is genuinely still pending.
	it('the socket remains connected (not disconnected) immediately after emitting, while the submission is still pending', () => {
		submitViaSocket();

		expect(fakeSocket.disconnect).not.toHaveBeenCalled();
		expect(component.isSubmittingQuiz()).toBe(true);
	});

	it('primary success applies quizResult exactly once and clears isSubmittingQuiz', () => {
		submitViaSocket();

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, scorePercentage: 95, status: 'APPROVED', feedbackAr: 'ممتاز' });

		expect(component.isSubmittingQuiz()).toBe(false);
		expect(component.quizResult()?.passed).toBe(true);
		expect(component.quizResult()?.scorePercentage).toBe(95);
		expect(postSpy).not.toHaveBeenCalled();
	});

	it('a WaseetAI-graded result (score only) never shows an invented correct-answers count or explanations', () => {
		submitViaSocket();

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 85, status: 'COMPLETED', feedbackAr: 'جيد', strengths: ['أ'], weaknesses: [] });
		component.currentStep.set(4);
		fixture.detectChanges();

		expect(component.quizResult()?.scorePercentage).toBe(85);
		expect(component.quizResult()?.correctAnswers).toBeNull();
		expect(component.quizResult()?.detailedResults).toEqual([]);
		const text = fixture.nativeElement.textContent as string;
		expect(text).toContain('85%'); // the result screen really rendered
		expect(text).toContain('جيد'); // real WaseetAI feedback is shown
		expect(text).not.toContain('الإجابات الصحيحة');
		expect(text).not.toContain('مراجعة الإجابات التمحيصية');
	});

	it('a legacy result that really carries correctAnswers still shows it', () => {
		submitViaSocket();

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 80, correctAnswers: 16, status: 'COMPLETED' });
		component.currentStep.set(4);
		fixture.detectChanges();

		expect(component.quizResult()?.correctAnswers).toBe(16);
		expect(fixture.nativeElement.textContent).toContain('الإجابات الصحيحة');
	});

	it('a result with no real score is a service error, never a failed/rejected result for the user', () => {
		submitViaSocket();

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: false, status: 'COMPLETED' });
		component.currentStep.set(4);
		fixture.detectChanges();

		expect(component.quizResult()).toBeNull();
		expect(component.quizGenerationError()).toContain('لم يتم احتساب أي درجة');
		expect(component.isSubmittingQuiz()).toBe(false);
		const text = fixture.nativeElement.textContent as string;
		expect(text).toContain('تعذر إكمال التقييم الفني'); // the error card is shown
		expect(text).toContain('إعادة المحاولة');
		expect(text).not.toContain('0%');
		expect(text).not.toContain('معلقة مؤقتاً'); // no "badge locked" / failed-result screen
		expect(postSpy).not.toHaveBeenCalled(); // nothing was submitted or changed
	});

	// Batch 3D-4, requirements 3 & 16 — success is received and applied
	// first; stopMonitoring()'s disconnect only happens as a consequence of
	// that settlement, afterward.
	it('socket success is received and cleanup (disconnect) happens only afterward, in that order', () => {
		submitViaSocket();
		expect(fakeSocket.disconnect).not.toHaveBeenCalled();

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });

		expect(component.quizResult()?.passed).toBe(true);
		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
	});

	// Batch 3D-4, requirement 4 (regression for the exact bug found by final
	// review) — with the FIXED fakeSocket.disconnect (which now actually
	// fires the registered 'disconnect' handler), a real intentional
	// post-success disconnect must not be misread as a transport failure.
	it('the intentional disconnect performed after success does NOT invoke the REST fallback (regression for the 3D-3 lifecycle bug)', () => {
		submitViaSocket();

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });

		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
		expect(postSpy).not.toHaveBeenCalled();
		expect(component.quizResult()?.passed).toBe(true);
	});

	it('primary success prevents the fallback timer from ever firing', () => {
		vi.useFakeTimers();
		submitViaSocket();
		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });

		vi.advanceTimersByTime(60_000);

		expect(postSpy).not.toHaveBeenCalled();
	});

	it('a genuine retryable primary failure (SUBMISSION_FAILED) invokes the REST fallback exactly once', () => {
		submitViaSocket();

		antiCheatService.assessmentError$.next({ message: 'فشل معالجة التقييم النهائي عبر الـ WebSocket.', code: 'SUBMISSION_FAILED' });

		expect(postSpy).toHaveBeenCalledTimes(1);
		expect(postSpy.mock.calls[0][0]).toContain('/assessments/attempt-1/submit');
	});

	it('a terminal business failure (ALREADY_FINALIZED) does NOT invoke the REST fallback', () => {
		submitViaSocket();

		antiCheatService.assessmentError$.next({ message: 'تم تسليم وتقييم محاولة التقييم هذه مسبقاً.', code: 'ALREADY_FINALIZED' });

		expect(postSpy).not.toHaveBeenCalled();
		expect(component.isSubmittingQuiz()).toBe(false);
		expect(component.quizGenerationError()).toBe('تم تسليم وتقييم محاولة التقييم هذه مسبقاً.');
	});

	// Batch 3D-4, requirements 7 & 16 — cleanup still runs after a terminal
	// business error, and the resulting intentional disconnect must not
	// retrigger the fallback for an already-settled attempt.
	it('the intentional disconnect performed after a terminal business error does NOT invoke the REST fallback', () => {
		submitViaSocket();

		antiCheatService.assessmentError$.next({ message: 'خطأ نهائي', code: 'NOT_FOUND' });

		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
		expect(postSpy).not.toHaveBeenCalled();
	});

	it('other terminal codes (NOT_FOUND, AUTH_REQUIRED, RATE_LIMITED, INVALID_REQUEST) also do NOT invoke the REST fallback', () => {
		for (const code of ['NOT_FOUND', 'AUTH_REQUIRED', 'RATE_LIMITED', 'INVALID_REQUEST']) {
			postSpy.mockClear();
			component.isSubmittingQuiz.set(false);
			submitViaSocket();
			antiCheatService.assessmentError$.next({ message: 'خطأ نهائي', code });
			expect(postSpy).not.toHaveBeenCalled();
		}
	});

	it('a real mid-flight socket disconnect (network drop, not our own intentional call) triggers the REST fallback exactly once', () => {
		submitViaSocket();

		// A genuine transport-initiated disconnect — fired directly on the
		// registered handler, the same way the real socket.io-client would
		// for a network-caused drop, distinct from calling fakeSocket.disconnect()
		// ourselves.
		handlers['disconnect']?.('transport close');

		expect(postSpy).toHaveBeenCalledTimes(1);

		// No second fallback if a further stray disconnect arrives.
		handlers['disconnect']?.('transport close');
		expect(postSpy).toHaveBeenCalledTimes(1);
	});

	it('fallback success applies the result exactly once', () => {
		submitViaSocket();
		antiCheatService.assessmentError$.next({ message: 'فشل', code: 'SUBMISSION_FAILED' });

		expect(component.quizResult()?.passed).toBe(true);
		expect(component.quizResult()?.scorePercentage).toBe(90);
		expect(postSpy).toHaveBeenCalledTimes(1);
	});

	it('a late primary error arriving after a confirmed success cannot overwrite the success', () => {
		submitViaSocket();
		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });
		const settledResult = component.quizResult();

		// Late/duplicate event for the same (now-settled) attempt — e.g. the
		// backend's direct-emit + room-broadcast double delivery, or a stray
		// error from an already-superseded transport.
		antiCheatService.assessmentError$.next({ message: 'فشل معالجة التقييم النهائي عبر الـ WebSocket.', code: 'SUBMISSION_FAILED' });

		expect(component.quizResult()).toEqual(settledResult);
		expect(component.quizGenerationError()).toBeNull();
		expect(postSpy).not.toHaveBeenCalled();
	});

	it('a duplicate success event for the same attempt is ignored (backend direct-emit + room-broadcast double delivery)', () => {
		submitViaSocket();
		const payload = { attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED', feedbackAr: 'أول' };
		antiCheatService.evaluationComplete$.next(payload);
		antiCheatService.evaluationComplete$.next({ ...payload, feedbackAr: 'مختلف' });

		expect(component.quizResult()?.feedbackAr).toBe('أول');
	});

	it('rapid double-click / repeated invocation starts only one submission', () => {
		antiCheatService.startAssessmentStream({ providerSpecialtyId: 'spec-1' });
		fakeSocket.connected = true;
		component.quizSessionId.set('attempt-1');
		component.userAnswers.set({ '1': 'b' });

		(component as any).submitQuizAnswers(false);
		(component as any).submitQuizAnswers(false);
		(component as any).submitQuizAnswers(false);

		const submitCalls = fakeSocket.emit.mock.calls.filter((c: any) => c[0] === 'submit_answer');
		expect(submitCalls.length).toBe(1);
	});

	it('isSubmittingQuiz terminates on success', () => {
		submitViaSocket();
		expect(component.isSubmittingQuiz()).toBe(true);

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });

		expect(component.isSubmittingQuiz()).toBe(false);
	});

	it('isSubmittingQuiz terminates on a terminal failure', () => {
		submitViaSocket();
		expect(component.isSubmittingQuiz()).toBe(true);

		antiCheatService.assessmentError$.next({ message: 'خطأ نهائي', code: 'ALREADY_FINALIZED' });

		expect(component.isSubmittingQuiz()).toBe(false);
	});

	it('the retryable path only calls the canonical REST endpoint — the legacy quiz/submit endpoint no longer exists as a fallback', () => {
		submitViaSocket();
		antiCheatService.assessmentError$.next({ message: 'فشل', code: 'SUBMISSION_FAILED' });

		// Batch 4D: the legacy SpecialtyTestSession quiz/submit fallback was
		// removed entirely — a canonical REST failure is now terminal.
		expect(postSpy).toHaveBeenCalledTimes(1);
		expect(postSpy.mock.calls[0][0]).toContain('/assessments/attempt-1/submit');
		expect(postSpy.mock.calls[0][0]).not.toContain('/quiz/submit');
	});

	// Batch 3D-4, requirement 11 — after the REST fallback itself succeeds
	// and finishSubmission() disconnects the (unused, still-open) socket,
	// that disconnect must not start a second fallback attempt.
	it('REST fallback success followed by intentional disconnect does not trigger a second fallback request', () => {
		submitViaSocket();
		antiCheatService.assessmentError$.next({ message: 'فشل', code: 'SUBMISSION_FAILED' });

		expect(postSpy).toHaveBeenCalledTimes(1);
		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);
		expect(postSpy).toHaveBeenCalledTimes(1); // still exactly one — the disconnect above did not add another
	});

	// Batch 3D-4, requirement 12 (updated Batch 4D) — when the canonical REST
	// submit itself fails, the honest failure state is applied exactly once
	// with no retry against the removed legacy quiz/submit endpoint.
	it('a canonical REST fallback failure settles once, honestly, with no legacy retry', () => {
		postSpy.mockImplementation(() => throwError(() => ({ error: { message: 'down' } })));

		submitViaSocket();
		antiCheatService.assessmentError$.next({ message: 'فشل', code: 'SUBMISSION_FAILED' });

		// Only the primary REST submit call — no legacy inner attempt exists anymore.
		expect(postSpy).toHaveBeenCalledTimes(1);
		expect(component.isSubmittingQuiz()).toBe(false);
		expect(component.quizGenerationError()).toBeTruthy();
		expect(fakeSocket.disconnect).toHaveBeenCalledTimes(1);

		// A further stray disconnect must not restart anything.
		const callsBefore = postSpy.mock.calls.length;
		handlers['disconnect']?.('transport close');
		expect(postSpy.mock.calls.length).toBe(callsBefore);
	});

	// Batch 3D-4, requirement 17 — no terminal path may leave a watcher or
	// the fallback timer active.
	it('no submission watcher or fallback timer remains active after any terminal outcome', () => {
		submitViaSocket();
		expect(watchersActive()).toBe(true);

		antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });

		expect(watchersActive()).toBe(false);
	});

	it('no submission watcher remains active after a terminal business error', () => {
		submitViaSocket();
		antiCheatService.assessmentError$.next({ message: 'خطأ نهائي', code: 'ALREADY_FINALIZED' });

		expect(watchersActive()).toBe(false);
	});

	it('no submission watcher remains active after a REST fallback settles', () => {
		submitViaSocket();
		antiCheatService.assessmentError$.next({ message: 'فشل', code: 'SUBMISSION_FAILED' });

		expect(watchersActive()).toBe(false);
	});

	// Batch 3D-4, requirement 18 — proves the fixed fakeSocket.disconnect
	// actually exercises the exact bug the final cumulative review found: an
	// intentional disconnect immediately reachable from the settlement path
	// must not be misinterpreted as a transport failure. Against the
	// pre-3D-4 ordering (stopMonitoring() called immediately after emit,
	// before watchers were armed), this exact sequence — emit, then a
	// same-tick disconnect — would have left the fallback to fire spuriously
	// (either immediately via the disconnect signal racing the not-yet-armed
	// watcher, or after the full 25s timeout). With the fix, success is
	// captured first and the subsequent disconnect is inert.
	it('an emit immediately followed by a synchronous disconnect-and-success sequence resolves as a real success, not a spurious fallback', () => {
		fakeSocket.emit.mockImplementation((event: string) => {
			if (event === 'submit_answer') {
				antiCheatService.evaluationComplete$.next({ attemptId: 'attempt-1', isPassed: true, score: 95, status: 'APPROVED' });
			}
		});

		submitViaSocket();

		expect(component.quizResult()?.passed).toBe(true);
		expect(postSpy).not.toHaveBeenCalled();
		fakeSocket.emit.mockReset();
	});
});

describe('Specialties — question generation never fabricates local questions', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let generate: ReturnType<typeof vi.fn<(...args: any[]) => any>>;

	beforeEach(async () => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [{ provide: HttpClient, useValue: { get: () => of({ success: false }), post: () => of({ success: true }) } }],
		}).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		fixture.detectChanges();
		generate = vi.fn();
		(component as any).specialtyService.generateAiAssessment = generate;
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	/** Starts the quiz and lets the 3.5 s "socket silent -> REST" timer fire. */
	function startAndWaitForRestFallback() {
		vi.useFakeTimers();
		try {
			(component as any).initiateDynamicQuiz();
			vi.advanceTimersByTime(3600);
		} finally {
			vi.useRealTimers();
		}
	}

	const expectHonestError = () => {
		expect(component.quizGenerationError()).toContain('تعذر إنشاء أسئلة التقييم');
		expect(component.quizQuestions()).toEqual([]);
		expect(component.isStreamingQuestions()).toBe(false);
		expect(component.usingStaticFallbackQuestions()).toBe(false);
		expect(component.quizResult()).toBeNull();
	};

	it('REST failure: an explicit error, no questions at all (the old 20 local questions are gone)', () => {
		generate.mockReturnValue(throwError(() => ({ status: 500, error: { message: 'boom' } })));
		startAndWaitForRestFallback();
		expectHonestError();
		expect((component as any).applyFallback20Questions).toBeUndefined();
	});

	it('REST answers success:false: an explicit error, no questions', () => {
		generate.mockReturnValue(of({ success: false }));
		startAndWaitForRestFallback();
		expectHonestError();
	});

	it('REST answers success with an empty question list: an explicit error, never an empty or invented quiz', () => {
		generate.mockReturnValue(of({ success: true, data: { attemptId: 'a1', questions: [] } }));
		startAndWaitForRestFallback();
		expectHonestError();
	});

	it('GENERATION_IN_PROGRESS is not a failure: no error and no invented questions (the real ones arrive over the socket)', () => {
		generate.mockReturnValue(throwError(() => ({ status: 409, error: { code: 'GENERATION_IN_PROGRESS' } })));
		startAndWaitForRestFallback();
		expect(component.quizGenerationError()).toBeNull();
		expect(component.quizQuestions()).toEqual([]);
	});

	it('real REST questions still work and are shown as received (backend-reported static bank stays flagged)', () => {
		generate.mockReturnValue(of({ success: true, data: { attemptId: 'a1', generationSource: 'STATIC_FALLBACK', questions: [{ id: 'q1', textAr: 'سؤال حقيقي', options: [{ id: 'a', text: 'ا' }] }] } }));
		startAndWaitForRestFallback();
		expect(component.quizQuestions().length).toBe(1);
		expect(component.quizQuestions()[0].text).toBe('سؤال حقيقي');
		expect(component.usingStaticFallbackQuestions()).toBe(true);
		expect(component.quizGenerationError()).toBeNull();
		(component as any).stopTimer();
	});

	it('the error offers a retry that clears it', () => {
		generate.mockReturnValue(throwError(() => ({ status: 500 })));
		startAndWaitForRestFallback();
		expectHonestError();
		component.retryQuizGeneration();
		expect(component.quizGenerationError()).toBeNull();
		(component as any).stopTimer();
	});
});
