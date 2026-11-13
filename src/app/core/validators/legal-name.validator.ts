import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Same rule as the backend (utils/legal-name.ts): the legal name = the name on the identity document, at least two name parts, letters only (Arabic or Latin). */
export const LEGAL_NAME_MAX = 120;
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;
const NAME_CHARS = /^[\p{Script=Arabic}\p{Script=Latin}][\p{Script=Arabic}\p{Script=Latin} '’.\-]*$/u;
const DIGITS = /[٠-٩۰-۹\d]/;

export const cleanLegalName = (v: unknown): string => String(v ?? '').replace(INVISIBLE, '').normalize('NFC').replace(/\s+/g, ' ').trim();

export function legalNameProblem(raw: unknown): string | null {
	const v = cleanLegalName(raw);
	if (!v) return null; // required is a separate validator
	if (v.length > LEGAL_NAME_MAX) return `الاسم الحقيقي يجب ألا يزيد على ${LEGAL_NAME_MAX} حرفًا.`;
	if (DIGITS.test(v) || !NAME_CHARS.test(v)) return 'الاسم الحقيقي يقبل حروفًا عربية أو لاتينية فقط، دون أرقام أو رموز.';
	const letters = v.replace(/[^\p{L}]/gu, '').length;
	if (letters < 4) return 'الاسم الحقيقي قصير جدًا.';
	if (v.split(' ').filter(p => p.replace(/[^\p{L}]/gu, '').length >= 2).length < 2) return 'اكتب الاسم الحقيقي من جزأين على الأقل (الاسم الأول واسم العائلة) كما في الهوية.';
	return null;
}

/** Sets `server` (shown by validationMessage) so the exact reason is the message. */
export function legalNameValidator(control: AbstractControl): ValidationErrors | null {
	const problem = legalNameProblem(control.value);
	return problem ? { server: problem } : null;
}
