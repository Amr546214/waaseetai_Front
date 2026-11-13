import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

// Exam guard: a reload goes back into the live attempt (server questions, saved answers, SERVER clock) with exam mode on from the first paint; the restricted mode never starts
// a test from an unverified browser; answers are saved silently; the exam is a screen of its own (no assistant, no layout chrome).
const handlers: Record<string, (...args: any[]) => any> = {};
const fakeSocket = { connected: false, on: vi.fn((e: string, cb: (...a: any[]) => any) => { handlers[e] = cb; }), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
(globalThis as any).__socketIoModule = () => ({ default: (...a: any[]) => ioSpy(...a), io: (...a: any[]) => ioSpy(...a) });

import { Specialties } from './specialties';
import { AntiCheatService } from '../../../../../core/services/anti-cheat.service';
import { AssistantExamState } from '../../../../../core/store/assistant-exam-state.service';
import { ExamEnvironmentService } from '../../../../../core/services/exam-environment.service';

const ENV_OFF = { success: true, data: { mode: 'off', ready: false, verified: false, restricted: false, downloadUrl: 'https://safeexambrowser.org/download_en.html', supportedSystems: [], limits: 'x' } };
const ENV_REQ = (verified: boolean) => ({ success: true, data: { mode: 'required', ready: true, verified, restricted: true, configUrl: 'sebs://h.test/api/exam-environment/seb-config', downloadUrl: 'https://safeexambrowser.org/download_en.html', supportedSystems: [{ system: 'Windows', supported: true }], limits: 'لا يمنع التصوير الخارجي' } });
const ACTIVE = { success: true, data: { attemptId: 'att-1', providerSpecialtyId: 'spec-1', status: 'IN_PROGRESS', remainingSeconds: 400, expired: false, answers: { '1': 'b' }, questions: [{ id: 1, textAr: 'سؤال 1', options: [{ id: 'a', text: 'أ' }, { id: 'b', text: 'ب' }] }, { id: 2, textAr: 'سؤال 2', options: [{ id: 'a', text: 'أ' }, { id: 'b', text: 'ب' }] }] } };

describe('Specialties — exam guard', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let calls: { m: string; url: string; body?: any }[];
	let route: (m: string, url: string) => any;

	async function mount(r: (m: string, url: string) => any, marker = false) {
		calls = []; route = r;
		fakeSocket.connected = false; fakeSocket.emit.mockClear(); ioSpy.mockClear();
		const store: Record<string, string> = marker ? { 'ws.exam.active': String(Date.now() + 60_000) } : {};
		vi.stubGlobal('sessionStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		const http = { get: (url: string) => { calls.push({ m: 'GET', url }); return of(route('GET', url)); }, post: (url: string, body: any) => { calls.push({ m: 'POST', url, body }); return of(route('POST', url)); }, put: (url: string, body: any) => { calls.push({ m: 'PUT', url, body }); return of(route('PUT', url)); } };
		await TestBed.configureTestingModule({ imports: [Specialties], providers: [{ provide: HttpClient, useValue: http }] }).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		return store;
	}
	const base = (m: string, url: string): any => (/exam-environment$/.test(url) ? ENV_OFF : { success: false });
	afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); TestBed.resetTestingModule(); });

	it('reload: the live attempt comes back from the server (questions, saved answers, SERVER remaining time) and exam mode stays on', async () => {
		await mount((m, url) => (/assessments\/active$/.test(url) ? ACTIVE : base(m, url)), true);
		expect(component.currentStep()).toBe(4);
		expect(component.isQuizActive()).toBe(true);
		expect(component.quizQuestions().map(q => q.text)).toEqual(['سؤال 1', 'سؤال 2']);
		expect(component.userAnswers()).toEqual({ '1': 'b' });
		expect(component.timerRemainingSec()).toBeLessThanOrEqual(400);
		expect(component.timerRemainingSec()).toBeGreaterThan(390);
		expect(TestBed.inject(AssistantExamState).examActive()).toBe(true);
		expect(calls.some(c => c.m === 'POST' && /generate$/.test(c.url))).toBe(false); // resuming never starts a new attempt
		expect(ioSpy).toHaveBeenCalled(); // the normal (unrestricted) mode keeps its live transport
	});

	it('reload with no live attempt on the server: the stale marker is cleared, exam mode ends, the normal page shows', async () => {
		const store = await mount((m, url) => (/assessments\/active$/.test(url) ? { success: true, data: null } : base(m, url)), true);
		const exam = TestBed.inject(AssistantExamState);
		expect(exam.examActive()).toBe(false);
		expect(exam.resolving()).toBe(false);
		expect(store['ws.exam.active']).toBeUndefined();
		expect(component.currentStep()).toBe(1);
	});

	it('exam mode is on from the very first paint when the marker exists (no flash of the normal page), before the server has answered', () => {
		vi.stubGlobal('sessionStorage', { getItem: (k: string) => (k === 'ws.exam.active' ? String(Date.now() + 60_000) : null), setItem: () => {}, removeItem: () => {} });
		TestBed.configureTestingModule({});
		const s = TestBed.inject(AssistantExamState);
		expect(s.examActive()).toBe(true);
		expect(s.resolving()).toBe(true);
		TestBed.resetTestingModule();
		vi.stubGlobal('sessionStorage', { getItem: () => String(Date.now() - 1), setItem: () => {}, removeItem: () => {} });
		expect(TestBed.inject(AssistantExamState).examActive()).toBe(false); // an expired marker is ignored
	});

	it('restricted mode, browser NOT verified: the test does not start, no question is requested, the instructions show', async () => {
		await mount((m, url) => (/exam-environment$/.test(url) ? ENV_REQ(false) : { success: false }));
		component.providerSpecialtyId.set('spec-1');
		component.currentStep.set(3);
		(component as any).initiateDynamicQuiz();
		fixture.detectChanges();
		expect(component.showExamInstructions()).toBe(true);
		expect(component.isQuizActive()).toBe(false);
		expect(calls.some(c => /assessments\/generate$/.test(c.url))).toBe(false);
		expect(fakeSocket.emit).not.toHaveBeenCalledWith('start_assessment', expect.anything());
		expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="exam-env-instructions"]')).not.toBeNull();
		expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="exam-env-limits"]')?.textContent).toContain('التصوير الخارجي');
	});

	it('restricted mode, verified: the attempt starts over the verified HTTP route only (no socket stream, no socket answers)', async () => {
		await mount((m, url) => (/exam-environment$/.test(url) ? ENV_REQ(true) : /assessments\/generate$/.test(url) ? { success: true, data: ACTIVE.data } : { success: false }));
		const anti = TestBed.inject(AntiCheatService);
		expect(anti.restricted()).toBe(true);
		vi.useFakeTimers();
		component.providerSpecialtyId.set('spec-1');
		component.currentStep.set(3);
		(component as any).initiateDynamicQuiz();
		vi.advanceTimersByTime(5);
		expect(calls.some(c => c.m === 'POST' && /assessments\/generate$/.test(c.url))).toBe(true);
		expect(fakeSocket.emit).not.toHaveBeenCalledWith('start_assessment', expect.anything());
		expect(anti.submitAssessmentAnswers('att-1', { '1': 'a' })).toBe(false); // forces the verified REST submission
		expect(ioSpy).not.toHaveBeenCalled();
		expect(TestBed.inject(ExamEnvironmentService).satisfied()).toBe(true);
	});

	it('answers are saved silently (debounced) with a sequence number; the page shows them as unconfirmed until the SERVER answers', async () => {
		await mount((m, url) => (/assessments\/active$/.test(url) ? ACTIVE : /answers$/.test(url) ? { success: true, data: { saved: true, answers: { '1': 'a', '2': 'a' } } } : base(m, url)), true);
		vi.useFakeTimers();
		component.selectQuestionAnswer('2', 'a');
		component.selectQuestionAnswer('1', 'a');
		expect(calls.filter(c => c.m === 'PUT').length).toBe(0);
		expect(component.autosave.status()?.state).toBe('unconfirmed');
		expect(component.autosave.unconfirmedCount()).toBe(2);
		vi.advanceTimersByTime(1600);
		const puts = calls.filter(c => c.m === 'PUT');
		expect(puts.length).toBe(1);
		expect(puts[0].url).toMatch(/assessments\/att-1\/answers$/);
		expect(puts[0].body.answers).toEqual({ '1': 'a', '2': 'a' });
		expect(typeof puts[0].body.seq).toBe('number');
		expect(component.autosave.status()?.state).toBe('saved'); // confirmed because the server's answer holds them
		expect(component.autosave.unconfirmedCount()).toBe(0);
	});

	it('the leave-the-test copy no longer threatens an automatic loss: progress is saved and the leave is only an event', async () => {
		await mount(base);
		const text = JSON.stringify((component as any).declarations());
		expect(text).not.toContain('ستتسبب ببطول');
		expect(text).not.toContain('24 ساعة');
		expect(text).toContain('تُسجَّل كحدث');
	});
});
