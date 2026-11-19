import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicAssistantService, PublicTurn } from '../../core/services/public-assistant.service';

interface GuestMessage { role: 'user' | 'assistant'; text: string; loginRequired?: boolean }
const MAX = 400;

const COPY = {
	ar: {
		hello: 'أهلًا بك! أنا وسيط AI. اسألني عن المنصة: من نحن، وماذا نفعل، وما هدفنا، وما الذي يميزنا، وكيف تبدأ.',
		chips: ['من هي وسيط AI؟', 'ما الذي يميّزكم؟', 'كيف أبدأ؟', 'كيف يحمي الضمان حقوقي؟'],
		placeholder: 'اسأل عن وسيط AI...', send: 'إرسال', thinking: 'جاري الكتابة...', login: 'تسجيل الدخول', foot: 'للأسئلة التفصيلية داخل المنصة سجّل دخولك.',
		failed: 'تعذّر الرد الآن، حاول مرة أخرى.', counter: 'عدد الأحرف'
	},
	en: {
		hello: "Hi! I'm Waseet AI. Ask me about the platform: who we are, what we do, our goal, what sets us apart, and how to start.",
		chips: ['Who is Waseet AI?', 'What sets you apart?', 'How do I start?', 'How does the escrow protect me?'],
		placeholder: 'Ask about Waseet AI...', send: 'Send', thinking: 'Typing...', login: 'Sign in', foot: 'For detailed questions inside the platform, sign in.',
		failed: "Couldn't answer right now, please try again.", counter: 'characters'
	}
} as const;

/**
 * The signed-out assistant panel: a small chat that answers questions about the platform itself. A technical / in-platform question is answered with a
 * sign-in message and a sign-in button (the server decides; its text is fixed). Nothing here uses an account, a socket or voice.
 */
@Component({
	selector: 'app-guest-chat',
	standalone: true,
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="ws-gc" data-ws-theme-owned data-testid="guest-chat" [attr.dir]="english() ? 'ltr' : 'rtl'">
			<div class="ws-gc-log" #log role="log" aria-live="polite" data-testid="guest-chat-log">
				<div class="ws-gc-row"><div class="ws-gc-msg ws-gc-msg--bot" data-testid="guest-chat-hello"><span class="ws-gc-ai" aria-hidden="true"><svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/></svg></span>{{ c().hello }}</div></div>
				@for (m of messages(); track $index) {
					<div class="ws-gc-row" [class.ws-gc-row--me]="m.role === 'user'"><div class="ws-gc-msg" [class.ws-gc-msg--me]="m.role === 'user'" [class.ws-gc-msg--bot]="m.role === 'assistant'" dir="auto">
						@if (m.role === 'assistant') { <span class="ws-gc-ai" aria-hidden="true"><svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/></svg></span> }{{ m.text }}
						@if (m.loginRequired) { <a class="ws-gc-login" routerLink="/auth/login" (click)="loginClicked.emit()" data-testid="guest-chat-login">{{ c().login }}</a> }
					</div></div>
				}
				@if (busy()) { <div class="ws-gc-row"><div class="ws-gc-msg ws-gc-msg--bot ws-gc-typing" data-testid="guest-chat-typing"><span class="ws-gc-ai" aria-hidden="true"><svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/></svg></span>{{ c().thinking }}</div></div> }
			</div>
			@if (!messages().length && !busy()) {
				<div class="ws-gc-chips">
					@for (chip of c().chips; track chip) { <button type="button" class="ws-gc-chip" (click)="send(chip)">{{ chip }}</button> }
				</div>
			}
			<form class="ws-gc-form" (submit)="$event.preventDefault(); send(draft())">
				<input class="ws-gc-input" name="q" [value]="draft()" (input)="draft.set($any($event.target).value)" [attr.maxlength]="max" [placeholder]="c().placeholder" [disabled]="busy()" autocomplete="off" data-testid="guest-chat-input" />
				<button type="submit" class="ws-gc-send" [disabled]="busy() || !draft().trim()" data-testid="guest-chat-send">{{ c().send }}</button>
			</form>
			<div class="ws-gc-foot">
				<span>{{ c().foot }}</span>
				<a class="aw__login ws-gc-foot-login" routerLink="/auth/login" (click)="loginClicked.emit()">{{ c().login }}</a>
			</div>
		</div>
	`,
	styles: [`
		/* the assistant's own look (same values as the signed-in chat): purple = AI, brand gradient for the plain actions */
		:host { display: block; }
		.ws-gc { display: flex; flex-direction: column; gap: 10px; padding: 6px 2px; color: var(--txt, #E2E8F0); }
		.ws-gc-log { display: flex; flex-direction: column; gap: 12px; max-height: 220px; overflow-y: auto; padding: 4px 2px; }
		.ws-gc-row { display: flex; flex-direction: column; align-items: flex-start; }
		.ws-gc-row--me { align-items: flex-end; }
		.ws-gc-msg { max-width: 92%; border-radius: 16px; padding: 11px 14px; font-size: var(--font-size-label, 14px); line-height: 1.75; white-space: pre-wrap; word-break: break-word; }
		.ws-gc-msg--bot { background: rgba(255, 255, 255, .05); border: 1px solid rgba(165, 107, 224, .22); color: var(--txt, #E2E8F0); border-bottom-right-radius: 4px; box-shadow: 0 4px 14px rgba(0, 0, 0, .15); }
		.ws-gc-msg--me { background: linear-gradient(135deg, #7B2FBE, #9333EA); color: #fff; border-bottom-left-radius: 4px; box-shadow: 0 4px 12px rgba(123, 47, 190, .25); }
		.ws-gc-ai { display: inline-flex; vertical-align: -3px; margin-inline-end: 6px; color: #A56BE0; }
		.ws-gc-typing { opacity: .75; }
		.ws-gc-login { display: inline-block; margin-top: 8px; padding: 7px 16px; border-radius: 999px; background: linear-gradient(135deg, #2BD4C7, #2B7FFF); color: #070D24; font-weight: 800; text-decoration: none; }
		.ws-gc-chips { display: flex; flex-wrap: wrap; gap: 8px; }
		.ws-gc-chip { padding: 7px 13px; border-radius: 999px; border: 1px solid rgba(165, 107, 224, .4); background: rgba(123, 47, 190, .1); color: var(--txt, #fff); font: inherit; font-size: var(--font-size-label, 14px); font-weight: 700; cursor: pointer; }
		.ws-gc-chip:hover, .ws-gc-chip:focus-visible { background: rgba(123, 47, 190, .22); }
		.ws-gc-form { display: flex; align-items: center; gap: 8px; }
		.ws-gc-input { flex: 1; min-width: 0; border-radius: 12px; border: 1px solid var(--sec-bd, rgba(255, 255, 255, .12)); background: transparent; color: var(--txt, #fff); padding: 9px 12px; font: inherit; font-size: var(--font-size-label, 14px); outline: none; }
		.ws-gc-input:focus { border-color: #A56BE0; }
		.ws-gc-send { flex-shrink: 0; padding: 9px 18px; border-radius: 999px; border: 0; background: linear-gradient(135deg, #7B2FBE, #A56BE0); color: #fff; font: inherit; font-size: var(--font-size-label, 14px); font-weight: 800; cursor: pointer; }
		.ws-gc-send:disabled { opacity: .4; cursor: not-allowed; }
		.ws-gc-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: var(--font-size-small, 12px); color: var(--txt-3, #8892B0); }
		.ws-gc-foot-login { padding: 5px 12px !important; font-size: 12px !important; white-space: nowrap; }
	`],
})
export class GuestChatComponent {
	private readonly api = inject(PublicAssistantService);
	private readonly log = viewChild<ElementRef<HTMLElement>>('log');
	/** the assistant's language (the Bebo dialect setting): English replies and an English panel when true */
	readonly english = input(false);
	readonly loginClicked = output<void>();

	readonly max = MAX;
	readonly draft = signal('');
	readonly messages = signal<GuestMessage[]>([]);
	readonly busy = signal(false);
	readonly c = computed(() => (this.english() ? COPY.en : COPY.ar));

	send(raw: string): void {
		const question = raw.trim().slice(0, MAX);
		if (!question || this.busy()) return;
		const history: PublicTurn[] = this.messages().filter(m => !m.loginRequired).slice(-4).map(m => ({ role: m.role, content: m.text.slice(0, 500) }));
		this.messages.update(list => [...list, { role: 'user', text: question }]);
		this.draft.set('');
		this.busy.set(true);
		this.scroll();
		this.api.ask(question, this.english() ? 'en' : 'ar', history).subscribe({
			next: res => { this.busy.set(false); this.messages.update(list => [...list, { role: 'assistant', text: res.answer, loginRequired: res.loginRequired }]); this.scroll(); },
			error: () => { this.busy.set(false); this.messages.update(list => [...list, { role: 'assistant', text: this.c().failed }]); this.scroll(); }
		});
	}

	/** after the new message is rendered (a microtask is too early: the last message, with its sign-in button, stayed below the fold) */
	private scroll(): void { setTimeout(() => { const el = this.log()?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }, 30); }
}
