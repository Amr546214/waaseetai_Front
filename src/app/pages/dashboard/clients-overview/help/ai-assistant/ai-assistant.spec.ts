import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

// Implementation Batch 2, Part A — real Help AI Assistant wiring. The
// socket.io-client module is mocked at the module boundary (same pattern
// as create-request.spec.ts), and handlers registered via `.on()` are
// captured so tests can simulate the backend gateway emitting real events.

const handlers: Record<string, (...args: any[]) => any> = {};
const fakeSocket = {
	on: vi.fn((event: string, cb: (...args: any[]) => any) => { handlers[event] = cb; }),
	off: vi.fn(),
	once: vi.fn(),
	emit: vi.fn(),
	disconnect: vi.fn(),
};
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { AiAssistantComponent } from './ai-assistant';

describe('AiAssistantComponent (real Help AI Assistant)', () => {
	let component: AiAssistantComponent;
	let fixture: ComponentFixture<AiAssistantComponent>;

	beforeEach(async () => {
		fakeSocket.emit.mockClear();
		fakeSocket.disconnect.mockClear();
		for (const key of Object.keys(handlers)) delete handlers[key];

		// This test environment has no global `localStorage` (same
		// pre-existing gap documented in create-request.spec.ts) — the
		// socket service's own token lookup is exercised against a stubbed
		// one rather than skipping the assertion.
		vi.stubGlobal('localStorage', {
			getItem: () => null,
			setItem: () => {},
			clear: () => {},
		});

		await TestBed.configureTestingModule({
			imports: [AiAssistantComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(AiAssistantComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('should create with an empty conversation and no fabricated placeholder message', () => {
		expect(component).toBeTruthy();
		expect(component.messages().length).toBe(0);
		const text = fixture.nativeElement.textContent as string;
		expect(text).not.toContain('قيد التطوير');
		expect(text).not.toContain('واجهة المحادثة الكاملة قيد التطوير');
	});

	it('send() emits the real help:ask socket event with the question', () => {
		component.draft = 'كيف يعمل حساب الضمان؟';
		component.send();

		expect(fakeSocket.emit).toHaveBeenCalledWith('help:ask', { question: 'كيف يعمل حساب الضمان؟', history: [] });
		expect(component.isStreaming()).toBe(true);
		expect(component.messages().length).toBe(1);
		expect(component.messages()[0]).toEqual({ role: 'user', text: 'كيف يعمل حساب الضمان؟' });
	});

	it('does not send an empty/whitespace-only question', () => {
		component.draft = '   ';
		component.send();
		expect(fakeSocket.emit).not.toHaveBeenCalled();
	});

	it('streams real chunks into a single growing assistant bubble, then completes', () => {
		component.draft = 'ما هي عمولة الوسيط؟';
		component.send();

		handlers['help:answer_start']();
		expect(component.messages()[1]).toEqual({ role: 'assistant', text: '', streaming: true });

		handlers['help:answer_chunk']({ chunk: 'العمولة ' });
		handlers['help:answer_chunk']({ chunk: 'تُحسب عند الإفراج.' });
		expect(component.messages()[1].text).toBe('العمولة تُحسب عند الإفراج.');
		expect(component.isStreaming()).toBe(true);

		handlers['help:answer_complete']();
		expect(component.isStreaming()).toBe(false);
		expect(component.messages()[1].streaming).toBe(false);
	});

	it('shows the real honest error message on help:error, and drops the incomplete assistant bubble (no fabricated partial answer)', () => {
		component.draft = 'سؤال لن يُجاب عليه';
		component.send();
		handlers['help:answer_start']();
		handlers['help:answer_chunk']({ chunk: 'جزء ناقص' });

		handlers['help:error']({ message: 'تعذر الحصول على رد من المساعد الذكي حالياً. يمكنك التواصل مع فريق الدعم البشري للمساعدة.', humanSupportFallback: true });

		expect(component.isStreaming()).toBe(false);
		expect(component.errorMessage()).toContain('تعذر الحصول على رد');
		// Only the user's question remains — the half-written assistant bubble is removed.
		expect(component.messages().length).toBe(1);
		expect(component.messages()[0].role).toBe('user');
	});

	it('retry() re-sends the last question without duplicating it in the message list', () => {
		component.draft = 'سؤال يفشل أولاً';
		component.send();
		handlers['help:error']({ message: 'تعذر الحصول على رد', humanSupportFallback: true });
		fakeSocket.emit.mockClear();

		component.retry();

		expect(fakeSocket.emit).toHaveBeenCalledWith('help:ask', { question: 'سؤال يفشل أولاً', history: [] });
		expect(component.messages().filter((m) => m.role === 'user').length).toBe(1);
	});

	it('sends up to the last 3 real question/answer turns as bounded history, never the full transcript unbounded', () => {
		for (let i = 0; i < 4; i++) {
			component.draft = `سؤال ${i}`;
			component.send();
			handlers['help:answer_start']();
			handlers['help:answer_chunk']({ chunk: `إجابة ${i}` });
			handlers['help:answer_complete']();
		}

		fakeSocket.emit.mockClear();
		component.draft = 'سؤال أخير';
		component.send();

		const [, payload] = fakeSocket.emit.mock.calls[0];
		expect(payload.history.length).toBe(3);
		expect(payload.history[0]).toEqual({ question: 'سؤال 1', answer: 'إجابة 1' });
		expect(payload.history[2]).toEqual({ question: 'سؤال 3', answer: 'إجابة 3' });
	});

	it('disconnects the real socket on destroy', () => {
		fixture.destroy();
		expect(fakeSocket.disconnect).toHaveBeenCalled();
	});
});
