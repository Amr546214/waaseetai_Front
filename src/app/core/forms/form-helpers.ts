import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { take } from 'rxjs';
import { validationMessage } from './validation-messages';

/** One field that blocks the submit: where it is, what the user calls it, and why it is invalid. */
export interface InvalidField {
	/** Dotted path inside the form ("details.city"). */
	path: string;
	/** Arabic label from the `labels` map (falls back to the control name). */
	label: string;
	/** Arabic reason ("البريد الإلكتروني مطلوب"). */
	message: string;
}

export interface SubmitAttempt {
	valid: boolean;
	missing: InvalidField[];
}

/** `labels` maps a control name or dotted path to its Arabic label. Path wins over name. */
export type FieldLabels = Record<string, string>;

function labelFor(path: string, name: string, labels: FieldLabels): string {
	return labels[path] ?? labels[name] ?? name;
}

/** Every enabled, invalid leaf control (and group-level errors such as password mismatch), in form order. */
export function collectInvalidFields(control: AbstractControl, labels: FieldLabels = {}, basePath = ''): InvalidField[] {
	const out: InvalidField[] = [];
	const childrenOf = (c: AbstractControl): [string, AbstractControl][] =>
		c instanceof FormGroup ? Object.entries(c.controls)
			: c instanceof FormArray ? c.controls.map((x, i): [string, AbstractControl] => [String(i), x])
				: [];
	const walk = (c: AbstractControl, path: string, name: string) => {
		if (c.disabled) return;
		const children = childrenOf(c);
		if (children.length || c instanceof FormGroup || c instanceof FormArray) {
			for (const [key, child] of children) walk(child, path ? `${path}.${key}` : key, key);
			// A group's own errors come only from its group validators (cross-field rules such as password mismatch).
			if (c.errors) {
				const label = path ? labelFor(path, name, labels) : '';
				out.push({ path, label, message: validationMessage(c.errors, label || undefined) || '' });
			}
			return;
		}
		if (c.invalid) {
			const label = labelFor(path, name, labels);
			out.push({ path, label, message: validationMessage(c.errors, label) || '' });
		}
	};
	walk(control, basePath, basePath.split('.').pop() ?? '');
	return out;
}

const INVALID_SELECTOR = 'input.ng-invalid, select.ng-invalid, textarea.ng-invalid, [formcontrolname].ng-invalid, [aria-invalid="true"]';

/**
 * Moves focus (and scroll) to the first invalid field inside `root`, in DOM order. Skips containers, hidden and
 * disabled elements. Returns the element it focused, or null when nothing focusable is invalid (e.g. the field lives
 * on another wizard step that is not rendered).
 */
export function focusFirstInvalid(root: ParentNode | null | undefined): HTMLElement | null {
	if (!root) return null;
	const candidates = Array.from(root.querySelectorAll<HTMLElement>(INVALID_SELECTOR));
	for (const el of candidates) {
		if (el.tagName === 'FORM' || el.hasAttribute('formgroupname') || el.hasAttribute('formarrayname')) continue;
		if ((el as HTMLInputElement).disabled || el.getAttribute('aria-hidden') === 'true') continue;
		if ((el as HTMLInputElement).type === 'hidden') continue;
		if (typeof el.focus !== 'function') continue;
		el.focus({ preventScroll: true });
		if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' });
		return el;
	}
	return null;
}

/**
 * Call at the top of every submit handler:
 *   const attempt = attemptSubmit(this.form, { root: this.host.nativeElement, labels: LABELS });
 *   if (!attempt.valid) { this.missing.set(attempt.missing); return; }
 *
 * It marks every control touched (so each field shows its own error), collects what is missing for the summary, and
 * focuses the first invalid control. The submit button itself stays enabled, the user always gets feedback.
 */
export function attemptSubmit(form: AbstractControl, options: { root?: ParentNode | null; labels?: FieldLabels } = {}): SubmitAttempt {
	form.markAllAsTouched();
	form.updateValueAndValidity({ emitEvent: false });
	if (form.valid) return { valid: true, missing: [] };
	const missing = collectInvalidFields(form, options.labels ?? {});
	focusFirstInvalid(options.root);
	return { valid: false, missing };
}

function findControlsByName(form: AbstractControl, name: string): AbstractControl[] {
	const direct = form.get(name);
	if (direct) return [direct];
	const found: AbstractControl[] = [];
	const walk = (c: AbstractControl) => {
		if (c instanceof FormGroup) {
			for (const [key, child] of Object.entries(c.controls)) {
				if (key === name) found.push(child);
				walk(child);
			}
		} else if (c instanceof FormArray) {
			c.controls.forEach(walk);
		}
	};
	walk(form);
	return found;
}

/**
 * Puts server field messages (MappedHttpError.fieldErrors) on the matching controls as a `server` error, marks them
 * touched, and clears the error as soon as the user edits that field. Returns the field names that matched no control,
 * so the caller can show them in the banner instead of dropping them.
 */
export function applyServerFieldErrors(form: AbstractControl, fieldErrors: Record<string, string>): string[] {
	const unmatched: string[] = [];
	for (const [name, message] of Object.entries(fieldErrors)) {
		const controls = findControlsByName(form, name);
		if (!controls.length) { unmatched.push(name); continue; }
		for (const c of controls) {
			c.setErrors({ ...(c.errors ?? {}), server: message });
			c.markAsTouched();
			c.valueChanges.pipe(take(1)).subscribe(() => {
				if (!c.errors?.['server']) return;
				const { server, ...rest } = c.errors;
				c.setErrors(Object.keys(rest).length ? rest : null);
			});
		}
	}
	return unmatched;
}
