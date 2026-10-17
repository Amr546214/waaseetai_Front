import { FieldProblem, reportProblems, clearInvalid } from '../../../../shared/forms/form-error-focus';
import { mapHttpError } from '../../../../core/forms/http-error';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';

/** Shared rules + wiring of the two "open a support ticket" forms (new-ticket page and the live-support composer). */
export const TICKET_MIN_SUBJECT = 5;
export const TICKET_MIN_DESCRIPTION = 20;

export type TicketField = 'subject' | 'category' | 'description' | 'relatedOrder' | 'ccEmail';

export interface TicketDraft { subject: string; category: string; description: string }

/** The control for a ticket field. A ws-select is represented by its trigger button (the host itself cannot take focus). */
export function ticketFieldEl(root: ParentNode, name: string): HTMLElement | null {
	const host = root.querySelector<HTMLElement>(`[name="${name}"]`);
	if (!host) return null;
	return host.tagName === 'WS-SELECT' ? host.querySelector<HTMLElement>('button') : host;
}

/** Missing / too short fields in the order given (the order of the form on screen). */
export function ticketProblems(root: ParentNode, d: TicketDraft, order: TicketField[]): FieldProblem[] {
	const out: FieldProblem[] = [];
	for (const f of order) {
		let message = '';
		if (f === 'category' && !d.category.trim()) message = 'اختر التصنيف';
		else if (f === 'subject') {
			const n = d.subject.trim().length;
			if (!n) message = 'أدخل عنوان التذكرة';
			else if (n < TICKET_MIN_SUBJECT) message = `العنوان قصير جدًا، اكتب ${TICKET_MIN_SUBJECT} أحرف على الأقل`;
		} else if (f === 'description') {
			const n = d.description.trim().length;
			if (!n) message = 'صف مشكلتك';
			else if (n < TICKET_MIN_DESCRIPTION) message = `الوصف قصير جدًا، اكتب ${TICKET_MIN_DESCRIPTION} حرفًا على الأقل`;
		}
		if (message) out.push({ field: f, message, el: ticketFieldEl(root, f) });
	}
	return out;
}

/** A field was edited / picked: its error mark goes away (a ws-select raises no input event). */
export function clearTicketField(root: ParentNode, name: string): void {
	const el = ticketFieldEl(root, name);
	if (el) clearInvalid(el);
}

/**
 * A failed create call. Only a 400/422 that names ticket fields is shown at those fields; everything else (network, 429,
 * 5xx, 403, 409 ...) stays ONE honest generic toast and never marks a field.
 */
export async function reportTicketError(root: ParentNode, err: unknown, notify: UiNotificationService, fallback: string): Promise<void> {
	const mapped = mapHttpError(err, { fallback });
	if (mapped.kind === 'backend-validation') {
		const problems: FieldProblem[] = [];
		for (const [name, message] of Object.entries(mapped.fieldErrors)) {
			const el = ticketFieldEl(root, name);
			if (el) problems.push({ field: name, message, el });
		}
		if (problems.length) {
			const res = await reportProblems(root, problems);
			if (res.focused && res.unresolved.length === 0) return;
		}
	}
	notify.error(mapped.message);
}
