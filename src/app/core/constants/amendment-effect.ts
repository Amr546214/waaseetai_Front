/**
 * Amendment decisions are RECORD-ONLY: approving or rejecting a change request never changes the contract
 * price, duration or escrow (the backend sends effect: 'RECORD_ONLY' and an effectNote on every amendment).
 * One place for the wording so no screen can present an answered amendment as if it were applied.
 */
export const AMENDMENT_EFFECT_NOTE = 'القرار يُسجَّل للمتابعة فقط ولا يغيّر سعر العقد أو مدته أو الضمان حاليًا.';
export const AMENDMENT_RECORDED_BADGE = 'مُسجَّل — لا يغيّر العقد';
export const AMENDMENT_PROPOSED_CHANGE_LABEL = 'تغيير مقترح';
export const AMENDMENT_CONFIRM_TEXT = 'سيُسجَّل قرارك للمتابعة فقط، ولن يتغير سعر العقد أو مدته أو الضمان بسببه.';

export function amendmentEffectNote(a: { effectNote?: string | null } | null | undefined): string {
	return a?.effectNote || AMENDMENT_EFFECT_NOTE;
}
