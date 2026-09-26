import { Component, ChangeDetectionStrategy, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HelpAssistantSocketService, HelpChatHistoryTurn } from '../../../../../core/services/help-assistant-socket.service';

interface ChatMessage {
	role: 'user' | 'assistant';
	text: string;
	streaming?: boolean;
}

const MAX_QUESTION_LENGTH = 500;

@Component({
	selector: 'app-client-ai-assistant',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	template: `
	<div class="w-full relative z-10 pb-10">
		<!-- Header -->
		<div class="mb-4">
			<h1 class="text-xl font-black text-[var(--txt)] mb-1">المساعد الذكي</h1>
			<p class="text-xs text-[var(--txt-3)]">اسأل عن كيفية عمل المنصة — حساب الضمان، النزاعات، اعتماد التخصصات، والمزيد</p>
		</div>

		<!-- Disclosure -->
		<div class="flex items-center gap-3 p-3.5 bg-gradient-to-br from-[rgba(123,47,190,.09)] to-[rgba(43,127,255,.06)] backdrop-blur-md border border-[rgba(123,47,190,.22)] rounded-2xl mb-5">
			<div class="w-[30px] h-[30px] rounded-lg bg-[rgba(123,47,190,.16)] flex items-center justify-center shrink-0 text-[var(--ai-txt,#7B2FBE)]">
				<svg class="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="12" cy="12" r="2" /><circle cx="4" cy="6" r="1.5" /><circle cx="20" cy="6" r="1.5" />
					<circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="18" r="1.5" /><circle cx="12" cy="3" r="1.5" />
					<circle cx="12" cy="21" r="1.5" />
					<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5" />
				</svg>
			</div>
			<div class="flex-1">
				<div class="text-[10px] font-extrabold text-[var(--ai-txt,#A56BE0)] tracking-wider mb-0.5">وسيط، المساعد الذكي</div>
				<p class="text-[13px] text-[var(--txt-2,#A8B2D1)]">يجيب فقط عن معلومات موثقة عن المنصة. لن تُشارَك بياناتك الحسّاسة، والقرار النهائي والإجراءات المالية تبقى بيدك أو لدى الفريق المختص</p>
			</div>
		</div>

		<!-- Chat -->
		<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 flex flex-col" style="min-height: 420px">
			@if (messages().length === 0) {
				<div class="flex-1 flex flex-col items-center justify-center text-center py-10">
					<div class="w-16 h-16 rounded-2xl bg-[rgba(123,47,190,.10)] border border-[rgba(123,47,190,.22)] flex items-center justify-center mb-4 text-[var(--ai-txt,#A56BE0)]">
						<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
							<circle cx="12" cy="12" r="2" /><circle cx="4" cy="6" r="1.5" /><circle cx="20" cy="6" r="1.5" />
							<circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="18" r="1.5" /><circle cx="12" cy="3" r="1.5" />
							<circle cx="12" cy="21" r="1.5" />
							<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5" />
						</svg>
					</div>
					<div class="text-sm text-[var(--txt-3)]">اكتب سؤالك في الأسفل، مثال: "كيف يعمل حساب الضمان؟"</div>
				</div>
			} @else {
				<div class="flex-1 flex flex-col gap-3 overflow-y-auto" style="max-height: 460px">
					@for (m of messages(); track $index) {
						<div class="flex" [class.justify-end]="m.role === 'user'">
							<div
								class="max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed"
								[class]="m.role === 'user' ? 'bg-gradient-to-br from-[#7B2FBE] to-[#A56BE0] text-white' : 'bg-[rgba(123,47,190,.06)] border border-[rgba(123,47,190,.15)] text-[var(--txt)]'"
							>
								{{ m.text }}@if (m.streaming) {<span class="inline-block w-1.5 h-3.5 bg-current align-middle animate-pulse ms-0.5"></span>}
							</div>
						</div>
					}
				</div>
			}

			@if (errorMessage()) {
				<div class="mt-3 p-3 bg-[rgba(255,140,105,.08)] border border-[rgba(255,140,105,.25)] rounded-xl text-[12.5px] text-[#FF8C69] flex items-center justify-between gap-3 flex-wrap">
					<span>{{ errorMessage() }}</span>
					<div class="flex items-center gap-2 shrink-0">
						@if (lastQuestion()) {
							<button type="button" (click)="retry()" class="text-[12px] font-extrabold underline">إعادة المحاولة</button>
						}
						<a routerLink="/client-overview/help" class="text-[12px] font-extrabold underline">التواصل مع الدعم</a>
					</div>
				</div>
			}

			<!-- Input -->
			<div class="mt-3 flex items-end gap-2">
				<textarea
					[(ngModel)]="draft"
					(keydown.enter)="onEnter($event)"
					[disabled]="isStreaming()"
					[maxlength]="maxQuestionLength"
					rows="1"
					placeholder="اكتب سؤالك هنا..."
					class="flex-1 resize-none rounded-xl border border-[var(--sec-bd,#E7EAF1)] bg-transparent px-3.5 py-2.5 text-[13px] text-[var(--txt)] outline-none focus:border-[#A56BE0]"
				></textarea>
				<button
					type="button"
					(click)="send()"
					[disabled]="isStreaming() || !draft.trim()"
					class="shrink-0 px-5 py-2.5 bg-gradient-to-br from-[#7B2FBE] to-[#A56BE0] rounded-full text-white font-extrabold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
				>
					{{ isStreaming() ? 'جارٍ الرد...' : 'إرسال' }}
				</button>
			</div>
			<div class="mt-1.5 text-[10px] text-[var(--txt-3)] text-left">{{ draft.length }}/{{ maxQuestionLength }}</div>
		</div>
	</div>
	`,
	styles: [`
		:host { display: block; width: 100%; animation: ws-fade 0.2s ease forwards; }
		@keyframes ws-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantComponent implements OnDestroy {
	readonly maxQuestionLength = MAX_QUESTION_LENGTH;

	draft = '';
	messages = signal<ChatMessage[]>([]);
	isStreaming = signal(false);
	errorMessage = signal('');
	lastQuestion = signal('');

	private historyTail = computed<HelpChatHistoryTurn[]>(() => {
		const msgs = this.messages();
		const turns: HelpChatHistoryTurn[] = [];
		for (let i = 0; i < msgs.length - 1; i++) {
			if (msgs[i].role === 'user' && msgs[i + 1]?.role === 'assistant') {
				turns.push({ question: msgs[i].text, answer: msgs[i + 1].text });
			}
		}
		return turns.slice(-3);
	});

	constructor(private helpAssistant: HelpAssistantSocketService) {
		this.helpAssistant.onAnswerStart(() => {
			this.messages.update((list) => [...list, { role: 'assistant', text: '', streaming: true }]);
		});

		this.helpAssistant.onAnswerChunk(({ chunk }) => {
			this.messages.update((list) => {
				const copy = [...list];
				const last = copy[copy.length - 1];
				if (last && last.role === 'assistant') {
					copy[copy.length - 1] = { ...last, text: last.text + chunk };
				}
				return copy;
			});
		});

		this.helpAssistant.onAnswerComplete(() => {
			this.isStreaming.set(false);
			this.messages.update((list) => {
				const copy = [...list];
				const last = copy[copy.length - 1];
				if (last && last.role === 'assistant') copy[copy.length - 1] = { ...last, streaming: false };
				return copy;
			});
		});

		this.helpAssistant.onError(({ message }) => {
			this.isStreaming.set(false);
			this.errorMessage.set(message);
			// Drop a half-written/empty assistant bubble left over from a
			// failed stream — never show a blank or partial fabricated reply.
			this.messages.update((list) => {
				const last = list[list.length - 1];
				if (last && last.role === 'assistant' && last.streaming) return list.slice(0, -1);
				return list;
			});
		});
	}

	onEnter(event: Event) {
		const keyboardEvent = event as KeyboardEvent;
		if (keyboardEvent.shiftKey) return;
		event.preventDefault();
		this.send();
	}

	send() {
		const question = this.draft.trim();
		if (!question || this.isStreaming()) return;

		this.errorMessage.set('');
		this.lastQuestion.set(question);
		this.messages.update((list) => [...list, { role: 'user', text: question }]);
		this.isStreaming.set(true);
		this.draft = '';

		this.helpAssistant.ask(question, this.historyTail());
	}

	retry() {
		const question = this.lastQuestion();
		if (!question || this.isStreaming()) return;
		this.errorMessage.set('');
		this.isStreaming.set(true);
		this.helpAssistant.ask(question, this.historyTail());
	}

	ngOnDestroy(): void {
		this.helpAssistant.disconnect();
	}
}
