import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

let nextId = 0;

/**
 * A submit button that is never silently disabled. It is disabled ONLY
 *   - while `submitting` (label switches to `submittingLabel`), or
 *   - when the parent passes a `disabledReason`, which is always printed right under the button.
 * Invalid forms are NOT a reason to disable: leave it enabled and let attemptSubmit() show what is missing.
 */
@Component({
	selector: 'ws-submit-button',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<button [type]="type()" [disabled]="isDisabled()" [attr.aria-disabled]="isDisabled() ? 'true' : null"
			[attr.aria-busy]="submitting() ? 'true' : null" [attr.aria-describedby]="disabledReason() ? reasonId : null"
			[class]="buttonClass()">
			{{ submitting() ? submittingLabel() : label() }}
		</button>
		@if (disabledReason(); as reason) {
			<p [id]="reasonId" data-testid="disabled-reason" class="mt-2 text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-400">{{ reason }}</p>
		}
	`,
})
export class SubmitButtonComponent {
	readonly label = input.required<string>();
	readonly submittingLabel = input('جارٍ الإرسال...');
	readonly submitting = input(false);
	/** Visible Arabic reason the action is unavailable right now (e.g. "بانتظار مراجعة طلبك السابق"). */
	readonly disabledReason = input<string | null>(null);
	readonly type = input<'submit' | 'button'>('submit');
	readonly buttonClass = input(
		'w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-bold text-white transition-all hover:from-cyan-400 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
	);

	protected readonly reasonId = `ws-submit-reason-${nextId++}`;
	protected readonly isDisabled = computed(() => this.submitting() || !!this.disabledReason());
}
