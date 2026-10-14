/**
 * What an amendment decision does. The backend sends `effect` on every amendment:
 *  - APPLIED     the approval changed the contract / escrow / stages in one step (appliedAt is set);
 *  - RECORD_ONLY a LEGACY approved row, recorded before amendments became effective: it never changed anything and is never re-applied;
 *  - PENDING     waiting for the other party; nothing changes before their approval;
 *  - NONE        rejected or cancelled: nothing changed.
 * One place for the wording so no screen presents a legacy row as applied (or an applied one as "record only").
 */
export type AmendmentEffect = 'APPLIED' | 'RECORD_ONLY' | 'PENDING' | 'NONE';

/** Legacy wording: ONLY for effect === 'RECORD_ONLY' rows. */
export const AMENDMENT_EFFECT_NOTE = 'القرار يُسجَّل للمتابعة فقط ولا يغيّر سعر العقد أو مدته أو الضمان حاليًا.';
export const AMENDMENT_RECORDED_BADGE = 'مُسجَّل — لا يغيّر العقد';
export const AMENDMENT_APPLIED_BADGE = 'طُبّق على العقد';
export const AMENDMENT_APPLIED_NOTE = 'طُبّق التعديل على العقد والضمان والمراحل.';
export const AMENDMENT_PENDING_NOTE = 'لن يتغيّر العقد أو الضمان أو المحفظة قبل موافقة الطرف الآخر، وعند الموافقة يُطبَّق التعديل فورًا.';
export const AMENDMENT_NONE_NOTE = 'لم يتغيّر شيء في العقد.';
export const AMENDMENT_PROPOSED_CHANGE_LABEL = 'تغيير مقترح';
/** Rejecting never changes anything; the approve text is built per amendment (amendmentApproveText). */
export const AMENDMENT_REJECT_CONFIRM_TEXT = 'سيُرفض الطلب ولن يتغير شيء في العقد أو المحفظة.';
export const AMENDMENT_DEPOSIT_ROUTE = '/client-overview/finance/wallet';

export interface AmendmentLike {
	type?: string; status?: string; requestedByRole?: string;
	budgetDelta?: number | null; durationDeltaDays?: number | null; description?: string | null;
	effect?: string | null; effectNote?: string | null;
	needsClientPayment?: boolean; fundingAuthorized?: boolean;
	contractPrice?: number | null; contractDurationDays?: number | null;
	priceBefore?: number | null; priceAfter?: number | null; durationBefore?: number | null; durationAfter?: number | null;
}

/** The effect of a row; rows from an older API (no `effect`) are read as legacy record-only when approved. */
export function amendmentEffect(a: AmendmentLike | null | undefined): AmendmentEffect {
	const e = a?.effect;
	if (e === 'APPLIED' || e === 'RECORD_ONLY' || e === 'PENDING' || e === 'NONE') return e;
	if (a?.status === 'APPROVED') return 'RECORD_ONLY';
	if (a?.status === 'PENDING_OTHER_PARTY') return 'PENDING';
	return 'NONE';
}

export function amendmentEffectNote(a: AmendmentLike | null | undefined): string {
	if (a?.effectNote) return a.effectNote;
	switch (amendmentEffect(a)) {
		case 'APPLIED': return AMENDMENT_APPLIED_NOTE;
		case 'RECORD_ONLY': return AMENDMENT_EFFECT_NOTE;
		case 'PENDING': return AMENDMENT_PENDING_NOTE;
		default: return AMENDMENT_NONE_NOTE;
	}
}

/** The badge of an answered amendment (APPROVED row): applied vs legacy record-only. */
export function amendmentApprovedBadge(a: AmendmentLike | null | undefined): string {
	return amendmentEffect(a) === 'APPLIED' ? AMENDMENT_APPLIED_BADGE : AMENDMENT_RECORDED_BADGE;
}

/** The budget part that really takes effect, by TYPE (a description on a BUDGET/DURATION request is only the reason). */
export function amendmentBudgetPart(a: AmendmentLike | null | undefined): number {
	const t = a?.type;
	const v = Number(a?.budgetDelta);
	return (t === 'BUDGET' || t === 'MIXED') && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
export function amendmentDaysPart(a: AmendmentLike | null | undefined): number {
	const t = a?.type;
	const v = Number(a?.durationDeltaDays);
	return (t === 'DURATION' || t === 'MIXED') && Number.isFinite(v) ? Math.trunc(v) : 0;
}

/** A budget INCREASE needs the client's OTP-authorized payment. */
export function amendmentNeedsPayment(a: AmendmentLike | null | undefined): boolean {
	return typeof a?.needsClientPayment === 'boolean' ? a.needsClientPayment : amendmentBudgetPart(a) > 0;
}

export interface AmendmentEffectLine { label: string; value: string }

const money = (n: number) => `${(Math.round(Math.abs(n) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`;

/**
 * The financial effect shown BEFORE the user confirms an approval: the amount, the new contract price, the new stage. Only what the backend will
 * really do (see applyAmendment): an increase debits the client wallet and adds a last stage; a decrease refunds the wallet and shrinks the last
 * unreleased stages; a duration change only moves days; a scope change adds a versioned addendum.
 */
export function amendmentEffectLines(a: AmendmentLike | null | undefined): AmendmentEffectLine[] {
	const lines: AmendmentEffectLine[] = [];
	const budget = amendmentBudgetPart(a);
	const days = amendmentDaysPart(a);
	const price = typeof a?.contractPrice === 'number' ? a.contractPrice : null;
	if (budget > 0) {
		lines.push({ label: 'يُخصم من محفظة العميل', value: money(budget) });
		if (price !== null) lines.push({ label: 'سعر العقد بعد التعديل', value: `${money(price)} ← ${money(price + budget)}` });
		lines.push({ label: 'مرحلة جديدة في آخر العقد', value: money(budget) });
		lines.push({ label: 'الضمان', value: `يزيد ${money(budget)}` });
	} else if (budget < 0) {
		lines.push({ label: 'يُردّ إلى محفظة العميل', value: money(budget) });
		if (price !== null) lines.push({ label: 'سعر العقد بعد التعديل', value: `${money(price)} ← ${money(price + budget)}` });
		lines.push({ label: 'المراحل', value: 'تُخفَّض المراحل غير المسلَّمة فقط، ولا تُمسّ مرحلة مسلَّمة أو مُفرَجة' });
	}
	if (days !== 0) {
		const d = typeof a?.contractDurationDays === 'number' ? a.contractDurationDays : null;
		lines.push({ label: 'مدة العقد', value: d !== null ? `${d} ← ${d + days} يومًا` : `${days > 0 ? '+' : '-'}${Math.abs(days)} يومًا` });
	}
	if ((a?.type === 'SCOPE' || a?.type === 'MIXED') && a?.description?.trim()) lines.push({ label: 'النطاق', value: 'يُضاف ملحق نطاق جديد بنسخة مرقّمة من شروط العقد' });
	return lines;
}

/** The confirmation sentence of an approval: says what REALLY happens. */
export function amendmentApproveText(a: AmendmentLike | null | undefined, answeredBy: 'client' | 'provider'): string {
	const budget = amendmentBudgetPart(a);
	if (budget > 0 && answeredBy === 'client') return 'بموافقتك يُطبَّق التعديل فورًا على العقد، ويُخصم المبلغ من محفظتك بعد إدخال رمز التحقق.';
	if (budget > 0) return 'بموافقتك يُطبَّق التعديل فورًا على العقد، ويُخصم المبلغ من محفظة العميل الذي اعتمد الدفع مسبقًا.';
	return 'بموافقتك يُطبَّق التعديل فورًا على العقد.';
}
