import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { InvalidField } from '../../core/forms/form-helpers';

/**
 * "What is missing" list shown near the submit button after a failed attempt. Each row names the field and the reason;
 * clicking a row asks the parent to focus that field (the parent decides how, e.g. jump to the wizard step first).
 * Renders nothing when `items` is empty.
 */
@Component({
	selector: 'ws-form-summary',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (items().length) {
			<div role="alert" data-testid="form-summary"
				class="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950 dark:text-red-100">
				<div class="mb-2 font-bold">{{ title() }}</div>
				<ul class="list-disc space-y-1 ps-5 leading-relaxed">
					@for (it of items(); track it.path) {
						<li>
							<button type="button" class="text-start underline-offset-2 hover:underline" (click)="select.emit(it)">
								@if (it.label) { <span class="me-1 font-semibold">{{ it.label }}:</span> }
								<span>{{ it.message }}</span>
							</button>
						</li>
					}
				</ul>
			</div>
		}
	`,
})
export class FormSummaryComponent {
	readonly items = input<InvalidField[]>([]);
	readonly title = input('أكمل الحقول التالية للمتابعة');
	readonly select = output<InvalidField>();
}
