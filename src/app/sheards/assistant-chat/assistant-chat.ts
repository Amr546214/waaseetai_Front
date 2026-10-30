import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssistantStore, MAX_QUESTION_LENGTH } from '../../core/store/assistant.store';
import { guidedCatalog, guidedSupport } from '../../core/help/help-guided';
import { BEBO_CORE_MOTIONS, NADEEM_GUIDE_MOTIONS, BEBO_ALL_MOTIONS, BEBO_DIALECTS, BEBO_DIALECT_IDS, BEBO_VOICES } from '../bebo-avatar/bebo-commands';
import { assistantMarkdown, safeAssistantUrl } from '../../core/help/assistant-content';
import { BeboAction } from '../bebo-avatar/bebo-commands';
import { cleanMessages } from '../../core/help/assistant-history';
import { AssistantReplyAudioComponent } from './assistant-reply-audio';

// Conversation UI for the ONE real Help assistant (AssistantStore). Rendered
// by the floating dashboard Avatar panel and by the client/provider help
// "AI assistant" pages, so they all show the same real conversation.

@Component({
	selector: 'app-assistant-chat',
	standalone: true,
	imports: [FormsModule, RouterLink, AssistantReplyAudioComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	@if (store.guided()) {
	<div class="ac ac--guided" [class.ac--compact]="compact()" data-testid="assistant-guided">
		<div class="ac__log">
			<div class="ac__row"><div class="ac__bubble ac__bubble--ai" dir="auto">أهلًا، أنا {{ store.characterName() }}. اختر موضوعًا من القائمة وسأعرض لك رد مختصرًا من مركز المساعدة.</div></div>
			@if (pick(); as p) {
				<div class="ac__row ac__row--user"><div class="ac__bubble ac__bubble--user" dir="auto" data-testid="guided-question">{{ p.question }}</div></div>
				<div class="ac__row">
					<div class="ac__bubble ac__bubble--ai" dir="auto" data-testid="guided-answer">{{ p.answer }}</div>
					@if (p.links?.length) { <div class="ac__guided-links">@for (l of p.links; track l.route) { <a class="ac__guided-link" [routerLink]="l.route" [queryParams]="l.queryParams" data-testid="guided-link">{{ l.label }}</a> }</div> }
				</div>
			}
		</div>
		<div class="ac__chips" role="group" aria-label="أسئلة جاهزة" data-testid="guided-chips">
			@for (q of catalog(); track q.id) {
				<button type="button" class="ac__chip" [class.ac__chip--on]="pick()?.id === q.id" (click)="choose(q.id)" [attr.data-id]="q.id">{{ q.question }}</button>
			}
		</div>
		<div class="ac__support" data-testid="guided-support">
			<span>{{ pick() ? 'لم تكفِك الإجابة؟' : 'لا تجد ما تبحث عنه؟' }}</span>
			@if (support().support; as s) { <a class="ac__support-btn" [routerLink]="s.route" data-testid="guided-support-link">{{ s.label }}</a> }
			<a class="ac__support-btn ac__support-btn--ghost" [routerLink]="support().ticket.route" [queryParams]="support().ticket.queryParams" data-testid="guided-ticket-link">{{ support().ticket.label }}</a>
		</div>
		<p class="ac__disclaimer">إجابات جاهزة من مركز مساعدة وسيط. القرارات والإجراءات المالية تبقى لدى الفريق المختص.</p>
	</div>
	} @else {
	<div class="ac" [class.ac--compact]="compact()" [class.ac--workspace]="workspace()">
		@if (!compact()) {
			<div class="ac__toolbar"><button type="button" (click)="store.newConversation()">محادثة جديدة</button><button type="button" (click)="exportConversation()" [disabled]="!store.messages().length">تصدير السجل</button><details class="ac__motions"><summary>حركات {{ store.characterName() }}</summary><div>@for (motion of motions(); track motion.id) { <button type="button" (click)="store.runMotion(motion.id)" [disabled]="store.busy()">{{ motion.label }}</button> }</div></details></div>
		}
		<div #scroller class="ac__log" role="log" aria-label="سجل المحادثة" tabindex="0" aria-live="off" (scroll)="onScroll()" [attr.aria-busy]="store.busy()">
			@if (store.messages().length === 0) {
				<div class="ac__empty">اسأل، أو اطلب شرحًا أو مساعدة في الكتابة.</div>
			}
			@for (m of store.messages(); track $index) {
				<div class="ac__row" [class.ac__row--user]="m.role === 'user'">
					@if (m.role === 'user') {
						<div class="ac__bubble ac__bubble--user" dir="auto">{{ m.text }}</div>
						@if (workspace()) {
							<div class="ac__message-actions"><button type="button" (click)="copy(m.text)">نسخ</button><button type="button" (click)="beginEdit($index, m.text)" [disabled]="store.busy()">تعديل</button></div>
							@if (editingIndex === $index) { <div class="ac__edit"><textarea [(ngModel)]="editDraft" [maxlength]="maxLength" aria-label="تعديل رسالتك" rows="3"></textarea><button type="button" (click)="submitEdit()" [disabled]="!editDraft.trim() || store.busy()">حفظ وإعادة الإرسال</button><button type="button" (click)="editingIndex = -1">إلغاء</button></div> }
						}
					} @else {
						<div class="ac__bubble ac__bubble--ai" dir="auto">
							<div class="ac__formatted" [innerHTML]="formatAssistantText(m.text)"></div>
							@if (m.streaming) {<span class="ac__cursor" aria-hidden="true"></span>}
						</div>
						@if (!m.streaming) { <div class="ac__message-actions"><button type="button" class="ac__copy" (click)="copy(m.text)" [attr.aria-label]="'نسخ رد ' + store.characterName()">نسخ الرد</button>@if (workspace()) { @for (code of codeBlocks(m.text); track $index) { <button type="button" (click)="copy(code)">نسخ الكود {{ $index + 1 }}</button> } @if ($last) { <button type="button" (click)="store.regenerate()" [disabled]="store.busy()">إعادة الرد</button> } }</div> }
						<app-assistant-reply-audio [text]="m.text" [complete]="!m.streaming" />
					}
					@if (m.citations?.length) {
						<div class="ac__cites">
							<span>المصادر:</span>
							@for (c of m.citations; track c.docId + c.title) {
								@if (sourceUrl(c.url); as url) { <a class="ac__cite" [href]="url" target="_blank" rel="noopener noreferrer">{{ c.title }}{{ c.section ? ' · ' + c.section : '' }}{{ c.line ? ' · سطر ' + c.line : '' }}</a> } @else { <span class="ac__cite">{{ c.title }}{{ c.section ? ' · ' + c.section : '' }}</span> }
							}
						</div>
					}
					@if (m.searchSuggestionsHtml) { <div class="ac__search-attribution" aria-label="اقتراحات بحث Google" [innerHTML]="m.searchSuggestionsHtml"></div> }
				</div>
			}
			@if (store.busy() && !store.streaming()) {
				<div class="ac__row">
					<div class="ac__bubble ac__bubble--ai ac__typing" aria-label="المساعد يفكر"><span></span><span></span><span></span></div>
				</div>
			}
		</div>
		@if (showJump()) { <button type="button" class="ac__jump" (click)="scrollToLatest()" aria-label="الانتقال إلى أحدث رسالة">↓ أحدث رسالة</button> }
		@if (store.progress().length) { <details class="ac__progress" [open]="store.busy()"><summary>{{ store.busy() ? 'تقدم المهمة' : 'سجل المهمة' }}</summary><ol>@for (step of store.progress(); track $index) { <li>{{ step.message || step.stage }} @if (step.status) { <small>{{ progressLabel(step.status) }}</small> }</li> }</ol></details> }
		<p class="ac__sr" role="status" aria-live="polite">{{ store.busy() ? (store.characterName() + ' يعمل على سؤالك') : store.errorMessage() ? 'تعذر الرد' : store.lastAssistant() ? ('اكتمل رد ' + store.characterName()) : '' }} {{ copyNotice }}</p>

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
			<div class="ac__notice ac__bebo" role="status" dir="auto">{{ store.characterName() }}: {{ store.commandReply() }}</div>
		}
		@if (store.micActive()) {
			<div class="ac__notice ac__listening" role="status" dir="auto">بسمعك… {{ store.transcript() }}</div>
		}
		@if (store.micNotice()) {
			<div class="ac__notice ac__mic-notice" role="status">{{ store.micNotice() }}</div>
		}
		@if (store.liveNotice()) { <p class="ac__notice" role="status">{{ store.liveNotice() }}</p> }
		@if (store.liveTranscript()) { <p class="ac__notice" dir="auto">{{ store.liveTranscript() }}</p> }
		@if (store.sttLoading()) { <p class="ac__notice" role="status">جاري تحويل التسجيل إلى نص…</p> }

		<div class="ac__input">
			@if (store.capabilities()?.stt?.available) { <button type="button" class="ac__mic" (click)="store.toggleRecording()" [disabled]="store.busy() || store.sttLoading()" [attr.aria-pressed]="store.recording()" [attr.aria-label]="store.recording() ? 'إنهاء الرسالة الصوتية' : 'تسجيل رسالة صوتية'">{{ store.recording() ? '■' : '●' }}</button> }
			<button
				type="button"
				class="ac__mic"
				(click)="store.toggleListening()"
				[disabled]="store.busy() || store.sttLoading()"
				[attr.aria-pressed]="store.micActive()"
				[attr.aria-label]="store.micActive() ? 'إنهاء التسجيل وإرسال سؤالك' : 'تحدث بسؤالك'"
				[title]="store.micSupported ? '' : 'الإملاء الصوتي غير متاح هنا؛ جرّب Chrome أو Edge.'"
			>
				<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
			</button>
			<textarea #composer
				[(ngModel)]="draft"
				(input)="resizeComposer()"
				(keydown.enter)="onEnter($event)"
				[disabled]="store.busy() || store.liveActive() || store.liveConnecting() || store.sttLoading()"
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
		<div class="ac__tools"><button type="button" class="ac__web" (click)="store.webSearchEnabled.update(toggleWeb)" [disabled]="!store.capabilities()?.webSearch?.available || store.busy()" [attr.aria-pressed]="store.webSearchEnabled() && !!store.capabilities()?.webSearch?.available" [title]="store.capabilities()?.webSearch?.available ? 'استخدام مصادر من الويب في السؤال التالي' : 'البحث غير متاح حاليًا'">◎ البحث في الويب</button></div>
		<div class="ac__meta">
			@if (draft.length) { <span class="ac__counter" aria-label="عدد حروف الرسالة">{{ draft.length }}/{{ maxLength }}</span> }
		</div>
		@if (!compact()) {
		<details class="ac__settings-panel" [open]="!compact()">
		<summary>تخصيص الرد</summary>
		<div class="ac__settings">
			<label>مظهر الروبوت
				<select [value]="store.skin()" (change)="store.setSkin($any($event.target).value)">
					<option value="scout">نديم (دليل وسيط)</option>
					<option value="classic">بيبو (المساعد الكرتوني)</option>
				</select>
			</label>
			<label>طريقة الرد<select [value]="store.profile()" (change)="store.setProfile($any($event.target).value)"><option value="auto">تلقائي</option><option value="fast">سريع ومختصر</option><option value="balanced">متوازن</option><option value="deep">شرح وتحليل مفصل</option></select></label>
			@if (textModels().length) { <label>النموذج<select [value]="store.textModel()" (change)="store.textModel.set($any($event.target).value)"><option value="">اختيار الخادم</option>@for (model of textModels(); track model.id) { <option [value]="model.id">{{ model.label || model.id }}</option> }</select></label> }
			<label>اللهجة
				<select class="ac__dialect" [value]="store.ttsDialect()" (change)="store.setDialect($any($event.target).value)">
					<option value="auto" [selected]="store.ttsDialect() === 'auto'">تلقائي من كلامك</option>
					@for (d of dialects; track d.id) {
						<option [value]="d.id" [selected]="store.ttsDialect() === d.id">{{ d.label }}</option>
					}
				</select>
			</label>
				<label>الصوت
					<select class="ac__voice-select" [value]="store.ttsVoice()" (change)="store.setVoice($any($event.target).value)">
						@for (v of availableVoices(); track v.id) {
							<option [value]="v.id" [selected]="store.ttsVoice() === v.id">{{ v.label || v.id }}</option>
						}
					</select>
				</label>
				@if (speechModels().length) { <label>جودة الصوت<select [value]="store.ttsModel()" (change)="setSpeechModel($any($event.target).value)">@for (model of speechModels(); track model.id) { <option [value]="model.id">{{ model.label || model.id }}</option> }</select></label> }
				<label>مستوى الصوت<input type="range" min="0" max="1" step="0.1" [value]="store.voiceVolume()" (input)="store.setVolume(+$any($event.target).value)" /></label>
			<small>شغّل صوت أي رد من زر الاستماع أسفله. الصوت مُولّد آليًا.</small>
		</div>
		</details>
		@if (store.capabilityNotice()) { <p class="ac__notice">{{ store.capabilityNotice() }}</p> }
		}
		<p class="ac__disclaimer">مساعد آلي قد يخطئ. قواعد وسيط تحتاج مصادر معتمدة.</p>
	</div>
	}
	`,
	styles: [`
		.ac__search-attribution { max-width:100%;overflow-x:auto;margin-top:8px; }.ac__search-attribution:empty{display:none}
		.ac__tools { display:flex;gap:6px; }.ac__web,.ac__jump,.ac__message-actions button { font:inherit;font-size:var(--font-size-small);color:var(--txt-3,#94a3b8);background:transparent;border:0;border-radius:16px;padding:4px 9px;cursor:pointer; }.ac__message-actions button { border:1px solid rgba(148,163,184,.2);background:rgba(255,255,255,.03); }.ac__message-actions button:hover { color:var(--txt,#fff);border-color:rgba(165,107,224,.45); }.ac__web { border:1px solid var(--sec-bd,#727272); }.ac__web[aria-pressed=true] { color:var(--assistant-link,#2f68c9);border-color:currentColor; }.ac__web:disabled { opacity:.5;cursor:default; }.ac__jump { align-self:center;border:1px solid var(--sec-bd,#aaa); }.ac__message-actions { display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px; }.ac__edit { display:flex;flex-wrap:wrap;gap:8px;width:min(100%,600px); }.ac__edit textarea { width:100%;font:inherit;color:inherit;background:transparent;border:1px solid var(--sec-bd,#aaa);border-radius:12px;padding:10px; }.ac__edit button { font:inherit;font-size:var(--font-size-small); }
		.ac__log { overscroll-behavior:contain;scrollbar-gutter:stable;scrollbar-width:auto;scrollbar-color:var(--scroll-thumb,#94a3b8) transparent; }.ac__log::-webkit-scrollbar { width:10px; }.ac__log::-webkit-scrollbar-thumb { background:var(--scroll-thumb,#94a3b8);border:2px solid transparent;background-clip:padding-box;border-radius:8px; }
		.ac--workspace { position:relative;gap:8px; }.ac--workspace .ac__log { min-height:0;gap:37px;padding:26px max(20px,calc((100% - 844px)/2));overflow-y:scroll; }.ac--workspace .ac__bubble { max-width:100%;font-size:var(--font-size-section);line-height:1.6; }.ac--workspace .ac__bubble--ai { background:transparent;border:0;box-shadow:none;padding:0; }.ac--workspace .ac__bubble--user { max-width:70%;background:#193e73;border-radius:25px;padding:12px 18px;box-shadow:none;font-size:var(--font-size-section); }.ac--workspace .ac__empty { font-size:24px; }.ac--workspace .ac__input,.ac--workspace .ac__tools,.ac--workspace .ac__meta,.ac--workspace .ac__disclaimer,.ac--workspace .ac__notice,.ac--workspace .ac__error,.ac--workspace .ac__progress { width:min(calc(100% - 40px),844px);margin-inline:auto; }.ac--workspace .ac__input { border:1px solid var(--sec-bd,#e5e5e5);border-radius:30px;min-height:58px;padding:8px;gap:8px;background:var(--assistant-surface,#fff); }.ac--workspace .ac__input textarea { border:0;background:transparent;padding:4px;min-height:28px;max-height:190px;font-size:var(--font-size-section);line-height:1.5; }.ac--workspace .ac__btn { background:#2f68c9;border-radius:22px;min-height:40px; }.ac--workspace .ac__jump { position:absolute;bottom:155px;background:var(--assistant-surface,#fff); }.ac--workspace .ac__disclaimer { text-align:center;font-size:var(--font-size-caption);margin-bottom:12px; }.ac--workspace .ac__cites { font-size:var(--font-size-small); }
		@media(max-width:767px) { .ac--workspace .ac__log { padding:20px 16px;gap:28px; }.ac--workspace .ac__bubble--user { max-width:90%; }.ac--workspace .ac__bubble { font-size:var(--font-size-body); }.ac--workspace .ac__input,.ac--workspace .ac__tools,.ac--workspace .ac__meta,.ac--workspace .ac__disclaimer,.ac--workspace .ac__notice,.ac--workspace .ac__error,.ac--workspace .ac__progress { width:calc(100% - 24px); }.ac--workspace .ac__input { gap:4px; }.ac--workspace .ac__btn { padding:8px 10px; } }
		@media print { .ac__input,.ac__tools,.ac__meta,.ac__disclaimer,.ac__jump,.ac__message-actions { display:none!important; }.ac--workspace,.ac--workspace .ac__log { height:auto;max-height:none;overflow:visible;display:block; }.ac__row { break-inside:avoid;margin-bottom:24px; }.ac--workspace .ac__bubble--ai { color:#000; }.ac--workspace .ac__log { padding:10px; } }
		.ac__settings-panel { font-size:var(--font-size-small); }.ac__settings-panel > summary { cursor:pointer;color:var(--txt-3,#94a3b8); }.ac__settings-panel[open] > summary { margin-bottom:8px; }.ac:not(.ac--compact) .ac__settings-panel > summary { display:none; }
		.ac__toolbar { display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:var(--font-size-small); }
		.ac__toolbar button,.ac__motions summary { color:var(--txt,#fff);background:transparent;border:1px solid var(--sec-bd,#aaa);border-radius:12px;padding:6px 9px;cursor:pointer; }
		.ac__motions { position:relative; }.ac__motions>div { display:flex;flex-wrap:wrap;gap:6px;padding:8px;max-height:180px;overflow:auto;background:var(--assistant-surface,#17233b);border-radius:12px; }
		.ac__copy { font:inherit;font-size:var(--font-size-caption);background:none;border:0;color:var(--txt-3,#8892b0);margin-top:5px;cursor:pointer; }
		.ac__progress { font-size:var(--font-size-small);max-height:120px;overflow:auto; }.ac__progress ol{padding-inline-start:20px;margin:5px 0;}.ac__progress small{opacity:.75;}
		.ac__sr { position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%); }
		:host ::ng-deep .ac__formatted { white-space:normal; }:host ::ng-deep .ac__formatted :first-child { margin-block-start:0; }:host ::ng-deep .ac__formatted :last-child { margin-block-end:0; }
		:host ::ng-deep .ac__formatted p { margin:0 0 8px; }:host ::ng-deep .ac__formatted h4 { font-size:var(--font-size-label);margin:10px 0 6px; }:host ::ng-deep .ac__formatted ul,:host ::ng-deep .ac__formatted ol { padding-inline-start:22px;margin:5px 0; }:host ::ng-deep .ac__formatted a,.ac__cite { color:var(--assistant-link,#55dace); }:host ::ng-deep .ac__formatted pre { white-space:pre;overflow:auto;max-width:100%;padding:10px;background:rgba(0,0,0,.15);border-radius:10px; }:host ::ng-deep .ac__formatted code { font-family:monospace; }:host ::ng-deep .ac__formatted blockquote { border-inline-start:3px solid #a56be0;margin:8px 0;padding-inline-start:10px; }
		button:focus-visible,summary:focus-visible,select:focus-visible,textarea:focus-visible,a:focus-visible { outline:2px solid #a56be0;outline-offset:3px; }
		:host { display: flex; flex-direction: column; min-height: 0; }
		.ac { display: flex; flex:1; flex-direction: column; gap: 10px; min-height: 0; }
		.ac > :not(.ac__log) { flex-shrink:0; }
		.ac__log { flex: 1; min-height: 160px; max-height: 460px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 4px 2px; }
		.ac--compact .ac__log { min-height:0;max-height:none;overflow-y:scroll; }
		.ac__empty { margin: auto; text-align: center; font-size: var(--font-size-label); color: var(--txt-3, #8892B0); padding: 24px 8px; }
		.ac__row { display: flex; flex-shrink:0; flex-direction: column; align-items: flex-start; }
		.ac__row--user { align-items: flex-end; }
		.ac__bubble { max-width: 92%; border-radius: 16px; padding: 11px 14px; font-size: var(--font-size-label); line-height: 1.75; word-break: break-word; }
		.ac__bubble--user { background: linear-gradient(135deg, #7B2FBE, #9333EA); color: #fff; white-space: pre-wrap; border-bottom-left-radius: 4px; box-shadow: 0 4px 12px rgba(123,47,190,.25); }
		.ac__bubble--ai { background: rgba(255,255,255,.05); border: 1px solid rgba(165,107,224,.22); color: var(--txt, #E2E8F0); border-bottom-right-radius: 4px; box-shadow: 0 4px 14px rgba(0,0,0,.15); }
		:host ::ng-deep .ac__formatted { display: flex; flex-direction: column; }
		:host ::ng-deep .ac__formatted strong { color: var(--txt,#fff); font-weight: 700; }
		:host ::ng-deep .ac__formatted em { color: var(--txt-2,#CBD5E1); font-style: italic; }
		.ac__para { margin: 0 0 6px 0; line-height: 1.7; }
		.ac__para:last-child { margin-bottom: 0; }
		.ac__gap { height: 8px; }
		.ac__heading { font-size: var(--font-size-label); font-weight: 800; color: #fff; margin: 8px 0 4px 0; }
		.ac__item { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; }
		.ac__item-body { flex: 1; min-width: 0; line-height: 1.65; }
		.ac__badge { min-width: 20px; height: 20px; border-radius: 50%; background: rgba(123,47,190,.4); border: 1px solid rgba(165,107,224,.5); color: #E9D5FF; font-size: var(--font-size-small); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
		.ac__bullet { color: #A56BE0; font-weight: 800; font-size: var(--font-size-label); margin-inline-end: 4px; margin-top: 1px; flex-shrink: 0; }
		.ac__cursor { display: inline-block; width: 6px; height: 14px; background: currentColor; vertical-align: middle; margin-inline-start: 2px; animation: ac-blink 1s steps(2) infinite; }
		.ac__typing { display: inline-flex; gap: 5px; align-items: center; }
		.ac__typing span { width: 7px; height: 7px; border-radius: 50%; background: #A56BE0; animation: ac-dot 1.2s infinite; }
		.ac__typing span:nth-child(2) { animation-delay: .2s; }
		.ac__typing span:nth-child(3) { animation-delay: .4s; }
		.ac__cites { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; font-size: var(--font-size-small); color: var(--txt-3, #8892B0); }
		.ac__cite { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; background: rgba(123,47,190,.1); border: 1px solid rgba(165,107,224,.28); font-size: var(--font-size-small); line-height: 1.4; text-decoration: none; }
		.ac__error { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px; border-radius: 12px; font-size: var(--font-size-label); color: #FF8C69; background: rgba(255,140,105,.08); border: 1px solid rgba(255,140,105,.25); }
		.ac__error-actions { display: flex; gap: 10px; }
		.ac__error-actions button, .ac__error-actions a, .ac__link { background: none; border: 0; padding: 0; color: inherit; font: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }
		.ac__notice { font-size: var(--font-size-small); color: var(--txt-3, #8892B0); }
		.ac__input { display: flex; align-items: center; gap: 8px; }
		.ac__input textarea { flex: 1; resize: none; min-width: 0; border-radius: 12px; border: 1px solid var(--sec-bd, rgba(255,255,255,.12)); background: transparent; color: var(--txt, #fff); padding: 9px 12px; font: inherit; font-size: var(--font-size-label); outline: none; }
		.ac__input textarea:focus { border-color: #A56BE0; }
		.ac__btn { flex-shrink: 0; padding: 9px 18px; border-radius: 999px; border: 0; background: linear-gradient(135deg, #7B2FBE, #A56BE0); color: #fff; font: inherit; font-size: var(--font-size-label); font-weight: 800; cursor: pointer; }
		.ac__btn:disabled { opacity: .4; cursor: not-allowed; }
		.ac__btn--ghost { background: transparent; border: 1px solid rgba(165,107,224,.5); color: #A56BE0; }
		.ac__meta { display: flex;flex-wrap:wrap; justify-content: space-between; align-items: center; gap: 8px; font-size: var(--font-size-small); color: var(--txt-3, #8892B0); }
		.ac__meta:empty { display:none; }
		.ac__counter { margin-inline-start:auto; font-size:var(--font-size-caption); opacity:.7; }
		.ac__voice { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
		.ac__disclaimer { margin: 0; font-size: var(--font-size-small); color: var(--txt-3, #8892B0); }
		.ac__mic { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 38px; height: 38px; padding: 8px; border-radius: 50%; border: 1px solid var(--sec-bd, rgba(255,255,255,.12)); background: transparent; color: var(--txt, #fff); line-height: 1; cursor: pointer; }
		.ac__mic svg { width: 100%; height: 100%; display: block; }
		.ac__mic[aria-pressed="true"] { color: #ffb1c1; border-color: #ffb1c1; background: rgba(170,52,68,.15); }
		.ac__mic:disabled { opacity: .4; cursor: not-allowed; }
		.ac__settings { display: flex; flex-wrap: wrap; gap: 10px; font-size: var(--font-size-small); color: var(--txt-3, #8892B0); }
		.ac__settings label { display: inline-flex; align-items: center; gap: 6px; }
		.ac__settings select { min-width: 0; padding: 3px 6px; border-radius: 8px; border: 1px solid var(--sec-bd, rgba(255,255,255,.12)); background: transparent; color: var(--txt, #fff); font: inherit; }
		.ac__listening { color: #ffb1c1; }
		.ac__chips { display: flex; flex-wrap: wrap; gap: 8px; }
		.ac__chip { padding: 7px 13px; border-radius: 999px; border: 1px solid rgba(165,107,224,.4); background: rgba(123,47,190,.1); color: var(--txt, #fff); font: inherit; font-size: var(--font-size-label); font-weight: 700; cursor: pointer; }
		.ac__chip:hover, .ac__chip--on { background: rgba(123,47,190,.3); border-color: #A56BE0; }
		.ac__guided-links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
		.ac__guided-link { font-size: var(--font-size-small); font-weight: 800; color: #2BD4C7; text-decoration: underline; }
		.ac__support { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--font-size-small); color: var(--txt-3, #8892B0); }
		.ac__support-btn { padding: 8px 16px; border-radius: 999px; background: linear-gradient(135deg, #2BD4C7, #2B7FFF); color: #070D24; font-size: var(--font-size-label); font-weight: 800; text-decoration: none; }
		.ac__support-btn--ghost { background: transparent; border: 1px solid rgba(43,212,199,.5); color: #2BD4C7; }
		@keyframes ac-blink { 50% { opacity: 0; } }
		@keyframes ac-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
		@media (prefers-reduced-motion: reduce) { .ac__cursor, .ac__typing span { animation: none; } }
		@media (max-width: 480px) { .ac__settings { gap:6px; }.ac__settings label { max-width:100%; }.ac__settings select { max-width:180px; }.ac__input { gap:5px; }.ac__btn { padding:9px 12px; }.ac__log { min-height:80px; }.ac__mic { width:34px;height:34px; }.ac__toolbar { gap:5px; } }
	`],
})
export class AssistantChatComponent implements OnDestroy {
	readonly store = inject(AssistantStore);
	/** Compact layout for the floating panel (log fills available height). */
	readonly compact = input(false);
	readonly workspace = input(false);
	readonly showJump = signal(false);
	readonly toggleWeb = (enabled: boolean) => !enabled;
	readonly maxLength = MAX_QUESTION_LENGTH;
	/** Handoff option lists (bebo-core.mjs DIALECTS, bebo-chat.js voices). */
	readonly dialects = BEBO_DIALECT_IDS.map((id) => ({ id, label: BEBO_DIALECTS[id].label }));
	readonly voices = BEBO_VOICES;
	readonly availableVoices = computed(() => this.store.capabilities()?.voices ?? this.voices.map(id => ({ id, label: id })));
	readonly textModels = computed(() => (this.store.capabilities()?.models ?? []).filter(m => m.available !== false && m.modalities?.some(v => ['text','chat'].includes(v.toLowerCase()))));
	readonly speechModels = computed(() => (this.store.capabilities()?.models ?? []).filter(m => m.available !== false && m.modalities?.some(v => ['tts','speech'].includes(v.toLowerCase()))));
	readonly motions = computed(() => {
		const list = this.store.skin() === 'scout' ? NADEEM_GUIDE_MOTIONS : BEBO_CORE_MOTIONS;
		return list.map((m) => ({ id: m.action, label: `${m.icon} ${m.label}` }));
	});
	copyNotice = '';
	private nearBottom = true;
	draft = '';
	editingIndex = -1;
	editDraft = '';

	// Help pages: guided FAQ navigator (no input, no mic, no send).
	readonly catalog = computed(() => { const r = this.store.guidedRole(); return r ? guidedCatalog(r) : []; });
	readonly support = computed(() => guidedSupport(this.store.guidedRole() ?? 'provider'));
	readonly pick = computed(() => this.catalog().find((q) => q.id === this.store.guidedPick()) ?? null);
	choose(id: string): void { this.store.guidedPick.set(id); }

	/** The mic must not keep listening once its UI is gone (panel closed). */
	ngOnDestroy(): void {
		this.store.cancelListening();
		this.store.cancelRecording();
		this.store.stopLive();
	}

	@ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
	@ViewChild('composer') private composer?: ElementRef<HTMLTextAreaElement>;

	constructor() {
		this.store.loadCapabilities();
		let conversationId = this.store.activeConversationId();
		let userMessageCount = this.store.messages().filter(message => message.role === 'user').length;
		// Keep the newest text in view while an answer streams in.
		effect(() => {
			const messages = this.store.messages();
			const id = this.store.activeConversationId();
			if (id !== conversationId) { conversationId = id; this.nearBottom = true; this.showJump.set(false); this.draft = ''; this.editingIndex = -1; }
			const count = messages.filter(message => message.role === 'user').length;
			// Includes questions sent through the microphone or floating quick composer.
			if (count > userMessageCount) { this.nearBottom = true; this.showJump.set(false); }
			userMessageCount = count;
			queueMicrotask(() => {
				const el = this.scroller?.nativeElement;
				if (el && this.nearBottom) el.scrollTop = el.scrollHeight;
			});
		});
		queueMicrotask(() => this.composer?.nativeElement.focus());
	}
	onScroll(): void { const el = this.scroller?.nativeElement; this.nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 64; this.showJump.set(!this.nearBottom); }
	scrollToLatest(): void { this.nearBottom = true; this.showJump.set(false); const el = this.scroller?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }
	beginEdit(index: number, text: string): void { this.editingIndex = index; this.editDraft = text; }
	submitEdit(): void { if (this.store.editMessage(this.editingIndex, this.editDraft)) { this.editingIndex = -1; this.scrollToLatest(); } }
	codeBlocks(text: string): string[] { return [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(match => match[1].trimEnd()); }
	sourceUrl(value: unknown): string | null { return safeAssistantUrl(value); }
	progressLabel(value: string): string { return ({ running:'جارٍ',completed:'اكتمل',failed:'تعذر',cancelled:'أُلغي',partial:'جزئي',pending:'بانتظار التنفيذ' } as Record<string,string>)[value] ?? value; }
	setSpeechModel(model: string): void { this.store.setTtsModel(model); }
	async copy(text: string): Promise<void> { try { await navigator.clipboard.writeText(text); this.copyNotice = 'تم نسخ الرد'; } catch { this.copyNotice = 'تعذر النسخ؛ يمكنك تحديد النص ونسخه.'; } }
	exportConversation(): void { const data = { version:1,exportedAt:new Date().toISOString(),messages:cleanMessages(this.store.messages()) }; const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); const link=document.createElement('a');link.href=url;link.download='waseet-conversation.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
	resizeComposer(): void { const el = this.composer?.nativeElement; if (!el || !this.workspace()) return; el.style.height='auto'; el.style.height=`${Math.min(190, Math.max(28, el.scrollHeight))}px`; }

	onEnter(event: Event): void {
		if ((event as KeyboardEvent).shiftKey || (event as KeyboardEvent).isComposing) return;
		event.preventDefault();
		this.send();
	}

	send(): void {
		if (this.store.ask(this.draft)) { this.draft = ''; this.scrollToLatest(); queueMicrotask(() => this.resizeComposer()); }
	}

	formatAssistantText(raw: string): string { return assistantMarkdown(raw); }
}
