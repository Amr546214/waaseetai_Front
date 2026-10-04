import { Component, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { validationMessage } from '../../core/forms/validation-messages';

/**
 * Inline Arabic error for ONE control. Shows once the control is touched/dirty and invalid, so it appears under the
 * field on a failed submit attempt (attemptSubmit marks everything touched) and while the user is fixing it.
 * (Default change detection on purpose: touched/dirty are plain properties, not signals, so OnPush would never re-render
 * when a submit attempt marks the control touched.)
 * `messages` overrides the text per error key (e.g. { required: 'يجب الموافقة على الشروط للمتابعة' }).
 */
@Component({
	selector: 'ws-field-error',
	standalone: true,
	template: `
		@if (message(); as msg) {
			<span role="alert" data-testid="field-error" class="mt-1 block text-[11px] font-bold leading-relaxed text-red-500">{{ msg }}</span>
		}
	`,
})
export class FieldErrorComponent {
	readonly control = input<AbstractControl | null | undefined>(null);
	readonly label = input<string | undefined>(undefined);
	readonly messages = input<Record<string, string>>({});

	protected message(): string | null {
		const c = this.control();
		if (!c || !(c.touched || c.dirty) || c.valid || c.disabled) return null;
		const errors = c.errors;
		if (!errors) return null;
		const custom = this.messages();
		for (const key of Object.keys(errors)) {
			if (custom[key]) return custom[key];
		}
		return validationMessage(errors, this.label());
	}
}
