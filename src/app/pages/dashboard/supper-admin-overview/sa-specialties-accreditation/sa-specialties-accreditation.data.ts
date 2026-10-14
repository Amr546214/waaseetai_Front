// Types, labels and small helpers for the specialty review pages. There is no sample data here: the list and the detail page read
// GET /admin/accreditation/specialties (+/:id) and decide through POST .../specialties/:id/decision.

/** Tab / filter keys, same words the backend accepts in ?status=. */
export type ReqStatus = 'pending' | 'approved' | 'rejected';
export type FilterKey = 'all' | ReqStatus;
/** Raw status of a provider specialty as the backend returns it. */
export type SpecialtyReviewStatus = 'UNDER_AI_REVIEW' | 'APPROVED' | 'REJECTED';

export interface SpecialtyReviewProvider {
  userId: string | null;
  name: string | null;
  email: string | null;
  accountType?: string | null;
  memberSince?: string | null;
  rating?: number | null;
  completedProjects?: number;
  kycStatus?: string | null;
  yearsOfExperience?: number | null;
  headline?: string | null;
}

export interface SpecialtyReviewScores {
  aiScore: number | null;
  quizScore: number | null;
  latestScore: number | null;
  ownershipCredibility: number | null;
  feasibilityScore?: number | null;
  clarityScore?: number | null;
}

export interface SpecialtyReviewItem {
  id: string;
  status: SpecialtyReviewStatus;
  specialty: { id?: string; nameAr?: string | null; categoryNameAr?: string | null };
  subSpecialties: string[] | null;
  provider: SpecialtyReviewProvider;
  scores: SpecialtyReviewScores;
  accreditationSamples: number;
  workSamples: number;
  badgeGrantedAt: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface SpecialtyReviewCounts { pending: number; approved: number; rejected: number; all: number }

export interface SpecialtyReviewList {
  items: SpecialtyReviewItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  counts: SpecialtyReviewCounts;
}

export interface ReviewAccreditationSample {
  id: string; title: string; description?: string | null; status?: string; projectUrl?: string | null; githubUrl?: string | null;
  technologiesUsed?: string[]; attachments?: string[]; createdAt?: string;
}

export interface ReviewWorkSample {
  id: string; title: string; description?: string | null; technologies?: string[]; publicSampleUrl?: string | null; mimeType?: string | null; createdAt?: string;
}

export interface SpecialtyReviewDetail extends Omit<SpecialtyReviewItem, 'accreditationSamples' | 'workSamples'> {
  assessmentTaken?: boolean | null;
  assessmentPassed?: boolean | null;
  /** Stored AI result of the assessment; shape is not fixed, so every part is read defensively. */
  aiFeedback: unknown;
  accreditationSamples: ReviewAccreditationSample[];
  workSamples: ReviewWorkSample[];
  otherPending: { id: string; specialty: string | null; status: SpecialtyReviewStatus }[];
  decisions: { id: string; title: string; summary?: string | null; status?: string; occurredAt: string }[];
}

export type SpecialtyDecision = 'APPROVED' | 'REJECTED';

/** The backend refuses a decision reason shorter than this. */
export const MIN_DECISION_REASON = 5;

export const STATUS_TEXT: Record<SpecialtyReviewStatus, string> = {
  UNDER_AI_REVIEW: 'بانتظار المراجعة',
  APPROVED: 'مقبول',
  REJECTED: 'مرفوض',
};

export const STATUS_CLASS: Record<SpecialtyReviewStatus, string> = {
  UNDER_AI_REVIEW: 'sac-st-pending',
  APPROVED: 'sac-st-approved',
  REJECTED: 'sac-st-rejected',
};

export function initialOf(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return n ? n.charAt(0) : '؟';
}

/** Public sample links only: http(s) urls. Anything else (private storage refs, file ids) is never rendered as a link. */
export function isWebUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url);
}

/** Plain list of strings out of an unknown JSON value (array of strings, or array of {text|title|message} objects). */
export function toTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  return value
    .map((v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? String((v as any).text ?? (v as any).title ?? (v as any).message ?? '') : ''))
    .map((v) => v.trim())
    .filter(Boolean);
}

export interface ParsedAiFeedback { summary: string; strengths: string[]; warnings: string[]; corrections: string[] }

export function parseAiFeedback(raw: unknown): ParsedAiFeedback | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw.trim() ? { summary: raw.trim(), strengths: [], warnings: [], corrections: [] } : null;
  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const summary = typeof o['summary'] === 'string' ? (o['summary'] as string).trim() : typeof o['feedback'] === 'string' ? (o['feedback'] as string).trim() : '';
  const r: ParsedAiFeedback = { summary, strengths: toTextList(o['strengths']), warnings: toTextList(o['warnings']), corrections: toTextList(o['corrections']) };
  return r.summary || r.strengths.length || r.warnings.length || r.corrections.length ? r : null;
}
