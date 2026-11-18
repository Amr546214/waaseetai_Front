import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { GuestChatComponent } from './guest-chat';
import { PublicAssistantService, PublicAnswer } from '../../core/services/public-assistant.service';

describe('GuestChatComponent', () => {
	let ask: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		ask = vi.fn(() => of({ kind: 'ANSWER', answer: 'وسيط AI منصة تربط طالبي الخدمات بمقدميها.', loginRequired: false } as PublicAnswer));
		TestBed.configureTestingModule({ imports: [GuestChatComponent], providers: [provideRouter([]), { provide: PublicAssistantService, useValue: { ask } }] });
	});
	const make = (english = false) => { const f = TestBed.createComponent(GuestChatComponent); f.componentRef.setInput('english', english); f.detectChanges(); return f; };
	const q = (f: any, sel: string) => f.nativeElement.querySelector(sel) as HTMLElement | null;
	const type = (f: any, value: string) => { const i = q(f, '[data-testid=guest-chat-input]') as HTMLInputElement; i.value = value; i.dispatchEvent(new Event('input')); f.detectChanges(); };

	it('greets, offers suggestion chips, and nothing is asked until the visitor asks', () => {
		const f = make(); expect(q(f, '[data-testid=guest-chat-hello]')!.textContent).toContain('اسألني عن وسيط AI');
		expect(f.nativeElement.querySelectorAll('.ws-gc-chip').length).toBe(4); expect(ask).not.toHaveBeenCalled();
	});
	it('a chip asks that question (with no history yet); the answer is shown; the chips go away', () => {
		const f = make(); (f.nativeElement.querySelector('.ws-gc-chip') as HTMLButtonElement).click(); f.detectChanges();
		expect(ask).toHaveBeenCalledWith('من هي وسيط AI؟', 'ar', []);
		expect(f.nativeElement.textContent).toContain('منصة تربط طالبي الخدمات'); expect(f.nativeElement.querySelectorAll('.ws-gc-chip').length).toBe(0);
	});
	it('typing and sending asks, clears the box, sends only the last turns as history, and caps the question at 400 chars', () => {
		const f = make(); type(f, 'x'.repeat(450)); (q(f, '[data-testid=guest-chat-send]') as HTMLButtonElement).click(); f.detectChanges();
		expect((ask.mock.calls[0][0] as string).length).toBe(400);
		expect((q(f, '[data-testid=guest-chat-input]') as HTMLInputElement).value).toBe('');
		for (let i = 0; i < 4; i++) { type(f, `سؤال ${i}`); (q(f, '[data-testid=guest-chat-send]') as HTMLButtonElement).click(); f.detectChanges(); }
		expect((ask.mock.calls.at(-1)![2] as unknown[]).length).toBeLessThanOrEqual(4);
	});
	it('a sign-in-required answer shows the message AND a sign-in button; it is not sent back as history', () => {
		ask.mockReturnValueOnce(of({ kind: 'LOGIN_REQUIRED', answer: 'هذا السؤال عن تفاصيل تقنية... سجّل دخولك', loginRequired: true }));
		const f = make(); type(f, 'كيف أضبط API؟'); (q(f, '[data-testid=guest-chat-send]') as HTMLButtonElement).click(); f.detectChanges();
		const login = q(f, '[data-testid=guest-chat-login]') as HTMLAnchorElement;
		expect(login).toBeTruthy(); expect(login.getAttribute('href')).toBe('/auth/login');
		type(f, 'مين وسيط؟'); (q(f, '[data-testid=guest-chat-send]') as HTMLButtonElement).click(); f.detectChanges();
		expect((ask.mock.calls[1][2] as Array<{ role: string }>).map(t => t.role)).toEqual(['user']);
	});
	it('shows a typing state while waiting and blocks a second question; a failed request shows a polite error', () => {
		const pending = new Subject<PublicAnswer>(); ask.mockReturnValueOnce(pending);
		const f = make(); type(f, 'مين وسيط؟'); (q(f, '[data-testid=guest-chat-send]') as HTMLButtonElement).click(); f.detectChanges();
		expect(q(f, '[data-testid=guest-chat-typing]')).toBeTruthy(); expect((q(f, '[data-testid=guest-chat-input]') as HTMLInputElement).disabled).toBe(true);
		pending.error(new Error('x')); f.detectChanges();
		expect(f.nativeElement.textContent).toContain('تعذّر الرد الآن'); expect(q(f, '[data-testid=guest-chat-typing]')).toBeNull();
	});
	it('English mode: English greeting, chips, language sent as en, left-to-right', () => {
		const f = make(true);
		expect(q(f, '[data-testid=guest-chat-hello]')!.textContent).toContain('Ask me about Waseet AI'); expect(q(f, '.ws-gc')!.getAttribute('dir')).toBe('ltr');
		(f.nativeElement.querySelector('.ws-gc-chip') as HTMLButtonElement).click(); expect(ask).toHaveBeenCalledWith('Who is Waseet AI?', 'en', []);
	});
	it('the footer always offers sign-in (for in-platform questions)', () => {
		const f = make(); const link = q(f, '.ws-gc-foot-login') as HTMLAnchorElement; expect(link.getAttribute('href')).toBe('/auth/login');
	});
});
