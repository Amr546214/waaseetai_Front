import { AccreditationSample, AccreditationStatus, AdminProofItem } from '../../../../core/models/accreditation.model';

// Honest labels for the sample status. Backend truth: a new sample is stored as MANUAL_REVIEW (the AI audit is switched off), so
// PENDING_AI_AUDIT only appears on old rows that still wait for an AI audit that will not run. AI_VERIFIED also means "a stored
// AI result exists" on old rows, so "approved" is only claimed when the linked specialty really is APPROVED.
// SAMPLE status (AccreditationSample.status) vs SPECIALTY status (ProviderSpecialty.status). Display only; stored values are never changed.
//   sample MANUAL_REVIEW      new submission waiting for a human (the AI audit is off)      -> 'بانتظار المراجعة اليدوية'
//   sample PENDING_AI_AUDIT   old rows still waiting for an AI audit that will not run      -> 'بانتظار التدقيق الآلي (متوقف)'
//   sample AI_VERIFIED        the stored value of an APPROVED sample (admin approve writes it) and of old rows with a stored AI result;
//                             shown as 'معتمد' ONLY when the linked specialty is APPROVED, otherwise as 'تقييم AI مخزّن — بانتظار قرار الإدارة'
//   sample REJECTED           admin rejection (reason in userNote + the marked text of aiFeedbackAr)  -> 'مرفوض'
//   sample NEEDS_COMPLETION   the admin asked the provider to complete the request                      -> 'بانتظار استكمال البيانات من مقدم الخدمة'
//   specialty UNDER_AI_REVIEW the specialty-level queue state (samples submitted, waiting for the admin); it is NOT a sample status and is never
//                             shown as one on this page. The specialty-level decision moves the waiting samples with it.
export const STATUS_LABELS: Record<AccreditationStatus, string> = {
  PENDING_AI_AUDIT: 'بانتظار التدقيق الآلي (متوقف)',
  AI_VERIFIED: 'معتمد',
  REJECTED: 'مرفوض',
  MANUAL_REVIEW: 'بانتظار المراجعة اليدوية',
  NEEDS_COMPLETION: 'بانتظار استكمال البيانات من مقدم الخدمة',
};

export const STATUS_CLASSES: Record<AccreditationStatus, string> = {
  PENDING_AI_AUDIT: 'acc-st-pending',
  AI_VERIFIED: 'acc-st-verified',
  REJECTED: 'acc-st-rejected',
  MANUAL_REVIEW: 'acc-st-manual',
  NEEDS_COMPLETION: 'acc-st-manual',
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

/** Marker the backend appends to `aiFeedbackAr` when an admin rejects (provider flows read it too, so it is kept as stored). */
export const ADMIN_REASON_MARK = '[مراجعة الإدارة] سبب الرفض:';

/**
 * Splits the stored `aiFeedbackAr` into the real AI evaluation text and the admin's rejection reason, so the reason is never displayed inside
 * the AI card. `reason` prefers the dedicated `userNote` (the note addressed to the provider), then the marked text.
 */
export function splitAdminDecision(s: Pick<AccreditationSample, 'aiFeedbackAr' | 'userNote'>): { aiText: string; reason: string } {
  const raw = s.aiFeedbackAr || '';
  const at = raw.indexOf(ADMIN_REASON_MARK);
  const aiText = (at >= 0 ? raw.slice(0, at) : raw).trim();
  const marked = at >= 0 ? raw.slice(at + ADMIN_REASON_MARK.length).trim() : '';
  return { aiText, reason: (s.userNote || '').trim() || marked };
}

/**
 * The proofs to render, from whatever the server sent. The documented shape is `proofs`; when it is missing (an older server) they are derived from
 * `proofUploads` + `attachments`. Null / empty / non-string entries are dropped, so a bad entry can never break the page.
 */
export function normalizeProofs(s: Pick<AccreditationSample, 'id' | 'proofs' | 'proofUploads' | 'attachments'> | null | undefined): AdminProofItem[] {
  if (!s) return [];
  if (Array.isArray(s.proofs)) {
    return s.proofs.filter((p): p is AdminProofItem => !!p && typeof p === 'object').map((p, i) => ({ ...p, key: p.key || `p:${i}`, fileName: (typeof p.fileName === 'string' && p.fileName) || `مرفق-${i + 1}` }));
  }
  const out: AdminProofItem[] = [];
  for (const u of Array.isArray(s.proofUploads) ? s.proofUploads : []) {
    if (!u || typeof u !== 'object' || !u.id) continue;
    out.push({ key: `u:${u.id}`, source: 'UPLOAD', id: u.id, fileName: u.fileName || 'ملف إثبات', mimeType: u.mimeType ?? null, bytes: u.bytes ?? null, createdAt: u.createdAt ?? null, url: null, access: { document: 'accreditation_upload', id: u.id }, available: null });
  }
  (Array.isArray(s.attachments) ? s.attachments : []).forEach((a, i) => {
    if (typeof a !== 'string' || !a.trim()) return;
    const web = /^https?:\/\//i.test(a);
    out.push({ key: `a:${i}`, source: web ? 'LEGACY_URL' : 'LEGACY_INLINE', id: null, fileName: proofFileName(a, i), mimeType: null, bytes: null, createdAt: null, url: web ? a : null, access: null, available: null });
  });
  return out;
}

/** Display name for a stored value; never throws (null, a data URI, a bare name or an URL all give a short readable name). */
export function proofFileName(value: unknown, index: number): string {
  const fallback = `مرفق-${index + 1}`;
  if (typeof value !== 'string' || !value || value.startsWith('data:')) return fallback;
  const raw = value.split('?')[0].split('#')[0].split('/').pop() || '';
  let name = raw;
  try { name = decodeURIComponent(raw); } catch { /* keep the raw text */ }
  return name.trim().slice(0, 120) || fallback;
}
