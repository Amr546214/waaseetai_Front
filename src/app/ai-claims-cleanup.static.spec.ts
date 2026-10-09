/// <reference types="node" />

// Static guard for the "AI claims cleanup" pass: the official AI icon / word appears ONLY where a real AI call exists.
// Review of sensitive profile changes = OTP + a human reviewer; KYC documents = human review; stored / rule-based figures are
// not "AI". Comments are stripped before matching, so explanatory comments may still mention the removed wording.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = __dirname;
const D = 'pages/dashboard/';
const strip = (s: string) =>
	s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const src = (rel: string) => strip(readFileSync(join(APP, rel), 'utf8'));

function expectAbsent(files: string[], phrases: (string | RegExp)[]) {
	for (const f of files) {
		const s = src(f);
		for (const p of phrases) {
			const hit = typeof p === 'string' ? s.includes(p) : p.test(s);
			expect(hit, `${f} still contains ${String(p)}`).toBe(false);
		}
	}
}
function expectPresent(rel: string, phrases: string[]) {
	const s = src(rel);
	for (const p of phrases) expect(s.includes(p), `${rel} lost the real-AI marker ${p}`).toBe(true);
}

const PROFILE_REVIEW_FILES = [
	D + 'clients-overview/profile/profile-requests/profile-requests.html',
	D + 'clients-overview/profile/profile-edit/profile-edit.html',
	D + 'clients-overview/profile/add-account/add-account.html',
	D + 'clients-overview/profile/profile-logs/profile-logs.html',
	D + 'provider-overview/profile/requests/requests.html',
	D + 'provider-overview/profile/add-account/add-account.html',
	D + 'marketer-overview/profile/requests/requests.html',
	D + 'marketer-overview/profile/add-account/add-account.html',
	D + 'marketer-overview/profile/data/data.html',
	D + 'supper-admin-overview/sa-modification-requests/sa-modification-requests.html',
	D + 'supper-admin-overview/sa-modification-requests/sa-modification-requests.ts',
];

describe('1. sensitive-change review is OTP + human, never "AI checks"', () => {
	it('no AI-review wording and no AI recommendation / confidence rendering', () => {
		expectAbsent(PROFILE_REVIEW_FILES, [
			'AI يفحص كل طلب',
			'قيد المراجعة حالياً من قبل الذكاء',
			'يراجع الذكاء',
			'يراجعه الذكاء',
			'نتيجة الفحص الآلي',
			'فحص آلي: تمرير',
			'AI Verdict',
			'اختبار أهلية بالذكاء الاصطناعي',
			'تفحص\n\t\t\t\tمن AI',
			'.aiRecommendation',
			'.aiConfidence',
			'.aiAuditStatus',
			'ثقة AI',
		]);
	});
	it('the honest replacement text is present', () => {
		expectPresent(D + 'clients-overview/profile/profile-requests/profile-requests.html', ['تم تأكيد الهوية عبر الرمز وبانتظار مراجعة الفريق']);
		expectPresent(D + 'provider-overview/profile/requests/requests.html', ['تم تأكيد الهوية عبر الرمز وبانتظار مراجعة الفريق']);
		expectPresent(D + 'marketer-overview/profile/requests/requests.html', ['تم تأكيد الهوية عبر الرمز وبانتظار مراجعة الفريق']);
		expectPresent(D + 'supper-admin-overview/sa-modification-requests/sa-modification-requests.ts', ['تم تأكيد الهوية عبر الرمز وبانتظار مراجعة الفريق']);
		expectPresent(D + 'clients-overview/profile/profile-edit/profile-edit.html', ['قيد مراجعة الفريق']);
		// the AI pre-review block is driven only by aiReview (shared component), on client, provider and admin
		for (const f of ['clients-overview/profile/profile-requests/profile-requests.html', 'provider-overview/profile/requests/requests.html', 'supper-admin-overview/sa-modification-requests/sa-modification-requests.html']) expectPresent(D + f, ['<ws-profile-ai-review', '.aiReview']);
	});
});

describe('2. KYC / identity / document text is a human review', () => {
	const PS = D + 'provider-overview/profile/profile-setup/profile-setup.html';
	const SP = D + 'provider-overview/profile/specialties/specialties.html';
	it('provider profile-setup: no AI document verification claim', () => {
		expectAbsent([PS], [
			'AI يتحقق',
			'جار التحليل بواسطة AI',
			'التحقق من الهوية آليا بواسطة AI',
			'للتحقق من الهوية آليا',
			'AI يتحقق من المستندات',
			'يراها الذكاء فقط',
			'ولا يراها إلا الذكاء',
			'للمراجعة من الذكاء فقط',
			'التقدم محفوظ تلقائيا بواسطة AI',
			'تحقق آلي',
		]);
		expectPresent(PS, ['تراجعها الإدارة', 'جارٍ الرفع', 'التقدم محفوظ تلقائيًا']);
	});
	it('provider profile-setup keeps the REAL AI parts (assessment, skills suggestion, test generation)', () => {
		expectPresent(PS, ['AI يولّد أسئلة الاختبار', 'اقتراح مهارات بالذكاء الاصطناعي', 'جاري توليد الاختبار بالذكاء الاصطناعي']);
	});
	it('specialties: portfolio proof is reviewed by the admins, not by "the AI engine"', () => {
		expectAbsent([SP], [
			'من قبل محرك الذكاء',
			'فحص الملكية والأصالة',
			'جاهز للتدقيق الذكي',
			'كان تحليل الذكاء الاصطناعي أفضل',
			'الذكاء الاصطناعي يراجع وثائق الإثبات',
			'للمراجعة من الذكاء والإدارة فقط',
			'الهندسية وأطر الحوكمة في Waseet AI',
			'تعذر الاتصال بمحرك الذكاء الاصطناعي',
		]);
		expectPresent(SP, ['مراجعة الملكية والأصالة', 'جاهز للمراجعة', 'تقييم محرك Waseet AI والتحليل الفني الذكي']);
	});
	it('provider documents note: reviewed by a human', () => {
		expectAbsent([D + 'provider-overview/profile/data/data.html'], ['تُفحص آليًا']);
	});
});

describe('3. business model details show stored report fields only', () => {
	const MD = D + 'provider-overview/business-models/market/model-details/model-details';
	it('no invented sub-metrics, no canned "ملاحظات وسيط AI", no "صدر يوم الاعتماد"', () => {
		expectAbsent([MD + '.html', MD + '.ts'], ['aiMetrics', 'جودة التنفيذ', 'أصالة العمل', 'توافق مع السوق', 'دقة التفاصيل', 'ملاءمة التخصص', 'ملاحظات وسيط AI', 'صدر يوم الاعتماد', 'توافق جيد مع طلبات تخصص']);
		expectPresent(MD + '.html', ['لم يصدر تقرير تدقيق بعد', 'auditReport()', 'hasAuditScore()']);
		expectAbsent([MD + '.ts'], ['aiAuditReport']);
	});
	it('AI score badges are guarded against 0 / null (0 = not audited)', () => {
		expectPresent(D + 'provider-overview/business-models/market/market.html', ['model.aiScore != null']);
		expectPresent(D + 'provider-overview/company/company-models/company-models.html', ['m.aiScore != null']);
		expectPresent(D + 'provider-overview/business-models/center/center.html', ["sample.aiScore != null && sample.aiScore > 0"]);
		expectPresent(D + 'provider-overview/business-models/new-project/components/step3-model/step3-model.component.html', ['model.score != null && model.score > 0']);
		for (const f of ['favorites/favorites.html', 'compare-services/compare-services.html', 'curated/curated.html']) {
			const s = src('pages/website/marketplace/' + f);
			expect(/جودة AI \{\{ [\w.?]*aiScore \}\}/.test(s), f).toBe(true);
			// every "جودة AI {{ x.aiScore }}" occurrence sits inside an @if (x.aiScore != null) (a real 0 is shown, null is hidden)
			const unguarded = s.split('\n').filter((l) => /جودة AI \{\{ [\w.?]*aiScore \}\}/.test(l) && !/@if \([\w.?]*aiScore != null\)/.test(l) && !/ai-banner-text/.test(l));
			expect(unguarded, f).toEqual([]);
		}
	});
	it('public provider profile: no zero rings when there is no history', () => {
		const html = src('pages/website/marketplace/provider-profile/provider-profile.html');
		expect(html).toContain('hasHistoryMetrics()');
		expect(html).toContain('لا بيانات بعد');
	});
});

describe('4. admin mock AI cards are gone', () => {
	const A = D + 'supper-admin-overview/';
	it('forecast / confidence / sentiment / anomaly / AI columns removed', () => {
		expectAbsent([A + 'sa-finance-reports/sa-finance-reports.html', A + 'sa-finance-reports/sa-finance-reports.ts'], ['ثقة النموذج', 'بثقة 88%', 'forecastPoints', 'confidence']);
		expectAbsent([A + 'sub-finance/sa-sub-finance-reports/sa-sub-finance-reports.html'], ['توقع AI', 'توقعات AI', 'بثقة 88%', '2.14M']);
		expectAbsent([A + 'analytics/sa-quality/sa-quality.html', A + 'analytics/sa-quality/sa-quality.ts'], ['Sentiment Analysis (AI)', 'sentiment']);
		expectAbsent([A + 'sa-audit-trail/sa-audit-trail.html'], ['رُصدت 3 عمليات', 'عمليات مشبوهة', 'at-anomaly']);
		expectAbsent([A + 'sa-business-models/sa-business-models.html'], ['AI Quality', 'avgAiScore']);
		expectAbsent([A + 'sa-offers/sa-offers.html', A + 'sa-offers/sa-offer-detail/sa-offer-detail.html'], ['AI Score', 'تحليل AI للعرض', 'aiClean', 'عروض مشبوهة']);
		expectAbsent([A + 'sa-requests/sa-requests.html'], ['aiClean', '<th>AI</th>']);
		expectAbsent([A + 'sa-projects/sa-projects.html'], ['خطر AI', 'pj-risk']);
		expectAbsent([A + 'sa-super-admins/sa-super-admins.html', A + 'sa-super-admins/sa-super-admins.ts'], ['محركات الذكاء الاصطناعي', 'حد نسبة المطابقة', 'aiToggles', 'aiMatchThreshold']);
		expectAbsent([A + 'subscriptions/sa-upgrade/sa-upgrade.html'], ['AI يتوقع', 'احتمال AI']);
		for (const f of ['sa-boost/sa-boost', 'sa-promotions/sa-promotions', 'sa-ads/sa-ads', 'sa-plans/sa-plans']) {
			expectAbsent([A + 'subscriptions/' + f + '.html'], ['AI Bid', 'AI Performance', 'AI Targeting', 'AI Recommend', 'ROI متوسط', 'CTR متوسط']);
		}
		expectAbsent([A + 'sa-categories/sa-categories.html'], ['ترقيات AI هذا الشهر']);
		expectAbsent([A + 'it/sa-monitoring/sa-monitoring.html'], ['تنبيهات تنبؤية']);
		expectAbsent([A + 'it/sa-apis/sa-apis.html'], ['كشف الشذوذ']);
		expectAbsent([A + 'subscriptions/sa-sub-invoices/sa-sub-invoices.html'], ['AI فواتير رسمية']);
	});
	it('the real admin AI features stay (dispute summary with the official icon, stored accreditation score)', () => {
		const dd = src(A + 'sa-disputes/sa-dispute-detail/sa-dispute-detail.html');
		expect(dd).toContain('تلخيص النزاع بالذكاء الاصطناعي');
		expect(dd).toContain('requestAiSummary()');
		expect(dd).toContain('ادعاء الطرف الآخر غير مسجّل');
		expect(dd).not.toContain('🤖');
		expect(dd).toContain('M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5');
		expect(src(A + 'sa-accreditations/sa-accreditation-detail/sa-accreditation-detail.html')).toMatch(/AI/);
	});
});

describe('5. client / provider reports, finance, rating and settings copy', () => {
	it('client reports: AI wording only via the shared card', () => {
		const s = src(D + 'clients-overview/reports/reports.html');
		expect(s).not.toContain('مدعوم بالذكاء الاصطناعي');
		expect(s).not.toContain('تحليل الذكاء');
		expect(s).toContain('ملخص شامل لنشاطك');
		expect(s).toContain('<ws-ai-result-card');
		expect(s).not.toContain('ملخص إحصائي');
		expectAbsent([D + 'provider-overview/reports/reports.html'], ['مدعوم بالذكاء الاصطناعي']);
	});
	it('provider finance: no AI transaction verification, no AI protection label', () => {
		expectAbsent([D + 'provider-overview/finance/transaction-details/transaction-details.html'], ['AI تحقّق من سلامة المعاملة', 'وسيط AI، تحقق من المعاملة']);
		expectAbsent([D + 'provider-overview/finance/withdraw/withdraw.html', D + 'clients-overview/my-request/escrow-deposit/escrow-deposit.html'], ['وسيط AI، حماية مالية']);
	});
	it('active-project / sign-contract / rating pages / account toggle', () => {
		expectAbsent([D + 'clients-overview/project/active-project/active-project.html'], ['AI يتابع مشاريع كل الفريق']);
		expectAbsent([D + 'clients-overview/my-request/contract-signature/contract-signature.html', D + 'provider-overview/offers/sign-contract/sign-contract.html'], ['وسيط AI، حماية العقد']);
		expectAbsent([D + 'clients-overview/project/rating-page/rating-page.html', D + 'provider-overview/projects/rating-page/provider-rating-page.html'], ['يغذّي محرّك الترشيح', 'وسيط AI، أهمية تقييمك']);
		expectPresent(D + 'clients-overview/project/rating-page/rating-page.html', ['تقييمك يظهر في ملف مقدّم الخدمة']);
		expectAbsent([D + 'clients-overview/settings/account/account.html', D + 'provider-overview/settings/account/account.html'], ['تحسين توصيات الذكاء', 'shareData']);
		expectAbsent([D + 'provider-overview/provider-overview/provider-overview.html'], ['AI Insights', 'ai-ins-card']);
		expectAbsent([D + 'provider-overview/help/tickets/tickets.html'], ['يصنّفها الذكاء']);
	});
	it('provider offers: no fabricated initial banner / counts', () => {
		const ts = src(D + 'provider-overview/offers/offers.ts');
		expect(ts).not.toContain('لديك عرضان قيد التفاوض');
		expect(ts).not.toMatch(/count: [1-9]\d* \}/);
		expectAbsent([D + 'provider-overview/offers/offers.html'], ['وسيط AI - إفصاح الذكاء الاصطناعي', 'aiBannerText']);
	});
});

describe('6. marketer banners', () => {
	const M = D + 'marketer-overview/';
	it('the "نحلّل أداء قنواتك ... توصيات آلية" banner exists nowhere in the marketer area', () => {
		for (const f of ['commissions/commissions', 'referrals/referrals', 'ref-links/ref-links', 'withdraw/withdraw', 'help/help', 'profile/public/public', 'profile/data/data', 'marketing-broker-overview/marketing-broker-overview']) {
			expectAbsent([M + f + '.html'], ['نحلّل أداء قنواتك', 'توصيات آلية', 'وسيط AI، توصيات']);
		}
	});
	it('commissions / referrals / broker overview use the honest performance summary', () => {
		for (const f of ['commissions/commissions', 'referrals/referrals', 'marketing-broker-overview/marketing-broker-overview']) {
			expectPresent(M + f + '.html', ['ملخص لأدائك']);
		}
	});
	it('broker overview insights: real AI card (backend AiResult), no static advice, no inline AI icon', () => {
		const s = src(M + 'marketing-broker-overview/marketing-broker-overview.html');
		expect(s).toContain('<ws-ai-result-card title="رؤى وتوصيات الأداء"');
		expect(s).not.toContain('اقتراحات لك');
		expect(s).not.toContain('#i-ai');
	});
	it('marketer alert preferences have no "نصائح AI" toggle and no fake eligibility quiz', () => {
		expectAbsent([M + 'profile/data/data.html'], ['نصائح AI', 'marketer_ai_tips']);
		expectAbsent([M + 'profile/add-account/add-account.html'], ['اختبار أهلية بالذكاء الاصطناعي']);
	});
	it('the real help assistant keeps its AI marks', () => {
		const s = src(M + 'help/help.html');
		expect(s).toContain('askAI()');
		expect(s).toContain('#i-ai');
	});
});

describe('7/8. neutral icons and no robot / rocket emoji', () => {
	const NEUTRAL_FILES = [
		D + 'clients-overview/disputes/disputes.html',
		D + 'clients-overview/finance/wallet/wallet.html',
		D + 'clients-overview/finance/transaction-details/transaction-details.html',
		D + 'clients-overview/project/archived-projects/archived-projects.html',
		D + 'clients-overview/notifications/notifications-settings/notifications-settings.html',
		D + 'clients-overview/messages/messages.html',
		D + 'provider-overview/messages/messages.html',
		D + 'marketer-overview/messages/messages.html',
		D + 'supper-admin-overview/sa-users/sa-users.html',
		D + 'supper-admin-overview/sa-requests/sa-requests.html',
		D + 'provider-overview/finance/wallet/wallet.html',
		D + 'provider-overview/offers/offers.html',
		D + 'provider-overview/projects/active/active.html',
		'pages/website/pricing/pricing.html',
		'pages/auth/rest-password/rest-password.html',
		'pages/website/home/components/marketplace-preview/marketplace-preview.html',
	];
	it('banners that do not describe an AI call do not draw the official AI mark', () => {
		const AI_LINKS = 'M12 10V5M12 19v-5M10 12H5M19 12h-5';
		for (const f of NEUTRAL_FILES) {
			const s = strip(readFileSync(join(APP, f), 'utf8')).replace(/<symbol\s+id="[^"]*ai"[^>]*>[\s\S]*?<\/symbol>/g, '');
			expect(s.includes(AI_LINKS), `${f} draws the AI mark`).toBe(false);
			expect(/#(?:i|ic|pa)-ai\b/.test(s), `${f} references the AI sprite`).toBe(false);
		}
	});
	it('no 🤖 / 🚀 in the touched UI', () => {
		const files = [
			D + 'supper-admin-overview/sa-disputes/sa-dispute-detail/sa-dispute-detail.html',
			D + 'clients-overview/create-request/components/step3-details/step3-details.html',
			D + 'clients-overview/create-request/create-request.ts',
			D + 'provider-overview/business-models/center/center.html',
			D + 'provider-overview/business-models/accreditation/list/list.html',
			D + 'provider-overview/business-models/new-project/new-project.ts',
			D + 'provider-overview/business-models/new-project/components/step2-specialty/step2-specialty.component.html',
		];
		for (const f of files) expect(/🤖|🚀/.test(src(f)), f).toBe(false);
	});
	it('blog has no static "رؤى الذكاء الاصطناعي" block; join-provider does not say AI markets / ranks the service', () => {
		expectAbsent(['pages/website/blog/blog.html'], ['رؤى الذكاء الاصطناعي']);
		expectAbsent(['pages/website/support/join-provider/join-provider.component.html'], ['AI يُسوّق لك', 'ذكاء اصطناعي يسوّق لك', 'الذكاء الاصطناعي يرفع ترتيبك']);
		expectAbsent(['pages/website/about/about.html'], ['مطابقة ذكية']);
	});
	it('real AI surfaces keep the official mark', () => {
		const AI_LINKS = 'M12 10V5M12 19v-5M10 12H5M19 12h-5';
		expect(src(D + 'clients-overview/project/delivery-review/delivery-review.html')).toContain('مراجعة التسليم بالذكاء الاصطناعي');
		expect(src(D + 'clients-overview/project/delivery-review/delivery-review.html')).toMatch(/#i-ai|M12 10V5/);
		expect(src(D + 'clients-overview/create-request/components/step3-details/step3-details.html')).toContain('تحسين وصياغة AI');
		expect(src(D + 'clients-overview/project/project-details/project-details.html')).toContain('رؤى الذكاء');
		expect(src(D + 'clients-overview/my-request/request-details/request-details.html')).toContain('تقييم العرض');
		expect(src(D + 'clients-overview/help/help.html')).toContain('askAI()');
		expect(src(D + 'provider-overview/profile/profile-setup/profile-setup.html').includes('#i-ai')).toBe(true);
		expect(AI_LINKS.length).toBeGreaterThan(0);
	});
});

describe('6. client reports + marketer: AI only through <ws-ai-result-card>', () => {
	const files = [
		D + 'clients-overview/reports/reports.html', D + 'clients-overview/reports/reports.ts',
		D + 'marketer-overview/marketing-broker-overview/marketing-broker-overview.html', D + 'marketer-overview/marketing-broker-overview/marketing-broker-overview.ts',
	];
	it('old claims never return', () => {
		expectAbsent(files, ['مدعوم بالذكاء الاصطناعي', 'تحليل الذكاء', 'نحلّل أداء قنواتك', 'ابدأ ببوست تفاعلي', 'اقتراحات لك']);
	});
	it('no AI icon / mark in the page templates, only the card', () => {
		for (const f of [files[0], files[2]]) {
			const s = src(f);
			expect(s).toContain('<ws-ai-result-card');
			expect(s).not.toContain('#i-ai');
			expect(s).not.toContain('M12 10V5M12 19v-5M10 12H5');
		}
	});
});
