import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssistantStore, MAX_QUESTION_LENGTH } from '../../core/store/assistant.store';
import { BEBO_DIALECTS, BEBO_DIALECT_IDS, BEBO_VOICES } from '../bebo-avatar/bebo-commands';

// Conversation UI for the ONE real Help assistant (AssistantStore). Rendered
// by the floating dashboard Avatar panel and by the client/provider help
// "AI assistant" pages, so they all show the same real conversation.

@Component({
	selector: 'app-assistant-chat',
	standalone: true,
	imports: [FormsModule, RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<div class="ac" [class.ac--compact]="compact()">
		<div #scroller class="ac__log" role="log" aria-live="polite" [attr.aria-busy]="store.busy()">
			@if (store.messages().length === 0) {
				<div class="ac__empty">اكتب سؤالك عن كيفية عمل المنصة، مثال: "كيف يعمل حساب الضمان؟"</div>
			}
			@for (m of store.messages(); track $index) {
				<div class="ac__row" [class.ac__row--user]="m.role === 'user'">
					<div class="ac__bubble" [class.ac__bubble--user]="m.role === 'user'" [class.ac__bubble--ai]="m.role === 'assistant'" dir="auto">
						{{ m.text }}@if (m.streaming) {<span class="ac__cursor" aria-hidden="true"></span>}
					</div>
					@if (m.citations?.length) {
						<div class="ac__cites">
							<span>المصادر:</span>
							@for (c of m.citations; track c.docId + c.title) {
								<span class="ac__cite">{{ c.title }}</span>
							}
						</div>
					}
				</div>
			}
			@if (store.busy() && !store.streaming()) {
				<div class="ac__row">
					<div class="ac__bubble ac__bubble--ai ac__typing" aria-label="المساعد يفكر"><span></span><span></span><span></span></div>
				</div>
			}
		</div>

		@if (store.errorMessage()) {
			<div class="ac__error" role="alert">
				<span>{{ store.errorMessage() }}</span>
				<div class="ac__error-actions">
					@if (store.lastQuestion()) {
						<button type="button" (click)="store.retry()">إعادة المحاولة</button>
					}
					@if (store.humanSupportFallback() && store.supportRoute()) {
						<a [routerLink]="store.supportRoute()">التواصل مع الدعم البشري</a>
					}
				</div>
			</div>
		}
		@if (store.voiceNotice()) {
			<div class="ac__notice">{{ store.voiceNotice() }}</div>
		}
		@if (store.commandReply()) {
			<div class="ac__notice ac__bebo" role="status" dir="auto">بيبو: {{ store.commandReply() }}</div>
		}
		@if (store.micActive()) {
			<div class="ac__notice ac__listening" role="status" dir="auto">بسمعك… {{ store.transcript() }}</div>
		}
		@if (store.micNotice()) {
			<div class="ac__notice ac__mic-notice" role="status">{{ store.micNotice() }}</div>
		}

		<div class="ac__input">
			<button
				type="button"
				class="ac__mic"
				(click)="store.toggleListening()"
				[disabled]="store.busy()"
				[attr.aria-pressed]="store.micActive()"
				[attr.aria-label]="store.micActive() ? 'إنهاء التسجيل وإرسال سؤالك' : 'تحدث بسؤالك'"
				[title]="store.micSupported ? '' : 'الإملاء الصوتي غير متاح هنا؛ جرّب Chrome أو Edge.'"
			>
				<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
			</button>
			<textarea
				[(ngModel)]="draft"
				(keydown.enter)="onEnter($event)"
				[disabled]="store.busy()"
				[maxlength]="maxLength"
				rows="1"
				dir="auto"
				aria-label="سؤالك للمساعد الذكي"
				placeholder="اكتب سؤالك هنا..."
			></textarea>
			@if (store.busy()) {
				<button type="button" class="ac__btn ac__btn--ghost" (click)="store.cancel()">إيقاف</button>
			} @else {
				<button type="button" class="ac__btn" (click)="send()" [disabled]="!draft.trim()">إرسال</button>
			}
		</div>
		<div class="ac__meta">
			<label class="ac__voice">
				<input type="checkbox" [checked]="store.voiceEnabled()" (change)="onVoiceToggle($event)" />
				قراءة الرد صوتياً (صوت مُولَّد آلياً)
			</label>
			@if (store.state() === 'speaking' || store.audioLoading()) {
				<button type="button" class="ac__link ac__stop-audio" (click)="store.stopAudio()">إيقاف الصوت</button>
			} @else if (store.canReplay()) {
				<button type="button" class="ac__link ac__replay" (click)="store.replay()">إعادة الاستماع</button>
			}
			<span>{{ draft.length }}/{{ maxLength }}</span>
		</div>
		<div class="ac__settings">
			<label>اللهجة
				<select class="ac__dialect" [value]="store.ttsDialect()" (change)="store.setDialect($any($event.target).value)">
					<option value="auto" [selected]="store.ttsDialect() === 'auto'">تلقائي من كلامك</option>
					@for (d of dialects; track d.id) {
						<option [value]="d.id" [selected]="store.ttsDialect() === d.id">{{ d.label }}</option>
					}
				</select>
			</label>
			@if (store.voiceEnabled()) {
				<label>الصوت
					<select class="ac__voice-select" [value]="store.ttsVoice()" (change)="store.setVoice($any($event.target).value)">
						@for (v of voices; track v) {
							<option [value]="v" [selected]="store.ttsVoice() === v">{{ v }}</option>
						}
					</select>
				</label>
			}
		</div>
		<p class="ac__disclaimer">يجيب المساعد من قاعدة معرفة وسيط الموثّقة فقط، وقد يخطئ. القرارات والإجراءات المالية تبقى لديك أو لدى الفريق المختص.</p>
	</div>
	`,
	styles: [`
		:host { display: block; min-height: 0; }
		.ac { display: flex; flex-direction: column; gap: 10px; height: 100%; min-height: 0; }
		.ac__log { flex: 1; min-height: 160px; max-height: 460px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 2px; }
		.ac--compact .ac__log { max-height: none; }
		.ac__empty { margin: auto; text-align: center; font-size: 13px; color: var(--txt-3, #8892B0); padding: 24px 8px; }
		.ac__row { display: flex; flex-direction: column; align-items: flex-start; }
		.ac__row--user { align-items: flex-end; }
		.ac__bubble { max-width: 88%; border-radius: 14px; padding: 9px 13px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
		.ac__bubble--user { background: linear-gradient(135deg, #7B2FBE, #A56BE0); color: #fff; }
		.ac__bubble--ai { background: rgba(123,47,190,.08); border: 1px solid rgba(123,47,190,.2); color: var(--txt, #fff); }
		.ac__cursor { display: inline-block; width: 6px; height: 14px; background: currentColor; vertical-align: middle; margin-inline-start: 2px; animation: ac-blink 1s steps(2) infinite; }
		.ac__typing { display: inline-flex; gap: 5px; align-items: center; }
		.ac__typing span { width: 7px; height: 7px; border-radius: 50%; background: #A56BE0; animation: ac-dot 1.2s infinite; }
		.ac__typing span:nth-child(2) { animation-delay: .2s; }
		.ac__typing span:nth-child(3) { animation-delay: .4s; }
		.ac__cites { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; font-size: 11px; color: var(--txt-3, #8892B0); }
		.ac__cite { padding: 2px 8px; border-radius: 8px; border: 1px solid rgba(123,47,190,.25); }
		.ac__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: 12.5px; color: #FF8C69; background: rgba(255,140,105,.08); border: 1px solid rgba(255,140,105,.25); }
		.ac__error-actions { display: flex; gap: 10px; }
		.ac__error-actions button, .ac__error-actions a, .ac__link { background: none; border: 0; padding: 0; color: inherit; font: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }
		.ac__notice { font-size: 11.5px; color: var(--txt-3, #8892B0); }
		.ac__input { display: flex; align-items: flex-end; gap: 8px; }
		.ac__input textarea { flex: 1; resize: none; min-width: 0; border-radius: 12px; border: 1px solid var(--sec-bd, rgba(255,255,255,.12)); background: transparent; color: var(--txt, #fff); padding: 9px 12px; font: inherit; font-size: 13px; outline: none; }
		.ac__input textarea:focus { border-color: #A56BE0; }
		.ac__btn { flex-shrink: 0; padding: 9px 18px; border-radius: 999px; border: 0; background: linear-gradient(135deg, #7B2FBE, #A56BE0); color: #fff; font: inherit; font-size: 13px; font-weight: 800; cursor: pointer; }
		.ac__btn:disabled { opacity: .4; cursor: not-allowed; }
		.ac__btn--ghost { background: transparent; border: 1px solid rgba(165,107,224,.5); color: #A56BE0; }
		.ac__meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11px; color: var(--txt-3, #8892B0); }
		.ac__voice { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
		.ac__disclaimer { margin: 0; font-size: 10.5px; color: var(--txt-3, #8892B0); }
		.ac__mic { flex-shrink: 0; width: 38px; height: 38px; padding: 8px; border-radius: 50%; border: 1px solid var(--sec-bd, rgba(255,255,255,.12)); background: transparent; color: var(--txt, #fff); cursor: pointer; }
		.ac__mic svg { width: 100%; height: 100%; display: block; }
		.ac__mic[aria-pressed="true"] { color: #ffb1c1; border-color: #ffb1c1; background: rgba(170,52,68,.15); }
		.ac__mic:disabled { opacity: .4; cursor: not-allowed; }
		.ac__settings { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: var(--txt-3, #8892B0); }
		.ac__settings label { display: inline-flex; align-items: center; gap: 6px; }
		.ac__settings select { min-width: 0; padding: 3px 6px; border-radius: 8px; border: 1px solid var(--sec-bd, rgba(255,255,255,.12)); background: transparent; color: var(--txt, #fff); font: inherit; }
		.ac__settings option { color: #000; }
		.ac__listening { color: #ffb1c1; }
		@keyframes ac-blink { 50% { opacity: 0; } }
		@keyframes ac-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
		@media (prefers-reduced-motion: reduce) { .ac__cursor, .ac__typing span { animation: none; } }
	`],
})
export class AssistantChatComponent implements OnDestroy {
	readonly store = inject(AssistantStore);
	/** Compact layout for the floating panel (log fills available height). */
	readonly compact = input(false);
	readonly maxLength = MAX_QUESTION_LENGTH;
	/** Handoff option lists (bebo-core.mjs DIALECTS, bebo-chat.js voices). */
	readonly dialects = BEBO_DIALECT_IDS.map((id) => ({ id, label: BEBO_DIALECTS[id].label }));
	readonly voices = BEBO_VOICES;
	draft = '';

	/** The mic must not keep listening once its UI is gone (panel closed). */
	ngOnDestroy(): void {
		this.store.cancelListening();
	}

	@ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;

	constructor() {
		// Keep the newest text in view while an answer streams in.
		effect(() => {
			this.store.messages();
			queueMicrotask(() => {
				const el = this.scroller?.nativeElement;
				if (el) el.scrollTop = el.scrollHeight;
			});
		});
	}

	onEnter(event: Event): void {
		if ((event as KeyboardEvent).shiftKey) return;
		event.preventDefault();
		this.send();
	}

	send(): void {
		if (this.store.ask(this.draft)) this.draft = '';
	}

	onVoiceToggle(event: Event): void {
		this.store.setVoiceEnabled((event.target as HTMLInputElement).checked);
	}
}
