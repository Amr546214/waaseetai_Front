import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AssistantStore } from '../../core/store/assistant.store';
import { BEBO_DIALECTS, BEBO_DIALECT_IDS, BEBO_VOICES } from '../bebo-avatar/bebo-commands';
import { AssistantPositionSettingsComponent } from './assistant-position-settings';

@Component({
	selector: 'app-assistant-settings', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AssistantPositionSettingsComponent],
	template: `
	<div class="settings" dir="rtl">
		<p>شغّل صوت أي رد من زر الاستماع أسفله، ثم تحكّم في التشغيل والوقت من مشغّل الصوت.</p>
		<label>الشخصية<select [value]="store.skin()" (change)="store.setSkin($any($event.target).value)"><option value="scout">نديم — دليل وسيط</option><option value="classic">بيبو — المساعد الكرتوني</option></select></label>
		<app-assistant-position-settings />
		<label>طريقة الرد<select [value]="store.profile()" (change)="store.setProfile($any($event.target).value)"><option value="auto">تلقائي</option><option value="fast">سريع ومختصر</option><option value="balanced">متوازن</option><option value="deep">شرح وتحليل مفصل</option></select></label>
		<label>اللهجة<select [value]="store.ttsDialect()" (change)="store.setDialect($any($event.target).value)"><option value="auto">تلقائي حسب كلامك</option>@for (dialect of dialects; track dialect.id) { <option [value]="dialect.id">{{ dialect.label }}</option> }</select></label>
			<label>الصوت<select [value]="store.ttsVoice()" (change)="store.setVoice($any($event.target).value)">@for (voice of voices(); track voice.id) { <option [value]="voice.id">{{ voice.label || voice.id }}</option> }</select></label>
			<label>مستوى الصوت<input type="range" min="0" max="1" step="0.1" [value]="store.voiceVolume()" (input)="store.setVolume(+$any($event.target).value)" /></label>
		@if (store.capabilityNotice()) { <p role="status">{{ store.capabilityNotice() }}</p> }
		<small>الصوت مُولّد آليًا.</small>
	</div>`,
	styles: [`
		.settings { display: flex; flex-direction: column; gap: 18px; color: var(--assistant-text, var(--tc-text, var(--txt, #171717))); font-size: 13px; }
		.settings label { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: inherit; }
		.settings select { min-width: 140px; max-width: 65%; background-color: var(--assistant-input-bg, var(--tc-surface, #fff)); color: var(--assistant-text, var(--tc-text, inherit)); border: 1px solid var(--assistant-input-border, var(--tc-line, var(--sec-bd, #e5e5e5))); border-radius: 10px; padding: 8px 12px; font: inherit; font-size: 13px; color-scheme: light dark; }
		.settings select option { background-color: var(--assistant-input-bg, var(--tc-surface, #fff)); color: var(--assistant-text, var(--tc-text, #171717)); }
		.settings input { accent-color: #2f68c9; }
		.settings small, .settings p { color: var(--assistant-muted, var(--tc-muted, var(--txt-3, #727272))); font-size: 12px; line-height: 1.5; }
		.settings select:focus-visible, .settings input:focus-visible { outline: 2px solid var(--tc-accent, #2f68c9); outline-offset: 2px; }

		:host-context(.workspace--dark) .settings,
		:host-context(.dark) .settings,
		:host-context([data-theme="dark"]) .settings {
			color: var(--assistant-text, #f3f3f3);
		}
		:host-context(.workspace--dark) .settings select,
		:host-context(.dark) .settings select,
		:host-context([data-theme="dark"]) .settings select {
			background-color: var(--assistant-input-bg, #262626);
			color: var(--assistant-text, #f3f3f3);
			border-color: var(--assistant-input-border, #383838);
			color-scheme: dark;
		}
		:host-context(.workspace--dark) .settings select option,
		:host-context(.dark) .settings select option,
		:host-context([data-theme="dark"]) .settings select option {
			background-color: #262626;
			color: #f3f3f3;
		}
		:host-context(.workspace--dark) .settings small,
		:host-context(.workspace--dark) .settings p,
		:host-context(.dark) .settings small,
		:host-context(.dark) .settings p,
		:host-context([data-theme="dark"]) .settings small,
		:host-context([data-theme="dark"]) .settings p {
			color: var(--assistant-muted, #a5a5a5);
		}

		:host-context(.light-theme) .settings select,
		:host-context([data-theme="light"]) .settings select {
			background-color: var(--assistant-input-bg, #fff);
			color: var(--assistant-text, #171717);
			border-color: var(--assistant-input-border, #e5e5e5);
			color-scheme: light;
		}
		:host-context(.light-theme) .settings select option,
		:host-context([data-theme="light"]) .settings select option {
			background-color: #fff;
			color: #171717;
		}
		:host-context(.light-theme) .settings small,
		:host-context(.light-theme) .settings p,
		:host-context([data-theme="light"]) .settings small,
		:host-context([data-theme="light"]) .settings p {
			color: var(--assistant-muted, #64748b);
		}
	`],
})
export class AssistantSettingsComponent {
	readonly store = inject(AssistantStore);
	readonly dialects = BEBO_DIALECT_IDS.map(id => ({ id, label: BEBO_DIALECTS[id].label }));
	readonly voices = computed(() => this.store.capabilities()?.voices ?? BEBO_VOICES.map(id => ({ id, label: id })));
	readonly textModels = computed(() => (this.store.capabilities()?.models ?? []).filter(m => m.available !== false && m.modalities?.some(v => ['text','chat'].includes(v.toLowerCase()))));
	readonly speechModels = computed(() => (this.store.capabilities()?.models ?? []).filter(m => m.available !== false && m.modalities?.some(v => ['tts','speech'].includes(v.toLowerCase()))));
}
