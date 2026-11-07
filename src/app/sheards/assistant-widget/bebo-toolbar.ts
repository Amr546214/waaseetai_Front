import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AssistantToolbarState } from './assistant-toolbar-state';

/**
 * Bebo's tool bar: [compass] [mic] | [full chat] [guide] [motions] [settings] [collapse] [close]. The SAME bar is drawn floating by the assistant widget on every page except the admin panel,
 * and by the admin panel's «بيبو» tab; every button does what it always did through the shared AssistantToolbarState (no copy of the logic).
 */
@Component({
	selector: 'app-bebo-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [`
:host {
	--pg-ink: #e9f3ed;
	--pg-surface: rgba(6, 33, 40, 0.96);
	--pg-accent: #2bd4c7;
	--pg-accent-hover: #55dace;
	--pg-border: rgba(43, 212, 199, 0.25);
	display: block;
	direction: rtl;
	pointer-events: auto;
}
:host * { box-sizing: border-box; }
button:focus-visible { outline: 2px solid var(--pg-accent); outline-offset: 2px; }
.pg-toolbar {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 5px 8px;
	border: 1px solid var(--pg-border);
	border-radius: 26px;
	background: var(--pg-surface);
	box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
}

.pg-toolbar-tools {
	display: flex;
	align-items: center;
	gap: 2px;
}

.pg-toolbar-tools[hidden],
.pg-toolbar > [hidden] {
	display: none;
}

.pg-toolbar--collapsed {
	gap: 6px;
}

.pg-toolbar-caption {
	font-size: var(--font-size-small);
	font-weight: 600;
	color: var(--pg-ink);
	white-space: nowrap;
}

.pg-btn {
	display: grid;
	place-items: center;
	width: 32px;
	height: 32px;
	border: 0;
	border-radius: 50%;
	background: transparent;
	color: #b9d6ce;
	cursor: pointer;
	transition: background 0.2s, color 0.2s, transform 0.15s;
	padding: 0;
}

.pg-btn:hover, .pg-btn.is-active {
	background: rgba(43, 212, 199, 0.2);
	color: var(--pg-accent-hover);
	transform: scale(1.05);
}

.pg-btn.is-listening {
	background: rgba(220, 38, 38, 0.25);
	color: #ff9b9b;
	animation: pg-pulse 1.4s infinite;
}

.pg-toolbar-divider {
	height: 18px;
	width: 1px;
	background: rgba(43, 212, 199, 0.2);
	margin: 0 3px;
}
@keyframes pg-pulse {
	0%, 100% { opacity: 1; transform: scale(1); }
	50% { opacity: 0.4; transform: scale(0.96); }
}
@media (max-width: 640px) {
	.pg-toolbar { gap: 1px; padding: 5px 6px; }
	.pg-toolbar-tools { gap: 1px; }
	.pg-btn { width: clamp(24px, 8vw, 30px); height: 30px; }
}
	`],
	template: `
	<!-- Toolbar order from ai-traffic-safety, with a persistent collapse toggle:
	     [Compass] [Mic] [Divider] [History] [Map/Tour] [Smile/Motions] [Settings] [ChevronDown] [Close] -->
	<div class="pg-toolbar" role="group" [class.pg-toolbar--collapsed]="ui.toolbarCollapsed()" [attr.aria-label]="'أدوات ' + ui.characterFullName()">
		<div id="aw-toolbar-tools" class="pg-toolbar-tools" [hidden]="ui.toolbarCollapsed()">
		<button
			type="button"
			class="pg-btn"
			[class.is-active]="ui.expanded() || (ui.store.panelOpen() && ui.panelTab() === 'chat')"
			(click)="ui.toggleComposerOrChat()"
			[attr.aria-label]="'اكتب لـ ' + ui.characterName()"
			[title]="'اكتب لـ ' + ui.characterName()"
		>
			<svg data-ws-icon="pl-assistant-compass" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
		</button>

		<button
			type="button"
			class="pg-btn"
			[class.is-listening]="ui.store.micActive()"
			(click)="ui.toggleListening()"
			[attr.aria-pressed]="ui.store.micActive()"
			[attr.aria-label]="ui.store.micActive() ? 'إيقاف المايك' : ('تحدث لـ ' + ui.characterName())"
			title="الميكروفون"
		>
			<svg data-ws-icon="pl-assistant-mic" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>
		</button>

		<span class="pg-toolbar-divider"></span>

		<button
			type="button"
			class="pg-btn"
			[class.is-active]="ui.store.panelOpen() && ui.panelTab() === 'chat'"
			(click)="ui.openChatPage()"
			aria-label="المحادثة الكاملة"
			title="المحادثة الكاملة"
		>
			<svg data-ws-icon="pl-assistant-clock" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
		</button>

		<button
			type="button"
			class="pg-btn"
			[class.is-active]="ui.store.panelOpen() && ui.panelTab() === 'tour'"
			(click)="ui.openTab('tour')"
			aria-label="دليل وسيط"
			title="دليل وسيط"
		>
			<svg data-ws-icon="pl-assistant-map" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
		</button>

		<button
			type="button"
			class="pg-btn"
			[class.is-active]="ui.store.panelOpen() && ui.panelTab() === 'motions'"
			(click)="ui.openTab('motions')"
			aria-label="حركات الشخصية"
			title="حركات الشخصية"
		>
			<svg data-ws-icon="pl-assistant-smile" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
		</button>

		<button
			type="button"
			class="pg-btn"
			[class.is-active]="ui.store.panelOpen() && ui.panelTab() === 'settings'"
			(click)="ui.openTab('settings')"
			[attr.aria-label]="'إعدادات ' + ui.characterName()"
			[title]="'إعدادات ' + ui.characterName()"
		>
			<svg data-ws-icon="pl-assistant-sliders" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
		</button>

		</div>
		<span class="pg-toolbar-caption" [hidden]="!ui.toolbarCollapsed()">أدوات {{ ui.characterName() }}</span>
		<button
			type="button"
			class="pg-btn pg-toolbar-toggle"
			(click)="ui.toggleToolbar()"
			[attr.aria-expanded]="!ui.toolbarCollapsed()"
			aria-controls="aw-toolbar-tools"
			[attr.aria-label]="(ui.toolbarCollapsed() ? 'فتح أدوات ' : 'طي أدوات ') + ui.characterName()"
			[title]="ui.toolbarCollapsed() ? 'فتح قائمة الأدوات' : 'طي قائمة الأدوات'"
		>
			<svg data-ws-icon="ws-chevron-right" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" [style.transform]="ui.toolbarCollapsed() ? 'rotate(180deg)' : null"><polyline points="6 9 12 15 18 9"/></svg>
		</button>

		<button
			type="button"
			class="pg-btn"
			[hidden]="ui.toolbarCollapsed()"
			(click)="ui.dismissAssistant()"
			[attr.aria-label]="'إغلاق ' + ui.characterName()"
			title="إغلاق"
		>
			<svg data-ws-icon="ws-close" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
		</button>
	</div>
	`,
})
export class BeboToolbarComponent {
	readonly ui = inject(AssistantToolbarState);
}
