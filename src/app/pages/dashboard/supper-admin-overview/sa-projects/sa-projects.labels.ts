// Display labels / css classes for the super-admin projects + contracts pages.
// Keys are the backend enum values (ProjectStatus, ContractStatus, escrow status);
// nothing here is data, only wording and class names.

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  PENDING_SIGNATURE: 'بانتظار التوقيع',
  PENDING_REVIEW: 'قيد المراجعة',
  OPEN: 'مفتوح',
  IN_PROGRESS: 'جارٍ',
  AWAITING_DELIVERY: 'بانتظار التسليم',
  PENDING_APPROVAL: 'بانتظار اعتماد العميل',
  COMPLETED: 'مكتمل',
  DISPUTED: 'متنازع عليه',
};

export const PROJECT_STATUS_CLASSES: Record<string, string> = {
  DRAFT: 'pj-st-cancelled',
  PENDING_SIGNATURE: 'pj-st-review',
  PENDING_REVIEW: 'pj-st-review',
  OPEN: 'pj-st-active',
  IN_PROGRESS: 'pj-st-active',
  AWAITING_DELIVERY: 'pj-st-review',
  PENDING_APPROVAL: 'pj-st-review',
  COMPLETED: 'pj-st-completed',
  DISPUTED: 'pj-st-late',
};

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  PENDING_CLIENT_SIGNATURE: 'بانتظار توقيع الطالب',
  PENDING_PAYMENT: 'بانتظار الدفع',
  PENDING_PROVIDER_SIGNATURE: 'بانتظار توقيع المقدم',
  ACTIVE: 'نشط',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  DISPUTED: 'متنازع عليه',
};

export const CONTRACT_STATUS_CLASSES: Record<string, string> = {
  PENDING_CLIENT_SIGNATURE: 'ct-st-escrow',
  PENDING_PAYMENT: 'ct-st-escrow',
  PENDING_PROVIDER_SIGNATURE: 'ct-st-escrow',
  ACTIVE: 'ct-st-active',
  COMPLETED: 'ct-st-completed',
  CANCELLED: 'ct-st-cancelled',
  DISPUTED: 'ct-st-dispute',
};

export const ESCROW_STATUS_LABELS: Record<string, string> = {
  HELD: 'محتجز',
  RELEASED: 'مُفرَج',
  REFUNDED: 'مُسترَد',
};

export const ESCROW_STATUS_CLASSES: Record<string, string> = {
  HELD: 'ct-esc-held',
  RELEASED: 'ct-esc-released',
  REFUNDED: 'ct-esc-refunded',
};

export const STAGE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'لم تبدأ',
  IN_PROGRESS: 'جارية',
  SUBMITTED: 'بانتظار المراجعة',
  PENDING_APPROVAL: 'بانتظار الاعتماد',
  APPROVED: 'معتمدة',
  REJECTED: 'مرفوضة',
  REVISION_REQUESTED: 'مطلوب تعديل',
};

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  SUBMITTED: 'قيد المراجعة',
  PENDING_REVIEW: 'قيد المراجعة',
  APPROVED: 'مقبول',
  ACCEPTED: 'مقبول',
  REJECTED: 'مرفوض',
  REVISION_REQUESTED: 'مطلوب تعديل',
};

export const DELIVERY_STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'pj-dstatus-accepted',
  ACCEPTED: 'pj-dstatus-accepted',
  REJECTED: 'pj-dstatus-rejected',
  REVISION_REQUESTED: 'pj-dstatus-rejected',
};

export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  OPEN: 'مفتوح',
  UNDER_REVIEW: 'قيد المراجعة',
  RESOLVED: 'تمت التسوية',
  REJECTED: 'مرفوض',
  CLOSED: 'مغلق',
};

export const AMENDMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  APPROVED: 'موافق عليه',
  ACCEPTED: 'موافق عليه',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغى',
};

/** Shown next to every disabled financial control: the backend has no such operation. */
export const FINANCE_ACTION_DISABLED_REASON =
  'الاسترداد/التحرير اليدوي غير مفعّل: يحتاج قرار سياسة مالية';

export const FINANCE_ACTION_NOTE =
  'تنتقل الأموال فقط عند اعتماد العميل للمرحلة. الإجراءات المالية اليدوية (تحرير / تجميد / استرداد / إلغاء) غير متاحة لأن سياسة الرسوم لم تحدد دلالاتها بعد.';

/** Initials of a real name (first letters of the first two words). Empty when there is no name. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.slice(0, 2).map((p) => Array.from(p)[0]).join('');
}

export function label(map: Record<string, string>, key: string | null | undefined): string {
  return key ? (map[key] ?? key) : '';
}
