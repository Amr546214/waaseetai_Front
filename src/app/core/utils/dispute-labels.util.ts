import { FinancialOutcomeCode } from '../models/dispute.model';

/**
 * Arabic labels for a dispute's stored `resolution`. The backend sends `resolutionLabel` already translated; this is the same table for the
 * places that only hold the raw value (admin presets, older responses). An exact code is translated; any other text is returned verbatim.
 */
export const TEXT_CLOSURE_LABELS_AR: Record<string, string> = {
  MUTUAL_CLOSE: 'إغلاق ودّي باتفاق الطرفين دون أي تغيير مالي',
  NO_FINANCIAL_CHANGE: 'إغلاق النزاع دون أي تغيير مالي',
  REJECTED_INSUFFICIENT_EVIDENCE: 'رفض النزاع لعدم كفاية الأدلة',
};

export const FINANCIAL_OUTCOME_LABELS_AR: Record<FinancialOutcomeCode, string> = {
  REFUND_CLIENT: 'استرداد المبلغ المحتجز للعميل',
  RELEASE_PROVIDER: 'صرف المبلغ المحتجز لمقدم الخدمة',
  SPLIT: 'تقسيم المبلغ المحتجز بين الطرفين',
};

const LEGACY_LABELS_AR: Record<string, string> = {
  RELEASE_TO_PROVIDER: 'قرار إداري بصرف المبلغ لمقدم الخدمة (لم يُنفَّذ ماليًا آليًا)',
  PARTIAL_REFUND: 'قرار إداري باسترداد جزئي (لم يُنفَّذ ماليًا آليًا)',
};

const normalize = (v: string) => v.trim().toUpperCase().replace(/[\s-]+/g, '_');

/** Text shown for a resolution. `executedFinancially` = a financial outcome was really executed for that dispute. */
export function resolutionLabelAr(resolution: string | null | undefined, executedFinancially = false): string {
  const raw = (resolution ?? '').trim();
  if (!raw) return '';
  const code = normalize(raw);
  if (TEXT_CLOSURE_LABELS_AR[code]) return TEXT_CLOSURE_LABELS_AR[code];
  const financial = FINANCIAL_OUTCOME_LABELS_AR[code as FinancialOutcomeCode];
  if (financial) return executedFinancially ? financial : `${financial} (قرار إداري لم يُنفَّذ ماليًا)`;
  if (LEGACY_LABELS_AR[code]) return LEGACY_LABELS_AR[code];
  return raw;
}

/** The label to render for a dispute: the server's `resolutionLabel` when present, else the local translation. */
export function disputeResolutionText(d: { resolution?: string | null; resolutionLabel?: string; financialOutcome?: unknown } | null | undefined): string {
  if (!d) return '';
  return d.resolutionLabel || resolutionLabelAr(d.resolution, !!d.financialOutcome);
}
