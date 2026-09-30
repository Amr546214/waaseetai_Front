import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AiAssistantComponent } from './ai-assistant';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../../../../core/services/help-assistant-socket.service';

// The client AI-assistant page now renders the ONE shared Help assistant
// (AssistantStore). The transport is faked — no socket, no network.

describe('AiAssistantComponent (client page → shared real assistant)', () => {
	let fixture: ComponentFixture<AiAssistantComponent>;
	const events = new Subject<HelpStreamEvent>();
	const socket = { events$: events.asObservable(), ask: vi.fn(() => 'p-1'), cancel: vi.fn() };

	beforeEach(async () => {
		socket.ask.mockClear();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
		await TestBed.configureTestingModule({
			imports: [AiAssistantComponent],
			providers: [provideRouter([]), { provide: HelpAssistantSocketService, useValue: socket }],
		}).compileComponents();
		fixture = TestBed.createComponent(AiAssistantComponent);
		fixture.detectChanges();
	});

	afterEach(() => vi.unstubAllGlobals());

	it('renders the shared assistant chat with no fabricated placeholder answer', () => {
		const root = fixture.nativeElement as HTMLElement;
		expect(root.querySelector('app-assistant-chat')).toBeTruthy();
		expect(root.textContent).not.toContain('قيد التطوير');
		expect(root.querySelectorAll('.ac__bubble').length).toBe(0);
	});

	it('sending from the page goes through the real help transport and streams the answer in', () => {
		const root = fixture.nativeElement as HTMLElement;
		const textarea = root.querySelector('textarea') as HTMLTextAreaElement;
		textarea.value = 'كيف يعمل حساب الضمان؟';
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		(root.querySelector('.ac__btn') as HTMLButtonElement).click();
		expect(socket.ask).toHaveBeenCalledWith('كيف يعمل حساب الضمان؟', []);

		events.next({ type: 'chunk', clientRequestId: 'p-1', chunk: 'إجابة حقيقية' });
		events.next({ type: 'complete', clientRequestId: 'p-1' });
		fixture.detectChanges();
		expect(root.textContent).toContain('إجابة حقيقية');
	});
});
