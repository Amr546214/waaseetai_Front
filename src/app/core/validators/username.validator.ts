import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Same rule as the backend (utils/username.ts): ONE field, a single word is fine, letters (Arabic/Latin), digits, space, _ . - ; no links or addresses. Not the legal name. */
export const USERNAME_MIN = 2;
export const USERNAME_MAX = 60;
const INVISIBLE = /[​-‏‪-‮⁠﻿]/g;
const ALLOWED = /^[\p{Script=Arabic}\p{Script=Latin}\d٠-٩][\p{Script=Arabic}\p{Script=Latin}\d٠-٩ _.\-]*$/u;
export const cleanUsername = (v: unknown): string => String(v ?? '').replace(INVISIBLE, '').normalize('NFC').replace(/\s+/g, ' ').trim();

export function usernameProblem(raw: unknown): string | null {
	const v = cleanUsername(raw);
	if (!v) return null; // required is a separate validator
	if (v.length > USERNAME_MAX) return `اسم المستخدم يجب ألا يزيد على ${USERNAME_MAX} حرفًا.`;
	if (!ALLOWED.test(v) || /[@/\\]|https?:|www\./i.test(v)) return 'اسم المستخدم يقبل حروفًا عربية أو لاتينية وأرقامًا ومسافة و _ . - فقط، دون روابط أو رموز.';
	if (v.replace(/[^\p{L}]/gu, '').length < USERNAME_MIN) return 'اسم المستخدم قصير جدًا.';
	return null;
}
export function usernameValidator(control: AbstractControl): ValidationErrors | null {
	const p = usernameProblem(control.value);
	return p ? { server: p } : null;
}
