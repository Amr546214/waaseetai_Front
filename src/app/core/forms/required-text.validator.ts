import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Spaces, NBSP and the invisible zero-width characters (ZWSP/ZWNJ/ZWJ/word-joiner/BOM) all count as "nothing typed". */
const BLANK = /[\s ​-‍⁠﻿]/g;

export function isBlankText(value: unknown): boolean {
	return String(value ?? '').replace(BLANK, '') === '';
}

/** Required text that is not accepted when it holds only whitespace / invisible characters. Error key `required` (the central red message). No length rule. */
export const requiredText: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
	isBlankText(control.value) ? { required: true } : null;
