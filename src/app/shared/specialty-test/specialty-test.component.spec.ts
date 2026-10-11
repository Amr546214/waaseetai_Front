/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SPECIALTY_TEST_PASS_SCORE, SPECIALTY_TEST_QUESTION_COUNT, SPECIALTY_TEST_TIME_LIMIT_MINUTES, SpecialtyTestComponent, type SpecialtyTestResult } from './specialty-test.component';
import { SETUP_TEST_QUESTION_COUNT, SETUP_TEST_TIME_LIMIT_MINUTES } from '../../core/services/setup-test.service';

// ONE specialty test screen for the setup test and the later specialty test.
const Q = { text: 'ما هو الـ Closure؟', options: ['أ', 'ب', 'ج', 'د'], tag: 'JavaScript' };
const RESULT = (over: Partial<SpecialtyTestResult> = {}): SpecialtyTestResult => ({ score: 73.3, passed: true, headline: 'اجتزت الاختبار', subline: 'وصف', stats: [{ label: 'الإجابات الصحيحة', value: '11 / 15', tone: 'teal' }], primaryLabel: 'العودة', ...over });

describe('ws-specialty-test (the shared test screen)', () => {
	let f: ComponentFixture<SpecialtyTestComponent>;
	const set = (inputs: Record<string, unknown>) => { for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v); f.detectChanges(); };
	const el = () => f.nativeElement as HTMLElement;
	const q = (id: string) => el().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

	beforeEach(() => { TestBed.configureTestingModule({ imports: [SpecialtyTestComponent] }); f = TestBed.createComponent(SpecialtyTestComponent); });

	it('the 15-question test: counts and limits are 15 / 15 minutes / 25% and match the setup service', () => {
		expect([SPECIALTY_TEST_QUESTION_COUNT, SPECIALTY_TEST_TIME_LIMIT_MINUTES, SPECIALTY_TEST_PASS_SCORE]).toEqual([15, 15, 25]);
		expect(SETUP_TEST_QUESTION_COUNT).toBe(SPECIALTY_TEST_QUESTION_COUNT);
		expect(SETUP_TEST_TIME_LIMIT_MINUTES).toBe(SPECIALTY_TEST_TIME_LIMIT_MINUTES);
	});

	it('active: progress "answered / total", the timer, the question card with 4 options and the "N of 15" tag', () => {
		set({ phase: 'active', question: Q, index: 2, total: 15, answeredCount: 2, timeLabel: '14:30' });
		expect(q('specialty-test-progress')!.textContent!.trim()).toBe('2 / 15');
		expect(q('specialty-test-timer')!.textContent).toBe('14:30');
		expect(q('specialty-test-question')!.textContent).toContain('Closure');
		expect(el().querySelectorAll('[data-testid="specialty-test-option"]').length).toBe(4);
		expect(el().querySelector('.q-num')!.textContent).toContain('السؤال 3');
		expect(el().textContent).toContain('من 15');
		expect(el().querySelector('.timer-wrap')!.classList.contains('critical')).toBe(false);
		set({ timerCritical: true });
		expect(el().querySelector('.timer-wrap')!.classList.contains('critical')).toBe(true);
	});

	it('clicking (or Enter on) an option emits its index; the selected option is highlighted', () => {
		const onAnswer = vi.fn(); f.componentInstance.answer.subscribe(onAnswer);
		set({ phase: 'active', question: Q, index: 0, total: 15, selectedIndex: 1 });
		const opts = Array.from(el().querySelectorAll('[data-testid="specialty-test-option"]')) as HTMLElement[];
		expect(opts.map(o => o.classList.contains('selected'))).toEqual([false, true, false, false]);
		opts[2].click();
		opts[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
		expect(onAnswer.mock.calls.map(c => c[0])).toEqual([2, 3]);
	});

	it('forward-only mode (setup test): answering moves on, so there is NO previous / next / finish button', () => {
		set({ phase: 'active', question: Q, index: 0, total: 15, allowReview: false });
		expect(q('specialty-test-nav')).toBeNull();
	});

	it('review mode (later test): previous is disabled on the first question, next on the middle ones, finish only on the last (disabled while streaming)', () => {
		const events: string[] = [];
		f.componentInstance.prev.subscribe(() => events.push('prev')); f.componentInstance.next.subscribe(() => events.push('next')); f.componentInstance.finish.subscribe(() => events.push('finish'));
		set({ phase: 'active', question: Q, index: 0, total: 15, allowReview: true, finishLabel: 'تسليم الاختبار النهائي' });
		expect((q('specialty-test-prev') as HTMLButtonElement).disabled).toBe(true);
		q('specialty-test-next')!.click();
		expect(q('specialty-test-finish')).toBeNull();
		set({ index: 7 });
		q('specialty-test-prev')!.click();
		set({ index: 14, finishDisabled: true });
		expect(q('specialty-test-next')).toBeNull();
		expect((q('specialty-test-finish') as HTMLButtonElement).disabled).toBe(true);
		set({ finishDisabled: false });
		q('specialty-test-finish')!.click();
		expect(events).toEqual(['next', 'prev', 'finish']);
		expect(q('specialty-test-finish')!.textContent).toContain('تسليم الاختبار النهائي');
	});

	it('streaming banner shows "n / total" while the remaining questions arrive', () => {
		set({ phase: 'active', question: Q, index: 0, total: 15, streaming: { message: 'يتم توليد باقي الأسئلة', count: 6, total: 15 } });
		expect(q('specialty-test-streaming')!.textContent).toContain('6 / 15');
	});

	it('generating and submitting states', () => {
		set({ phase: 'generating', statusTitle: 'التقييم قيد التوليد…' });
		expect(q('specialty-test-generating')!.textContent).toContain('التقييم قيد التوليد');
		set({ phase: 'submitting' });
		expect(q('specialty-test-submitting')!.textContent).toContain('جاري معالجة الإجابات');
	});

	it('error: a retryable one offers "إعادة المحاولة", a final one only the way back', () => {
		const ev: string[] = []; f.componentInstance.retry.subscribe(() => ev.push('retry')); f.componentInstance.back.subscribe(() => ev.push('back'));
		set({ phase: 'error', errorMessage: 'تعذر التوليد', errorRetryable: true });
		expect(q('specialty-test-error')!.textContent).toContain('تعذر التوليد');
		expect(q('specialty-test-back')).toBeNull();
		q('specialty-test-retry')!.click();
		set({ errorRetryable: false, backLabel: 'العودة إلى لوحة التخصصات' });
		expect(q('specialty-test-retry')).toBeNull();
		q('specialty-test-back')!.click();
		expect(ev).toEqual(['retry', 'back']);
	});

	it('result: score, headline, subline, stats, AI feedback and the one button; failing result is styled as failed; no button when primaryLabel is null', () => {
		const onPrimary = vi.fn(); f.componentInstance.primary.subscribe(onPrimary);
		set({ phase: 'result', result: RESULT({ feedback: 'ملاحظات', strengths: ['قوة'], weaknesses: ['ضعف'] }) });
		expect(q('specialty-test-headline')!.textContent).toBe('اجتزت الاختبار');
		expect(el().querySelector('.result-score-num')!.textContent).toContain('73.3%');
		expect(el().textContent).toContain('الإجابات الصحيحة');
		expect(q('specialty-test-feedback')!.textContent).toContain('قوة');
		q('specialty-test-primary')!.click();
		expect(onPrimary).toHaveBeenCalledTimes(1);
		expect(el().querySelector('.result-score-circle')!.classList.contains('failed')).toBe(false);
		set({ result: RESULT({ passed: false, primaryLabel: null, feedback: null }) });
		expect(el().querySelector('.result-score-circle')!.classList.contains('failed')).toBe(true);
		expect(q('specialty-test-primary')).toBeNull();
	});

	it('a passed result never says "معتمد" by itself (the screen only shows what the host passes)', () => {
		set({ phase: 'result', result: RESULT() });
		expect(el().textContent).not.toContain('معتمد');
	});
});

describe('one specialty test UI: both flows use the shared component, the old second UI is gone', () => {
	const APP = join(__dirname, '../..');
	const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
	const P = 'pages/dashboard/provider-overview/profile/';

	it('the setup (registration) test and the later specialty test both render <ws-specialty-test>', () => {
		expect(read(P + 'profile-setup/profile-setup.html')).toContain('<ws-specialty-test');
		expect(read(P + 'specialties/specialties.html')).toContain('<ws-specialty-test');
		expect(read(P + 'profile-setup/profile-setup.ts')).toContain('SpecialtyTestComponent');
		expect(read(P + 'specialties/specialties.ts')).toContain('SpecialtyTestComponent');
	});

	it('neither page keeps its own question card / options / timer / progress markup', () => {
		for (const file of [P + 'profile-setup/profile-setup.html', P + 'specialties/specialties.html']) {
			const html = read(file);
			for (const old of ['class="question-card"', 'class="q-option"', 'class="test-header"', 'class="timer-wrap"', 'class="result-score-circle"', 'سؤال رقم', 'تسليم الاختبار النهائي" ', 'QUESTION PAGINATION GRID', 'LIVE SOCKET QUESTION STREAMING BANNER']) expect(html, `${file}: ${old}`).not.toContain(old);
		}
		const css = read(P + 'profile-setup/profile-setup.css');
		expect(css).not.toMatch(/^\.question-card\{/m);
		expect(css).not.toMatch(/^\.q-option\{/m);
		expect(read('shared/specialty-test/specialty-test.component.css')).toContain('.question-card');
	});

	it('no copy anywhere says the test has 20 questions, and the pre-start copy comes from the shared constants', () => {
		for (const file of [P + 'specialties/specialties.html', P + 'specialties/specialties.ts', P + 'profile-setup/profile-setup.html', P + 'profile-setup/profile-setup.ts', 'shared/specialty-test/specialty-test.component.ts']) {
			expect(read(file), file).not.toMatch(/\b20 سؤال/);
		}
		expect(read(P + 'specialties/specialties.html')).toContain('{{ testQuestionCount }}');
	});

	it('the later test passes allowReview (it submits all answers at the end); the setup test is forward-only', () => {
		expect(read(P + 'specialties/specialties.html')).toContain('[allowReview]="true"');
		expect(read(P + 'profile-setup/profile-setup.html')).toContain('[allowReview]="false"');
	});

	it('the wizard no longer promises things the test does not do (auto-save, pause, 30-day anti-cheat ban)', () => {
		const html = read(P + 'profile-setup/profile-setup.html');
		for (const claim of ['التقدم محفوظ تلقائيًا', 'إيقاف مؤقت']) expect(html).not.toContain(claim);
	});

	it('the no-fake-approval guard also covers the shared test component', () => {
		const spec = read('assessment-no-fake-approval.static.spec.ts');
		expect(spec).toContain('specialty-test.component');
	});
});
