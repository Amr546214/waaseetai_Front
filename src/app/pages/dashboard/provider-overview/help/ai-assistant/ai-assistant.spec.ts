import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { ProviderAiAssistantComponent } from './ai-assistant';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../../../../core/services/help-assistant-socket.service';
import { AssistantStore } from '../../../../../core/store/assistant.store';
import { SECURE_CONTEXT, SPEECH_RECOGNITION } from '../../../../../core/services/speech-recognition';

// The provider AI-assistant page renders the ONE shared Help assistant
// (AssistantStore) — including its microphone / voice controls and local
// Bebo commands. Transport and SpeechRecognition are faked.

class FakeRecognition {
	static last: FakeRecognition | null = null;
	lang = ''; continuous = true; interimResults = false; maxAlternatives = 0;
	onstart: any = null; onresult: any = null; onerror: any = null; onend: any = null;
	aborted = false;
	constructor() { FakeRecognition.last = this; }
	start() {}
	stop() { this.onend?.(); }
	abort() { this.aborted = true; }
}

describe('ProviderAiAssistantComponent (provider page → shared real assistant)', () => {
	let fixture: ComponentFixture<ProviderAiAssistantComponent>;
	const events = new Subject<HelpStreamEvent>();
	const socket = { events$: events.asObservable(), ask: vi.fn(() => 'pv-1'), cancel: vi.fn(), disconnect: vi.fn() };

	beforeEach(async () => {
		socket.ask.mockClear();
		FakeRecognition.last = null;
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
		await TestBed.configureTestingModule({
			imports: [ProviderAiAssistantComponent],
			providers: [
				provideRouter([]),
				{ provide: HelpAssistantSocketService, useValue: socket },
				{ provide: SPEECH_RECOGNITION, useValue: FakeRecognition },
				{ provide: SECURE_CONTEXT, useValue: () => true },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(ProviderAiAssistantComponent);
		fixture.detectChanges();
	});

	afterEach(() => vi.unstubAllGlobals());

	const root = () => fixture.nativeElement as HTMLElement;

	it('renders the shared assistant chat (with mic + dialect controls), no fabricated answer, human-support link', () => {
		expect(root().querySelector('app-assistant-chat')).toBeTruthy();
		expect(root().querySelector('.ac__mic')).toBeTruthy();
		expect(root().querySelector('.ac__dialect')).toBeTruthy();
		expect(root().querySelectorAll('.ac__bubble').length).toBe(0);
		expect(root().querySelector('a[href="/provider-overview/help/live-support"]')).toBeTruthy();
	});

	it('a typed question goes through the real help transport and streams the answer in', () => {
		const textarea = root().querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = 'كيف أقدّم عرضاً؟';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		(root().querySelector('.ac__btn') as HTMLButtonElement).click();
		expect(socket.ask).toHaveBeenCalledWith('كيف أقدّم عرضاً؟', []);
		events.next({ type: 'chunk', clientRequestId: 'pv-1', chunk: 'إجابة حقيقية' });
		events.next({ type: 'complete', clientRequestId: 'pv-1' });
		fixture.detectChanges();
		expect(root().textContent).toContain('إجابة حقيقية');
	});

	it('a spoken question from the page mic uses the same shared flow', () => {
		(root().querySelector('.ac__mic') as HTMLButtonElement).click();
		expect(TestBed.inject(AssistantStore).state()).toBe('listening');
		FakeRecognition.last!.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'متى أستلم أرباحي' }], { isFinal: true })] });
		(root().querySelector('.ac__mic') as HTMLButtonElement).click();
		expect(socket.ask).toHaveBeenCalledWith('متى أستلم أرباحي', []);
	});

	it('leaving the page while listening stops the microphone', () => {
		(root().querySelector('.ac__mic') as HTMLButtonElement).click();
		const rec = FakeRecognition.last!;
		fixture.destroy();
		expect(rec.aborted).toBe(true);
		expect(TestBed.inject(AssistantStore).state()).toBe('idle');
	});
});
