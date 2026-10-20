import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { InvalidField } from '../../core/forms/form-helpers';

/**
 * What is missing after a failed attempt, for SCREEN READERS ONLY. There is no visible aggregate box any more: every invalid field shows its own
 * specific Arabic red message right under it (ws-field-error / file error / markInvalid) with a red border, and the first one is focused and
 * scrolled below the sticky header. This component only keeps a visually hidden polite live region ("يوجد N حقول تحتاج إلى تصحيح" + the list), so
 * assistive technology still hears the count. Renders nothing when `items` is empty.
 * (`select` is kept for the parents that still wire it; nothing visible emits it.)
 */
@Component({
	selector: 'ws-form-summary',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (items().length) {
			<div role="status" aria-live="polite" data-testid="form-summary" class="sr-only">
				<p>{{ countText() }}</p>
				<ul>
					@for (it of items(); track it.path) {
						<li>@if (it.label) { <span>{{ it.label }}: </span> }<span>{{ it.message }}</span></li>
					}
				</ul>
			</div>
		}
	`,
})
export class FormSummaryComponent {
	readonly items = input<InvalidField[]>([]);
	/** Kept for API compatibility with the old visible box; not rendered. */
	readonly title = input('أكمل الحقول التالية للمتابعة');
	readonly select = output<InvalidField>();
	protected countText(): string {
		const n = this.items().length;
		return n === 1 ? 'يوجد حقل واحد يحتاج إلى تصحيح' : n === 2 ? 'يوجد حقلان يحتاجان إلى تصحيح' : `يوجد ${n} حقول تحتاج إلى تصحيح`;
	}
}
