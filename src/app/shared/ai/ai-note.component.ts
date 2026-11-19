import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The note that shows what the AI read in a file or a form (identity-document check, selfie / certificate check, work-sample check…).
 * Owner rule: everything that is AI is PURPLE with the official AI mark — never amber / green / red. The outcome is in the sentence itself.
 * (A non-AI notice uses `ws-note` instead.) `state` is only for tests and assistive technology: it never changes the colour.
 */
@Component({
	selector: 'ws-ai-note',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { role: 'status', 'aria-live': 'polite', '[attr.data-state]': 'state()' },
	template: `
		<span class="ws-ain-ico" aria-hidden="true">
			<svg data-ws-ai-mark viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/>
				<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/>
			</svg>
		</span>
		<span class="ws-ain-txt">{{ message() }}</span>
	`,
	styles: [`
		:host { display: flex; align-items: flex-start; gap: 8px; margin-top: 8px; padding: 8px 12px; border-radius: 10px; font-size: var(--font-size-small, 12px); font-weight: 700; line-height: 1.7;
			background: var(--ai-bg, rgba(123, 47, 190, .10)); border: 1px solid var(--ai-border, rgba(123, 47, 190, .22)); color: var(--ai-txt, #A56BE0); }
		.ws-ain-ico { flex-shrink: 0; margin-top: 3px; display: inline-flex; }
		.ws-ain-txt { min-width: 0; overflow-wrap: anywhere; }
	`],
})
export class AiNoteComponent {
	readonly message = input.required<string>();
	readonly state = input<string>('');
}
