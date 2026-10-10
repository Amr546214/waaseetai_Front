/** One review lifecycle for every role (profile GET -> reviewStatus): only changes an admin decides, never e-mail-code-only or immediate saves. */
export type ReviewState = 'NOT_SUBMITTED' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export interface ReviewEntry {
	status: ReviewState;
	requestId: string | null;
	category: string | null;
	submittedAt: string | null;
	reviewedAt: string | null;
	rejectionReason: string | null;
}
