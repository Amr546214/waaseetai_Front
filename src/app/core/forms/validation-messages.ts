import { ValidationErrors } from '@angular/forms';

/**
 * Arabic messages for the Angular built-in validators plus the app's own error keys
 * (`mismatch`, `strongPassword`, `iban`, `server`). One place, so every form says the same thing.
 *
 * `label` is the Arabic field name ("البريد الإلكتروني"); it is optional, the message still reads well without it.
 */
export function validationMessage(errors: ValidationErrors | null | undefined, label?: string): string | null {
	if (!errors) return null;
	const name = label?.trim() || '';
	const of = (fallback: string) => (name ? name : fallback);

	// A message returned by the server for this field (see applyServerFieldErrors) always wins.
	const server = errors['server'];
	if (typeof server === 'string' && server) return server;
	if (server && typeof server === 'object' && typeof (server as any).message === 'string') return (server as any).message;

	if (errors['required']) return name ? `${name} مطلوب` : 'هذا الحقل مطلوب';
	if (errors['email']) return 'أدخل بريدًا إلكترونيًا صالحًا مثل name@example.com';
	if (errors['minlength']) {
		const n = errors['minlength'].requiredLength;
		return `${of('القيمة')} يجب ألا تقل عن ${n} ${n >= 11 ? 'حرفًا' : 'أحرف'}`;
	}
	if (errors['maxlength']) {
		const n = errors['maxlength'].requiredLength;
		return `${of('القيمة')} يجب ألا تزيد على ${n} ${n >= 11 ? 'حرفًا' : 'أحرف'}`;
	}
	if (errors['min']) return `${of('القيمة')} يجب ألا تقل عن ${errors['min'].min}`;
	if (errors['max']) return `${of('القيمة')} يجب ألا تزيد على ${errors['max'].max}`;
	if (errors['strongPassword']) return passwordRulesMessage(errors['strongPassword']);
	if (errors['mismatch']) return 'القيمتان غير متطابقتين';
	if (errors['iban']) return 'أدخل رقم IBAN صالحًا';
	if (errors['url']) return 'أدخل رابطًا صالحًا يبدأ بـ http:// أو https://';
	if (errors['pattern']) return name ? `صيغة ${name} غير صحيحة` : 'الصيغة غير صحيحة';
	return name ? `${name} غير صالح` : 'القيمة غير صالحة';
}

/** Lists exactly which password rule is not met (matches the backend: 8+ chars, an uppercase letter, a digit). */
export function passwordRulesMessage(detail?: { minLength?: boolean; uppercase?: boolean; digit?: boolean }): string {
	const missing: string[] = [];
	if (!detail || detail.minLength) missing.push('8 أحرف على الأقل');
	if (!detail || detail.uppercase) missing.push('حرف إنجليزي كبير');
	if (!detail || detail.digit) missing.push('رقم');
	return `كلمة المرور يجب أن تحتوي على: ${missing.join('، ')}`;
}
