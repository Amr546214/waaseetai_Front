import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	ElementRef,
	HostListener,
	PLATFORM_ID,
	computed,
	effect,
	inject,
	input,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { AssistantStore, MAX_QUESTION_LENGTH } from '../../core/store/assistant.store';
import { BeboAvatarComponent } from '../bebo-avatar/bebo-avatar';
import { AuthStore } from '../../core/store/auth.store';
import { AssistantChatComponent } from '../assistant-chat/assistant-chat';
import { BeboPose } from '../bebo-avatar/bebo-loader';
import {
	BEBO_CORE_MOTIONS,
	NADEEM_GUIDE_MOTIONS,
	BEBO_DIALECTS,
	BEBO_VOICES,
	BeboAction,
	BeboDialect,
} from '../bebo-avatar/bebo-commands';
import { AssistantViewport, dockPlacement, popupPlacement } from './assistant-placement';
import { AssistantPositionSettingsComponent } from '../assistant-chat/assistant-position-settings';
import { AssistantPositionService } from './assistant-position.service';
import { avatarMovementBounds } from './assistant-position';
import { BAR_CLEARANCE_PX, SidebarInset, assistantReservePx, detectBottomBarHeight, detectSidebarInset, isTextEntryElement } from './assistant-avoidance';

const STATE_LABELS = {
	idle: 'جاهز أساعدك',
	thinking: 'بيفكر…',
	listening: 'بسمعك…',
	speaking: 'بيتكلم…',
	error: 'تعذر الرد',
} as const;

const BEBO_SIZE = 96;
const BEBO_SIZE_MOBILE = 72;
const TOOLBAR_COLLAPSED_PREF_KEY = 'waseet_assistant_toolbar_collapsed';

export interface GuidedTopic {
	title: string;
	desc: string;
	question: string;
	icon: string;
}

const GUIDED_TOPICS: readonly GuidedTopic[] = [
	{
		title: 'حساب الضمان المالي',
		desc: 'كيف يحمي وسيط أموال المشتري ومستحقات البائع حتى استلام الخدمة؟',
		question: 'كيف يعمل حساب الضمان في وسيط؟',
		icon: '🛡️',
	},
	{
		title: 'إنشاء طلب وساطة',
		desc: 'خطوات بدء معاملة جديدة وتحديد الشروط والمواعيد بدقة.',
		question: 'كيف أنشئ طلب وساطة جديد؟',
		icon: '💼',
	},
	{
		title: 'إدارة النزاعات والتحكيم',
		desc: 'آلية فض النزاع وتدخل فريق وسيط في حال اختلاف الطرفين.',
		question: 'ما هي خطوات فتح نزاع وكيف يتم التحكيم؟',
		icon: '⚖️',
	},
	{
		title: 'شحن الرصيد وسحب الأرباح',
		desc: 'وسائل الدفع المدعومة ومدة معالجة طلبات السحب.',
		question: 'ما هي وسائل الدفع وطرق سحب الرصيد؟',
		icon: '💳',
	},
	{
		title: 'توثيق الحساب والهوية',
		desc: 'متطلبات ترقية الحساب وتوثيق بيانات الهوية الشخصية.',
		question: 'كيف أقوم بتوثيق حسابي في وسيط؟',
		icon: '📋',
	},
];

@Component({
	selector: 'app-assistant-widget',
	standalone: true,
	imports: [FormsModule, RouterLink, NgStyle, BeboAvatarComponent, AssistantChatComponent, AssistantPositionSettingsComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrl: './assistant-widget.css',
	host: {
		'(document:keydown.escape)': 'onEscape()',
		'[style.--bebo-size.px]': 'beboSize()',
		'[style.--assistant-lift.px]': 'lift()',
		'[style.inset-block-end.px]': '12 + lift()',
		'[class.is-kbd-hidden]': 'keyboardHidden()',
		'(document:pointerdown)': 'onDocumentPointerDown($event)',
		'(document:focusin)': 'onFocusChange($event)',
		'(document:focusout)': 'onFocusChange($event)',
		'(window:scroll)': 'scheduleBarProbe()',
	},
	template: `
	<div class="aw" [attr.data-state]="store.state()" [class.is-dismissed]="dismissed()">
		<!-- Speech Bubble when panel is closed and Bebo has replied -->
		@if (!dismissed() && !store.panelOpen() && !isGuest() && store.preview() && !bubbleDismissed() && !minimized() && !store.busy()) {
			<section class="aw__bubble" [ngStyle]="bubbleStyle()" [attr.aria-label]="'آخر رد من ' + characterName()" dir="auto">
				<button type="button" class="aw__dismiss" (click)="bubbleDismissed.set(true)" [attr.aria-label]="'إخفاء فقاعة رد ' + characterName()">×</button>
				<p>{{ store.preview() }}{{ (store.lastAssistant()?.text?.length ?? 0) > 220 ? '…' : '' }}</p>
				<button type="button" class="aw__details" (click)="openTab('chat')">فتح المحادثة</button>
			</section>
		}
		@if (!dismissed() && !store.panelOpen() && !isGuest() && store.errorMessage() && !minimized()) {
			<section class="aw__bubble" [ngStyle]="bubbleStyle()" role="alert">
				<p>{{ store.errorMessage() }}</p>
				<button type="button" class="aw__details" (click)="openTab('chat')">فتح المحادثة</button>
			</section>
		}

		<!-- Main Popup Panel (Chat, Motions, Settings, Tour) -->
		@if (!dismissed() && store.panelOpen() && !minimized()) {
			<section class="aw__panel" [ngStyle]="panelStyle()" [class.aw__panel--guest]="isGuest() && panelTab() === 'chat'" role="dialog" aria-modal="false" aria-labelledby="aw-title">
				<header class="aw__head">
					<div>
						<h2 id="aw-title">{{ panelTitle() }}</h2>
						@if (!isGuest() && (store.state() !== 'idle' || store.audioLoading())) {
							<span class="aw__state" aria-live="polite">{{ stateLabel() }}</span>
						}
					</div>
					<div class="aw__head-actions">
						<button type="button" class="aw__menu-toggle" [attr.aria-label]="'خيارات ' + characterName()" [attr.aria-expanded]="menuOpen()" aria-controls="aw-menu" (click)="menuOpen.update(toggleMenu)">⋯</button>
						@if (menuOpen()) {
							<div id="aw-menu" class="aw__menu" role="group" aria-label="خيارات المساعد">
								<a routerLink="/assistant" (click)="menuOpen.set(false)">صفحة الشات والسجل</a>
								<button type="button" (click)="selectTab('chat')">المحادثة</button>
								<button type="button" (click)="selectTab('motions')">الحركات</button>
								<button type="button" (click)="selectTab('settings')">الإعدادات</button>
								<button type="button" (click)="selectTab('tour')">دليل وسيط</button>
								@if (!isGuest() && panelTab() === 'chat') {
									<button type="button" (click)="store.newConversation(); menuOpen.set(false)">محادثة جديدة</button>
									<button type="button" (click)="exportConversation()" [disabled]="!store.messages().length">تصدير السجل</button>
								}
							</div>
						}
						<button type="button" class="aw__close" (click)="store.close()" [attr.aria-label]="'إغلاق ' + characterName()">
							<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
						</button>
					</div>
				</header>

				@if (isGuest() && panelTab() === 'chat') {
					<div class="aw__guest" data-testid="assistant-guest-prompt">
						<p>سجّل الدخول لتتحدث مع {{ characterName() }}</p>
						<a class="aw__login" routerLink="/auth/login" (click)="store.close()">تسجيل الدخول</a>
					</div>
				} @else {
					@if (panelTab() === 'chat') {
						<app-assistant-chat class="aw__chat" [compact]="true" />
					} @else if (panelTab() === 'motions') {
						<div class="pg-motions-container">
							<p class="pg-motions-intro">حركات {{ characterName() }} ({{ store.skin() === 'scout' ? 'دليل وسيط' : 'المساعد الكرتوني' }}):</p>
							<div class="pg-motions">
								@for (motion of currentMotions(); track motion.action) {
									<button type="button" (click)="playMotion(motion.action)" [disabled]="store.busy()">
										<span>{{ motion.icon }}</span>
										{{ motion.label }}
									</button>
								}
							</div>
						</div>
					} @else if (panelTab() === 'settings') {
						<div class="pg-settings">
							<p id="aw-manual-audio-help" class="pg-manual-audio-help">تشغيل الصوت يدويًا من زر كل رد. يمكنك ضبط الصوت واللهجة ومستواه هنا.</p>
							<label>
								مظهر الروبوت
								<select [value]="store.skin()" (change)="store.setSkin($any($event.target).value)">
									<option value="scout">نديم (دليل وسيط)</option>
									<option value="classic">بيبو (المساعد الكرتوني)</option>
								</select>
							</label>
							<label>
								طريقة الرد
								<select class="pg-profile" [value]="store.profile()" (change)="store.setProfile($any($event.target).value)">
									<option value="auto">تلقائي</option>
									<option value="fast">سريع ومختصر</option>
									<option value="balanced">متوازن</option>
									<option value="deep">شرح وتحليل مفصل</option>
								</select>
							</label>
							<app-assistant-position-settings />
							<label>
								اللهجة
								<select class="pg-speech-dialect" [value]="store.ttsDialect()" (change)="store.setDialect($any($event.target).value)" aria-describedby="aw-manual-audio-help">
									<option value="auto">تلقائي حسب كلامك</option>
									@for (d of dialects; track d.id) {
										<option [value]="d.id">{{ d.label }}</option>
									}
								</select>
							</label>
							<label>
								الصوت
								<select class="pg-speech-voice" [value]="store.ttsVoice()" (change)="store.setVoice($any($event.target).value)" aria-describedby="aw-manual-audio-help">
									@for (v of availableVoices(); track v.id) {
										<option [value]="v.id">{{ v.label || v.id }}</option>
									}
								</select>
							</label>
							<label>مستوى الصوت
								<input class="pg-volume" type="range" min="0" max="1" step="0.1" [value]="store.voiceVolume()" (input)="store.setVolume(+$any($event.target).value)" aria-describedby="aw-manual-audio-help" [attr.aria-valuetext]="(store.voiceVolume() * 100) + '%'" />
							</label>
							@if (store.capabilityNotice()) { <p class="pg-capability-notice" role="status">{{ store.capabilityNotice() }}</p> }
							<p>الصوت مُولّد آليًا. اسحب الشخصية لتحريكها، أو استخدم الأسهم.</p>
							<button type="button" class="pg-secondary" (click)="resetPosition()">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
								رجّع الشخصية لمكانها
							</button>
						</div>
					} @else if (panelTab() === 'tour') {
						<div class="pg-tour-container">
							@for (topic of guidedTopics; track topic.title) {
								<div class="pg-tour-item">
									<div class="pg-tour-head">
										<span class="pg-tour-title">{{ topic.icon }} {{ topic.title }}</span>
									</div>
									<p class="pg-tour-desc">{{ topic.desc }}</p>
									<button type="button" class="pg-tour-ask" (click)="askGuidedTopic(topic.question)">
										اسأل {{ characterName() }} عن هذا الموضوع ←
									</button>
								</div>
							}
						</div>
					}
				}
			</section>
		}

		<!-- Floating Dock Toolbar OR Minimized Pill OR Reopen Button -->
		@if (dismissed()) {
			<button
				type="button"
				class="pg-reopen"
				(click)="restoreAssistant()"
				[attr.aria-label]="'إظهار ' + characterFullName()"
				[title]="'إظهار ' + characterFullName()"
			>
				<span class="pg-reopen-icon">
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
					</svg>
				</span>
				<span class="pg-reopen-text">إظهار {{ characterName() }}</span>
			</button>
		} @else if (!minimized()) {
			<div class="pg-dock" [ngStyle]="dockStyle()">
				<!-- Quick Composer input bar when expanded & panel is closed -->
				@if (expanded() && !store.panelOpen()) {
					<form class="pg-composer" (submit)="onQuickSend($event)">
						<input
							#quickInput
							[(ngModel)]="quickText"
							name="quickText"
							[maxlength]="maxQuestionLength"
							[placeholder]="store.micActive() ? 'بسمعك…' : ('اسأل ' + characterName() + ' أي سؤال عن وسيط...')"
							[attr.aria-label]="'رسالتك لـ ' + characterName()"
							dir="auto"
							[disabled]="store.busy()"
						/>
						@if (store.busy()) {
							<button type="button" (click)="store.cancel()" aria-label="إيقاف الرد">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
							</button>
						} @else {
							<button type="submit" [disabled]="!quickText.trim()" aria-label="إرسال الرسالة">
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
							</button>
						}
					</form>
					<div class="pg-status">
						<span class="pg-status-dot" [class.is-busy]="store.busy()"></span>
						{{ statusText() }}
						<span class="pg-status-dialect">{{ dialectLabel() }}</span>
					</div>
				}

				<!-- Toolbar order from ai-traffic-safety, with a persistent collapse toggle:
				     [Compass] [Mic] [Divider] [History] [Map/Tour] [Smile/Motions] [Settings] [ChevronDown] [Close] -->
				<div class="pg-toolbar" role="group" [class.pg-toolbar--collapsed]="toolbarCollapsed()" [attr.aria-label]="'أدوات ' + characterFullName()">
					<div id="aw-toolbar-tools" class="pg-toolbar-tools" [hidden]="toolbarCollapsed()">
					<button
						type="button"
						class="pg-btn"
						[class.is-active]="expanded() || (store.panelOpen() && panelTab() === 'chat')"
						(click)="toggleComposerOrChat()"
						[attr.aria-label]="'اكتب لـ ' + characterName()"
						[title]="'اكتب لـ ' + characterName()"
					>
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
					</button>

					<button
						type="button"
						class="pg-btn"
						[class.is-listening]="store.micActive()"
						(click)="toggleListening()"
						[attr.aria-pressed]="store.micActive()"
						[attr.aria-label]="store.micActive() ? 'إيقاف المايك' : ('تحدث لـ ' + characterName())"
						title="الميكروفون"
					>
						<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
					</button>

					<span class="pg-toolbar-divider"></span>

					<button
						type="button"
						class="pg-btn"
						[class.is-active]="store.panelOpen() && panelTab() === 'chat'"
						(click)="openChatPage()"
						aria-label="المحادثة الكاملة"
						title="المحادثة الكاملة"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
					</button>

					<button
						type="button"
						class="pg-btn"
						[class.is-active]="store.panelOpen() && panelTab() === 'tour'"
						(click)="openTab('tour')"
						aria-label="دليل وسيط"
						title="دليل وسيط"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
					</button>

					<button
						type="button"
						class="pg-btn"
						[class.is-active]="store.panelOpen() && panelTab() === 'motions'"
						(click)="openTab('motions')"
						aria-label="حركات الشخصية"
						title="حركات الشخصية"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
					</button>

					<button
						type="button"
						class="pg-btn"
						[class.is-active]="store.panelOpen() && panelTab() === 'settings'"
						(click)="openTab('settings')"
						[attr.aria-label]="'إعدادات ' + characterName()"
						[title]="'إعدادات ' + characterName()"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
					</button>

					</div>
					<span class="pg-toolbar-caption" [hidden]="!toolbarCollapsed()">أدوات {{ characterName() }}</span>
					<button
						type="button"
						class="pg-btn pg-toolbar-toggle"
						(click)="toggleToolbar()"
						[attr.aria-expanded]="!toolbarCollapsed()"
						aria-controls="aw-toolbar-tools"
						[attr.aria-label]="(toolbarCollapsed() ? 'فتح أدوات ' : 'طي أدوات ') + characterName()"
						[title]="toolbarCollapsed() ? 'فتح قائمة الأدوات' : 'طي قائمة الأدوات'"
					>
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [style.transform]="toolbarCollapsed() ? 'rotate(180deg)' : null"><polyline points="6 9 12 15 18 9"/></svg>
					</button>

					<button
						type="button"
						class="pg-btn"
						[hidden]="toolbarCollapsed()"
						(click)="dismissAssistant()"
						[attr.aria-label]="'إغلاق ' + characterName()"
						title="إغلاق"
					>
						<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
					</button>
				</div>
			</div>
		} @else {
			<!-- Minimized Launcher Pill -->
			<div class="pg-launcher" [ngStyle]="launcherStyle()" (click)="minimized.set(false)" [title]="'افتح ' + characterFullName()">
				<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--pg-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
				<span class="pg-launcher-text">{{ characterFullName() }}</span>
			</div>
		}

		<!-- Avatar host: MUST BE THE LAST ELEMENT OF .aw to preserve aw.lastElementChild contract -->
		<app-bebo-avatar
			class="aw__bebo"
			[state]="store.state()"
			[celebrate]="store.successTick()"
			[command]="store.beboCommand()"
			[skin]="store.skin()"
			[paused]="dismissed()"
			[size]="beboSize()"
			[homeX]="beboHomeX"
			[movementBounds]="movementBounds()"
			[floorOffset]="avatarFloorOffset()"
			[label]="beboLabel()"
			(activate)="onAvatarActivate()"
			(robotDragStart)="onRobotDragStart($event)"
			(robotMove)="onRobotMove($event)"
			(robotDrop)="onRobotDrop($event)"
			(robotLand)="onRobotLand($event)"
		/>
	</div>
	`,
})
export class AssistantWidgetComponent {
	/** Extra px above the viewport floor (pages with a fixed bottom action bar). */
	readonly lift = input(0);
	readonly store = inject(AssistantStore);
	readonly positionSettings = inject(AssistantPositionService);
	private readonly router = inject(Router);
	openChatPage(): void { this.store.panelOpen.set(false); void this.router.navigateByUrl('/assistant'); }
	readonly dismissed = computed(() => this.store.dismissed());
	readonly bubbleDismissed = signal(false);
	readonly minimized = signal(false);
	readonly toolbarCollapsed = signal(false);
	readonly expanded = signal(false);
	readonly panelTab = signal<'chat' | 'motions' | 'settings' | 'tour'>('chat');
	readonly menuOpen = signal(false);
	readonly toggleMenu = (open: boolean) => !open;
	readonly maxQuestionLength = MAX_QUESTION_LENGTH;
	quickText = '';

	readonly characterName = computed(() => this.store.characterName());
	readonly characterRole = computed(() => this.store.characterRole());
	readonly characterFullName = computed(() => this.store.characterFullName());
	readonly currentMotions = computed(() => (this.store.skin() === 'scout' ? NADEEM_GUIDE_MOTIONS : BEBO_CORE_MOTIONS));

	readonly guidedTopics = GUIDED_TOPICS;
	readonly dialects = Object.entries(BEBO_DIALECTS).map(([id, d]) => ({ id, label: d.label }));

	private readonly hostElement: ElementRef<HTMLElement> = inject(ElementRef);
	private returnFocus: HTMLElement | null = null;
	private readonly authStore = inject(AuthStore);

	readonly isGuest = computed(() => !this.authStore.token());
	readonly stateLabel = computed(() => (this.store.audioLoading() ? 'يجهّز الصوت…' : STATE_LABELS[this.store.state()]));
	readonly beboLabel = computed(() =>
		`${this.characterName()}، ${this.characterRole()} — ${this.store.panelOpen() ? 'اضغط لإغلاق المحادثة' : 'اضغط لفتح المحادثة'}`,
	);

	readonly panelTitle = computed(() => {
		switch (this.panelTab()) {
			case 'motions':
				return `حركات ${this.characterName()}`;
			case 'settings':
				return `إعدادات ${this.characterName()}`;
			case 'tour':
				return 'دليل وسيط';
			case 'chat':
			default:
				return this.characterName();
		}
	});

	readonly statusText = computed(() => {
		const state = this.store.state();
		if (this.store.audioLoading()) return 'يجهّز الصوت…';
		if (state === 'listening') return 'بسمعك…';
		if (state === 'thinking') return 'بيفكر…';
		if (state === 'speaking') return `${this.characterName()} بيتكلم…`;
		if (state === 'error') return 'تعذر الرد';
		return 'جاهز أساعدك';
	});

	readonly dialectLabel = computed(() => BEBO_DIALECTS[this.store.detectedDialect()]?.label ?? 'مصري');
	readonly availableVoices = computed(() => this.store.capabilities()?.voices ?? BEBO_VOICES.map(v => ({ id: v, label: v })));
	readonly textModels = computed(() => (this.store.capabilities()?.models ?? []).filter(model => model.available !== false && model.modalities?.some(mode => ['text', 'chat'].includes(mode.toLowerCase()))));
	readonly speechModels = computed(() => (this.store.capabilities()?.models ?? []).filter(model => model.available !== false && model.modalities?.some(mode => ['tts', 'speech'].includes(mode.toLowerCase()))));

	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly avatar = viewChild(BeboAvatarComponent);
	private readonly chat = viewChild(AssistantChatComponent);
	private readonly compact = signal(false);
	readonly beboSize = computed(() => (this.compact() ? BEBO_SIZE_MOBILE : BEBO_SIZE));
	private readonly floorSpace = computed(() => {
		const prefs = this.positionSettings.preferences();
		return Math.max(0, this.viewport().height - this.beboSize() - prefs.top - prefs.bottom - 54);
	});
	private readonly quickComposerLift = computed(() => this.expanded() && !this.store.panelOpen() ? Math.min(64, this.floorSpace()) : 0);
	/** Height of a fixed bottom action bar/banner found on the current page (see detectBottomBarHeight). */
	private readonly detectedBar = signal(0);
	/** Persistent dashboard sidebar footprint: the avatar is dragged in the content area only (the sidebar is above the widget). */
	private readonly sidebarInset = signal<SidebarInset>({ left: 0, right: 0 });
	/** env(safe-area-inset-bottom) in px (home indicator / gesture bar). */
	private readonly safeBottom = signal(0);
	/** True while an on-screen keyboard is likely open over a page input: the widget steps aside. */
	readonly keyboardHidden = signal(false);
	private readonly baseLift = computed(() => Math.max(this.lift(), this.detectedBar() > 0 ? this.detectedBar() + BAR_CLEARANCE_PX : 0) + this.safeBottom());
	readonly positionLift = computed(() => Math.min(Math.max(0, this.floorSpace() - this.quickComposerLift()), Math.max(0, this.baseLift() + this.positionSettings.preferences().verticalOffset)));
	readonly avatarFloorOffset = computed(() => this.positionLift() + this.quickComposerLift());
	readonly beboHomeX: number | null = this.isBrowser && getComputedStyle(document.documentElement).direction === 'ltr' ? 100_000 : null;

	// Dynamic tracking when dragged
	readonly robotPos = signal<{ x: number; y: number } | null>(null);
	readonly hasMoved = signal(false);
	private readonly viewport = signal<AssistantViewport>({ width: 1200, height: 800, left: 0, top: 0 });
	readonly movementBounds = computed(() => avatarMovementBounds(this.viewport(), this.beboSize(), this.positionSettings.preferences(), this.avatarFloorOffset()));
	private readonly anchor = computed(() => {
		const viewport = this.viewport();
		const size = this.beboSize();
		const bounds = this.movementBounds();
		const fallbackX = this.beboHomeX ? bounds.maxX : bounds.minX;
		return { ...(this.robotPos() ?? { x: fallbackX, y: bounds.maxY }), size };
	});

	readonly dockStyle = computed(() => dockPlacement(this.viewport(), this.anchor(), this.positionLift(), this.toolbarCollapsed() && (!this.expanded() || this.store.panelOpen()) ? 126 : 348));
	readonly panelStyle = computed(() => popupPlacement(this.viewport(), this.anchor()));
	readonly bubbleStyle = computed(() => popupPlacement(this.viewport(), this.anchor(), 320, 240));
	readonly launcherStyle = computed(() => dockPlacement(this.viewport(), this.anchor(), this.positionLift(), 190));

	constructor() {
		const destroyRef = inject(DestroyRef);
		if (this.isBrowser) {
			// No saved choice: small screens start with the compact pill so the toolbar never covers the page's bottom actions.
			let saved: string | null = null;
			try { saved = localStorage.getItem(TOOLBAR_COLLAPSED_PREF_KEY); } catch { /* storage unavailable */ }
			this.toolbarCollapsed.set(saved === null ? typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches : saved === '1');
		}
		this.updateViewport();
		if (this.isBrowser) this.initAvoidance(destroyRef);
		let positionResetTick = this.positionSettings.resetTick();
		effect(() => {
			const tick = this.positionSettings.resetTick();
			if (tick === positionResetTick) return;
			positionResetTick = tick;
			queueMicrotask(() => this.resetPosition());
		});
		if (this.isBrowser && window.visualViewport) {
			const visualViewport = window.visualViewport;
			const update = () => this.updateViewport();
			visualViewport.addEventListener('resize', update);
			visualViewport.addEventListener('scroll', update);
			destroyRef.onDestroy(() => {
				visualViewport.removeEventListener('resize', update);
				visualViewport.removeEventListener('scroll', update);
			});
		}
		let wasOpen = false;
		effect(() => {
			const open = this.store.panelOpen();
			if (!this.isBrowser || open === wasOpen) return;
			wasOpen = open;
			if (open) {
				this.returnFocus = document.activeElement as HTMLElement;
				queueMicrotask(() => this.hostElement.nativeElement.querySelector<HTMLTextAreaElement>('textarea')?.focus());
			} else {
				untracked(() => this.menuOpen.set(false));
				queueMicrotask(() => {
					if (this.returnFocus?.isConnected) this.returnFocus.focus();
				});
			}
		});

		effect(() => {
			this.store.lastAssistant();
			untracked(() => this.bubbleDismissed.set(false));
		});

		const offSpeech = this.store.onSpeechLevel((level) => this.avatar()?.setSpeechLevel(level));
		destroyRef.onDestroy(offSpeech);

		if (this.isBrowser && typeof window.matchMedia === 'function') {
			const mq = window.matchMedia('(max-width: 640px)');
			const onChange = () => this.compact.set(mq.matches);
			onChange();
			mq.addEventListener?.('change', onChange);
			destroyRef.onDestroy(() => mq.removeEventListener?.('change', onChange));
		}
	}

	private barProbeFrame = 0;
	private readonly routerEvents = inject(Router).events;

	private initAvoidance(destroyRef: DestroyRef): void {
		const probe = document.createElement('div');
		probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;padding-bottom:env(safe-area-inset-bottom,0px)';
		this.hostElement.nativeElement.appendChild(probe);
		const readSafe = () => this.safeBottom.set(Math.round(parseFloat(getComputedStyle(probe).paddingBottom) || 0));
		readSafe();
		const timers: ReturnType<typeof setTimeout>[] = [];
		const sub = this.routerEvents.subscribe(event => {
			if (!(event instanceof NavigationEnd)) return;
			// pages render their action bar after navigation: probe again a little later
			for (const delay of [0, 300, 1200, 3000, 6000]) timers.push(setTimeout(() => this.probeBars(), delay));
		});
		const onResize = () => { readSafe(); this.scheduleBarProbe(); };
		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);
		timers.push(setTimeout(() => this.probeBars(), 400));
		const reserve = effect(() => {
			const px = this.dismissed() ? 0 : assistantReservePx(this.beboSize()) + this.safeBottom();
			document.documentElement.style.setProperty('--ws-assistant-reserve', `${px}px`);
		});
		destroyRef.onDestroy(() => {
			sub.unsubscribe();
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
			timers.forEach(clearTimeout);
			if (this.barProbeFrame) cancelAnimationFrame(this.barProbeFrame);
			reserve.destroy();
			probe.remove();
			document.documentElement.style.removeProperty('--ws-assistant-reserve');
		});
	}

	scheduleBarProbe(): void {
		if (!this.isBrowser || this.barProbeFrame) return;
		this.barProbeFrame = requestAnimationFrame(() => { this.barProbeFrame = 0; this.probeBars(); });
	}

	private probeBars(): void {
		if (this.dismissed()) return;
		const host = this.hostElement.nativeElement;
		const height = detectBottomBarHeight(document, window, el => host.contains(el) || el === host || el.tagName === 'CUTE-ROBOT');
		if (height !== this.detectedBar()) this.detectedBar.set(height);
		this.refreshSidebarInset();
	}

	/** Keeps the drag region out of the persistent dashboard sidebar (re-read on every probe and right before a pointer press). */
	private refreshSidebarInset(): void {
		if (!this.isBrowser) return;
		const inset = detectSidebarInset(document, window);
		const was = this.sidebarInset();
		if (inset.left !== was.left || inset.right !== was.right) { this.sidebarInset.set(inset); this.updateViewport(); }
	}

	/** Collapse the open toolbar on small screens when the user taps the page (never persisted). */
	onDocumentPointerDown(event: Event): void {
		this.refreshSidebarInset();
		if (!this.compact() || this.toolbarCollapsed() || this.store.panelOpen() || this.expanded()) return;
		const target = event.target as Node | null;
		if (target && this.hostElement.nativeElement.contains(target)) return;
		if (target instanceof Element && target.closest('cute-robot, .pg-dock')) return;
		this.toolbarCollapsed.set(true);
	}

	/** Step aside while a page input has focus and the on-screen keyboard is (probably) open. */
	onFocusChange(event: Event): void {
		const host = this.hostElement.nativeElement;
		const target = event.target as Element | null;
		if (event.type === 'focusin' && target && !host.contains(target) && isTextEntryElement(target)) {
			const visible = window.visualViewport;
			const keyboardOpen = !!visible && visible.height < window.innerHeight - 120;
			this.keyboardHidden.set(this.compact() || keyboardOpen);
			return;
		}
		if (event.type === 'focusout') {
			setTimeout(() => {
				const active = document.activeElement;
				if (!active || host.contains(active) || !isTextEntryElement(active)) this.keyboardHidden.set(false);
			}, 120);
		}
	}

	@HostListener('window:resize')
	updateViewport(): void {
		if (!this.isBrowser) return;
		const visible = window.visualViewport;
		const inset = this.sidebarInset();
		const width = visible?.width || document.documentElement.clientWidth || window.innerWidth;
		this.viewport.set({
			width: Math.max(0, width - inset.left - inset.right),
			height: visible?.height || window.innerHeight,
			left: (visible?.offsetLeft || 0) + inset.left,
			top: visible?.offsetTop || 0,
		});
	}

	onRobotDragStart(pos: { x: number; y: number }): void {
		this.hasMoved.set(true);
		this.robotPos.set(pos);
	}

	onRobotMove(pos: { x: number; y: number }): void {
		this.robotPos.set(pos);
	}

	onRobotDrop(pos: { x: number; y: number }): void {
		this.hasMoved.set(true);
		this.robotPos.set(pos);
	}

	onRobotLand(pos: { x: number; y: number }): void {
		if (this.hasMoved()) {
			this.robotPos.set(pos);
		}
	}

	onEscape(): void {
		if (this.menuOpen()) {
			this.menuOpen.set(false);
		} else if (this.store.panelOpen()) {
			this.store.close();
		} else if (this.expanded()) {
			this.expanded.set(false);
		}
	}

	onAvatarActivate(): void {
		if (this.store.panelOpen()) {
			this.store.close();
		} else {
			this.panelTab.set('chat');
			this.store.open();
		}
	}

	openTab(tab: 'chat' | 'motions' | 'settings' | 'tour'): void {
		this.menuOpen.set(false);
		if (this.store.panelOpen() && this.panelTab() === tab) {
			this.store.close();
		} else {
			this.panelTab.set(tab);
			this.expanded.set(false);
			if (!this.store.panelOpen()) {
				this.store.open();
			}
		}
	}

	selectTab(tab: 'chat' | 'motions' | 'settings' | 'tour'): void {
		this.panelTab.set(tab);
		this.menuOpen.set(false);
	}

	exportConversation(): void {
		this.chat()?.exportConversation();
		this.menuOpen.set(false);
	}

	toggleComposerOrChat(): void {
		if (this.isGuest()) {
			this.openTab('chat');
			return;
		}
		if (this.store.panelOpen()) {
			this.store.close();
		} else {
			this.expanded.update(v => !v);
		}
	}

	toggleListening(): void {
		if (this.isGuest()) {
			this.openTab('chat');
			return;
		}
		this.store.toggleListening();
	}

	toggleToolbar(): void {
		this.toolbarCollapsed.update(collapsed => !collapsed);
		if (this.isBrowser) {
			try { localStorage.setItem(TOOLBAR_COLLAPSED_PREF_KEY, this.toolbarCollapsed() ? '1' : '0'); } catch { /* storage unavailable */ }
		}
	}

	toggleMinimize(): void {
		this.minimized.update(v => !v);
		if (this.minimized()) {
			this.store.close();
			this.expanded.set(false);
		}
	}

	dismissAssistant(): void {
		this.store.dismiss();
		this.expanded.set(false);
		this.bubbleDismissed.set(true);
	}

	restoreAssistant(): void {
		this.store.restore();
		this.minimized.set(false);
	}

	@HostListener('window:waseet-open-assistant')
	@HostListener('window:open-assistant')
	onWindowOpenAssistant(): void {
		this.restoreAssistant();
		this.store.open();
	}

	@HostListener('window:waseet-toggle-assistant')
	@HostListener('window:toggle-assistant')
	onWindowToggleAssistant(): void {
		if (this.store.dismissed()) {
			this.restoreAssistant();
			this.store.open();
		} else {
			this.store.toggle();
		}
	}

	playMotion(action: BeboAction | BeboPose): void {
		this.store.runMotion(action);
	}

	resetPosition(): void {
		this.hasMoved.set(false);
		this.robotPos.set(null);
		this.avatar()?.settle();
		this.avatar()?.returnHome();
	}

	askGuidedTopic(question: string): void {
		this.panelTab.set('chat');
		if (this.isGuest()) return;
		this.store.ask(question);
	}

	onQuickSend(event: Event): void {
		event.preventDefault();
		const text = this.quickText.trim();
		if (!text || this.store.busy()) return;
		if (this.store.ask(text)) {
			this.quickText = '';
			this.bubbleDismissed.set(false);
		}
	}
}
