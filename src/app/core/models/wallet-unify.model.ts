/** Wallet unification (display + data linking): shapes of the additive backend fields. Every value comes from the stored record of the operation. */

export type WalletNetMeaning = 'ADDED_TO_WALLET' | 'WITHDRAWABLE' | 'LOCKED_IN_ESCROW' | 'RETURNED_TO_WALLET' | 'DEBITED_FROM_WALLET' | 'COMMISSION_EARNED' | 'HELD';

export interface WalletDeduction {
	code: string;
	label: string;
	amount: number;
	ratePercent: number | null;
	level: number | null;
	levelRecorded: boolean;
	reason: string;
}

export interface WalletBreakdown {
	operation: string;
	operationLabel: string;
	currency: string;
	detailsRecorded: boolean;
	missingNote: string | null;
	gross: number | null;
	deductions: WalletDeduction[];
	net: number | null;
	netMeaning: WalletNetMeaning;
	note: string | null;
}

export type WalletCardState = 'AVAILABLE' | 'UNAVAILABLE' | 'NOT_ENABLED' | 'NOT_APPLICABLE';

export interface WalletCard {
	value: number | null;
	currency: string;
	state: WalletCardState;
	label: string;
	covers: string[];
	complete: boolean;
	operationsCounted: number;
	operationsWithoutDetails: number;
	excludedOtherCurrency: number;
	note: string | null;
	/** provider: released amounts that have no itemised line (e.g. a dispute resolution) */
	releasedWithoutLine?: number;
}

export interface WalletPagination { page: number; limit: number; total: number; totalPages: number }

export const MISSING_DETAILS_TEXT = 'تفاصيل الخصم غير مسجّلة';

const OPERATION_COVERS_LABEL: Record<string, string> = {
	DEPOSIT: 'الإيداعات', STAGE_RELEASE: 'إفراج دفعات المراحل', ESCROW_RELEASE: 'إفراج الضمان', CANCELLATION_SETTLEMENT: 'تسوية الإلغاء المتبادل', COMMISSION: 'العمولات المؤكدة والمدفوعة',
};
export function coversLabel(covers: string[] | undefined): string {
	return (covers ?? []).map(c => OPERATION_COVERS_LABEL[c] ?? c).join('، ');
}

const NET_MEANING_LABEL: Record<WalletNetMeaning, string> = {
	ADDED_TO_WALLET: 'اللي اتضاف للمحفظة', WITHDRAWABLE: 'صافي أرباحك القابل للسحب', LOCKED_IN_ESCROW: 'المحجوز في الضمان', RETURNED_TO_WALLET: 'اللي رجع للمحفظة',
	DEBITED_FROM_WALLET: 'المخصوم من الرصيد', COMMISSION_EARNED: 'صافي العمولة', HELD: 'المحتجز',
};
export function netMeaningLabel(m: WalletNetMeaning | string | undefined): string {
	return NET_MEANING_LABEL[m as WalletNetMeaning] ?? 'الصافي';
}

/** USD is shown as "$"; any other stored currency is shown by its own code, never as dollars. */
export function currencySymbol(code: string | undefined | null): string {
	return !code || code === 'USD' ? '$' : code;
}
