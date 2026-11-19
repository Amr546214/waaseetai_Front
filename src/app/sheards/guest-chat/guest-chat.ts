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
				<div class="ws-gc-msg ws-gc-msg--bot" data-testid="guest-chat-hello">{{ c().hello }}</div>
				@for (m of messages(); track $index) {
					<div class="ws-gc-msg" [class.ws-gc-msg--me]="m.role === 'user'" [class.ws-gc-msg--bot]="m.role === 'assistant'" dir="auto">
						{{ m.text }}
						@if (m.loginRequired) { <a class="ws-gc-login" routerLink="/auth/login" (click)="loginClicked.emit()" data-testid="guest-chat-login">{{ c().login }}</a> }
					</div>
				}
				@if (busy()) { <div class="ws-gc-msg ws-gc-msg--bot ws-gc-typing" data-testid="guest-chat-typing">{{ c().thinking }}</div> }
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
		:host { display: block; }
		.ws-gc { display: flex; flex-direction: column; gap: 10px; padding: 6px 2px; color: #eaf2f5; }
		.ws-gc-log { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; padding: 2px; }
		.ws-gc-msg { max-width: 92%; padding: 9px 12px; border-radius: 14px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
		.ws-gc-msg--bot { align-self: flex-start; background: #1a2b36; color: #eaf2f5; border: 1px solid #2a4350; }
		.ws-gc-msg--me { align-self: flex-end; background: #4c2fa3; color: #fff; }
		.ws-gc-typing { opacity: .7; }
		.ws-gc-login { display: inline-block; margin-top: 8px; padding: 7px 16px; border-radius: 999px; background: linear-gradient(135deg, #2bd4c7, #2b7fff); color: #070d24; font-weight: 800; text-decoration: none; }
		.ws-gc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
		.ws-gc-chip { border: 1px solid #2f4b5a; background: transparent; color: #cfe3ea; border-radius: 999px; padding: 5px 12px; font: inherit; font-size: 13px; cursor: pointer; }
		.ws-gc-chip:hover, .ws-gc-chip:focus-visible { background: rgba(255, 255, 255, .08); }
		.ws-gc-form { display: flex; gap: 6px; }
		.ws-gc-input { flex: 1; min-width: 0; padding: 9px 12px; border-radius: 12px; border: 1px solid #2f4b5a; background: #0f1b24; color: #eaf2f5; font: inherit; font-size: 14px; }
		.ws-gc-send { padding: 8px 14px; border-radius: 12px; border: 0; background: #7c3aed; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
		.ws-gc-send:disabled { opacity: .5; cursor: not-allowed; }
		.ws-gc-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; opacity: .85; }
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
