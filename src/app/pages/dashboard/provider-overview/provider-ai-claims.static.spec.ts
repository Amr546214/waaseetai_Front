import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Provider AI claims (Batch C2): every AI label is backed by a real call/result, or is relabelled; no 0-as-missing, no made-up fallbacks.
const root = join(process.cwd(), 'src/app/pages');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const PO = 'dashboard/provider-overview/';

describe('provider AI claims', () => {
	it('specialty portfolio review: a real review card (button, loading, ready, empty, failed), advisory only, no retry when the AI is not configured', () => {
		const t = read(PO + 'profile/specialties/specialties.html');
		for (const id of ['specialty-ai-review-btn', 'specialty-ai-review-loading', 'specialty-ai-review-ready', 'specialty-ai-review-empty', 'specialty-ai-review-failed']) expect(t).toContain(id);
		expect(t).toContain('تعذر تشغيل المراجعة حاليًا');
		expect(t).toContain('أضف نماذج أعمال كافية ليتم تحليلها');
		expect(t).toContain('portfolioReviewRetryable()');
	});
	it('accreditation details: the AI report card only renders with a stored AI result; otherwise "مراجعة الفريق"', () => {
		const t = read(PO + 'business-models/center/accreditation-details/accreditation-details.html');
		expect(t).toContain('sampleDetails()?.aiScore != null || sampleDetails()?.aiFeedbackAr');
		expect(t).toContain('accreditation-manual-review');
		expect(t).not.toContain("aiScore || '-'");
		expect(t).not.toContain("rating || '0.0'");
	});
	it('accreditation center: missing average AI score is not shown as 0, no hardcoded "12 قُبلت"', () => {
		const ts = read(PO + 'business-models/center/center.ts'), html = read(PO + 'business-models/center/center.html');
		expect(ts).toContain("/ scores.length) : null;");
		expect(html).not.toContain('12 قُبلت');
	});
	it('provider dashboard: AI tiles read the real aiRating (null = no data), the market tile is not "نماذج في السوق"', () => {
		const t = read(PO + 'provider-overview/provider-overview.html');
		expect(t).not.toContain('نماذج في السوق');
		expect(t).not.toContain('قيد التقييم');
		expect(t).toContain('data.summary?.aiRating != null');
		expect(t).toContain('pendingClientApprovalCount');
	});
	it('explore requests: no invented price/duration verdict fallbacks', () => {
		const ts = read(PO + 'explore-requests/explore-requests.ts');
		expect(ts).not.toContain('عادل ومطابق لمتطلبات السوق');
		expect(ts).not.toContain('واقعية ومناسبة');
	});
	it('skills suggestion: the label/chips only show with suggestions; 503 says unavailable', () => {
		const html = read(PO + 'profile/profile-setup/profile-setup.html'), ts = read(PO + 'profile/profile-setup/profile-setup.ts');
		expect(html).toContain('@if (aiSuggestedSkills().length || isSuggestingSkills())');
		expect(ts).toContain('غير متاح حاليًا');
	});
	it('public profile pages: unrated providers show "—", real zero metrics are not hidden', () => {
		const mk = read('website/marketplace/provider-profile/provider-profile.html'), mkTs = read('website/marketplace/provider-profile/provider-profile.ts');
		expect(mk).toContain('لا توجد تقييمات بعد');
		expect(mkTs).not.toMatch(/typeof v === 'number' && v > 0/);
		expect(read(PO + 'profile/public/public.html')).not.toMatch(/clientRating \|\|\s*0 \}\}%/);
	});
});
