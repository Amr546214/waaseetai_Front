/** Arabic labels for the marketer area's backend enums (SourceChannel, CommissionType, CommissionStatus). Unknown values pass through unchanged. */
const CHANNEL_LABELS: Record<string, string> = {
	TIKTOK: 'تيك توك',
	X_TWITTER: 'إكس (تويتر)',
	INSTAGRAM: 'إنستغرام',
	LINKEDIN: 'لينكد إن',
	OTHER: 'روابط مباشرة / أخرى',
};

const COMMISSION_TYPE_LABELS: Record<string, string> = {
	NEW_CLIENT_REQUEST: 'طلب عميل جديد',
	FIRST_PROJECT_COMPLETED: 'إتمام أول مشروع',
	SUBSCRIPTION: 'اشتراك',
	STAGE_RELEASE: 'إفراج مرحلة',
};

const COMMISSION_STATUS_LABELS: Record<string, string> = {
	PENDING: 'معلق',
	APPROVED: 'مؤكد',
	PAID: 'محول',
	REJECTED: 'مرفوض',
	VOIDED: 'ملغي',
};

export const channelLabel = (v: string | null | undefined): string => (v && CHANNEL_LABELS[v]) || v || '—';
export const commissionTypeLabel = (v: string | null | undefined): string => (v && COMMISSION_TYPE_LABELS[v]) || v || '—';
export const commissionStatusLabel = (v: string | null | undefined): string => (v && COMMISSION_STATUS_LABELS[v]) || v || '—';

/** Copies text; resolves false (never throws) when the Clipboard API is missing or refuses. */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (!text || !navigator.clipboard?.writeText) return false;
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
