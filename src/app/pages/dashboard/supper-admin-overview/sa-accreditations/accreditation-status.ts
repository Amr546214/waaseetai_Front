import { AccreditationSample, AccreditationStatus } from '../../../../core/models/accreditation.model';

// Honest labels for the sample status. Backend truth: a new sample is stored as MANUAL_REVIEW (the AI audit is switched off), so
// PENDING_AI_AUDIT only appears on old rows that still wait for an AI audit that will not run. AI_VERIFIED also means "a stored
// AI result exists" on old rows, so "approved" is only claimed when the linked specialty really is APPROVED.
export const STATUS_LABELS: Record<AccreditationStatus, string> = {
  PENDING_AI_AUDIT: 'بانتظار التدقيق الآلي (متوقف)',
  AI_VERIFIED: 'معتمد',
  REJECTED: 'مرفوض',
  MANUAL_REVIEW: 'بانتظار المراجعة اليدوية',
};

export const STATUS_CLASSES: Record<AccreditationStatus, string> = {
  PENDING_AI_AUDIT: 'acc-st-pending',
  AI_VERIFIED: 'acc-st-verified',
  REJECTED: 'acc-st-rejected',
  MANUAL_REVIEW: 'acc-st-manual',
};

const AI_STORED_AWAITING = 'تقييم AI مخزّن — بانتظار قرار الإدارة';

export function sampleStatusLabel(s: Pick<AccreditationSample, 'status' | 'providerSpecialty'>): string {
  if (s.status === 'AI_VERIFIED' && s.providerSpecialty?.status !== 'APPROVED') return AI_STORED_AWAITING;
  return STATUS_LABELS[s.status] ?? String(s.status);
}

export function sampleStatusClass(s: Pick<AccreditationSample, 'status' | 'providerSpecialty'>): string {
  if (s.status === 'AI_VERIFIED' && s.providerSpecialty?.status !== 'APPROVED') return 'acc-st-manual';
  return STATUS_CLASSES[s.status] ?? '';
}

/** Admin route of the provider profile, or null when the sample carries no owner id. */
export function providerProfileLink(s: Pick<AccreditationSample, 'providerProfile'>): string[] | null {
  const id = s.providerProfile?.userId || s.providerProfile?.user?.id;
  return id ? ['/supper-admin-overview/users', id] : null;
}
