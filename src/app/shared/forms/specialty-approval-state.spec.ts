/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { SpecialtyStatusComponent } from './specialty-status.component';
import { approvalTag, approvalView, type SpecialtyApprovalState } from '../../core/utils/specialty-states';

const row = (name: string, approvalState: SpecialtyApprovalState, extra: any = {}) => ({ specialtyId: name, name, state: 'PASSED' as const, approvalState, ...extra });
const mount = (rows: any[]) => {
	TestBed.configureTestingModule({ imports: [SpecialtyStatusComponent], providers: [provideRouter([])] });
	const f = TestBed.createComponent(SpecialtyStatusComponent);
	f.componentRef.setInput('registered', rows); f.detectChanges();
	return f.nativeElement as HTMLElement;
};

describe('approval state: test vs samples vs admin decision', () => {
	it('assessment passed + samples pending: "نماذجك قيد مراجعة الإدارة", never "معتمد"', () => {
		const v = approvalView({ approvalState: 'SAMPLES_UNDER_REVIEW' });
		expect(v.label).toBe('نماذجك قيد مراجعة الإدارة');
		expect(v.label).not.toContain('معتمد');
		expect(approvalTag({ approvalState: 'SAMPLES_UNDER_REVIEW' }, 33)).toContain('قيد مراجعة الإدارة');
		expect(approvalTag({ approvalState: 'SAMPLES_UNDER_REVIEW' }, 33)).not.toContain('معتمد');
	});

	it('assessment passed + no samples: "ارفع نماذج" with the upload link, not approved', () => {
		const v = approvalView({ approvalState: 'PASSED_NO_SAMPLES' });
		expect(v.label).toContain('لم ترفع نماذج');
		expect(v.ctaLabel).toContain('رفع نموذج اعتماد');
		expect(v.ctaLink).toBe('/provider-overview/business-models/accreditation/new');
		expect(v.label).not.toContain('معتمد');
	});

	it('samples rejected: "تم رفض بعض النماذج", the admin reason and a resubmit link', () => {
		const v = approvalView({ approvalState: 'SAMPLES_REJECTED', rejectionReason: 'الملفات غير واضحة' });
		expect(v.label).toBe('تم رفض بعض النماذج');
		expect(v.detail).toContain('الملفات غير واضحة');
		expect(v.ctaLabel).toContain('إعادة إرسال');
		expect(v.ctaLink).toBe('/provider-overview/business-models/accreditation/new');
		expect(approvalView({ approvalState: 'SAMPLES_REJECTED' }).detail).not.toContain('السبب');
	});

	it('wizard samples only (not in the admin queue): shown as a draft, not as a review or an approval', () => {
		const v = approvalView({ approvalState: 'DRAFT_SAMPLES' });
		expect(v.label).toContain('مسودة');
		expect(v.detail).toContain('لم تُرسَل بعد');
		expect(v.label).not.toContain('معتمد');
	});

	it('only a real admin approval says "معتمد"', () => {
		expect(approvalView({ approvalState: 'APPROVED' }).label).toBe('معتمد');
		const others: SpecialtyApprovalState[] = ['LOCKED', 'TEST_NOT_TAKEN', 'TEST_NOT_PASSED', 'REJECTED', 'PASSED_NO_SAMPLES', 'DRAFT_SAMPLES', 'SAMPLES_UNDER_REVIEW', 'SAMPLES_REJECTED'];
		for (const s of others) { expect(approvalView({ approvalState: s }).label, s).not.toMatch(/^معتمد$/); expect(approvalTag({ approvalState: s }, 80), s).not.toContain('✓ معتمد'); }
		expect(approvalTag(null).includes('معتمد ')).toBe(false);
	});

	it('a registered but unapproved specialty is rendered with its state, never the "no specialty" message nor a vague "unapproved samples"', () => {
		const el = mount([row('تصميم جرافيك', 'SAMPLES_UNDER_REVIEW'), row('شعارات', 'PASSED_NO_SAMPLES'), row('أيقونات', 'SAMPLES_REJECTED', { rejectionReason: 'جودة منخفضة' }), row('رسم', 'APPROVED')]);
		const labels = [...el.querySelectorAll('[data-testid="specialty-status-label"]')].map(e => e.textContent!.trim());
		expect(labels).toEqual(['نماذجك قيد مراجعة الإدارة', 'اجتزت الاختبار — لم ترفع نماذج بعد', 'تم رفض بعض النماذج', 'معتمد']);
		expect(el.textContent).toContain('جودة منخفضة');
		expect(el.textContent).not.toContain('لا يوجد لديك تخصص');
		expect(el.textContent).not.toContain('نماذج غير معتمدة');
	});

	it('nothing registered renders nothing (the empty notice owns that case)', () => {
		expect(mount([]).querySelector('[data-testid="specialty-status"]')).toBeNull();
	});
});

describe('the pages use the approval state, not the test result, for what they call "معتمد"', () => {
	const APP = join(__dirname, '../..');
	const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
	const P = 'pages/dashboard/provider-overview/';

	it('specialties page and accreditation list show the status panel', () => {
		expect(read(P + 'profile/specialties/specialties.html')).toContain('<ws-specialty-status');
		expect(read(P + 'business-models/accreditation/list/list.html')).toContain('<ws-specialty-status');
	});

	it('the wizard step 3 says its samples are a draft and not an approval', () => {
		const html = read(P + 'profile/specialties/specialties.html');
		expect(html).toContain('data-testid="step3-draft-note"');
		expect(html).toContain('مسودة');
		expect(html).toContain('step3-accreditation-link');
	});

	it('a rejected accreditation sample is never shown as "قيد المراجعة": list, details, center and the model card say rejected, with the reason where the page has it', () => {
		const list = read(P + 'business-models/accreditation/list/list.html');
		expect(list).toContain('data-testid="sample-rejection-reason"');
		expect(list).toContain('إعادة الإرسال');
		expect(read(P + 'business-models/center/accreditation-details/accreditation-details.html')).toContain("status === 'REJECTED'");
		expect(read(P + 'business-models/new-project/components/step3-model/step3-model.component.html')).toContain("model.status === 'REJECTED'");
		expect(read(P + 'business-models/center/center.html')).toContain('سبب الرفض وملاحظات الإدارة');
	});

	it('public profile: the green check is only for an APPROVED specialty, the other labels say waiting / rejected', () => {
		const html = read(P + 'profile/public/public.html');
		expect(html).toContain("*ngIf=\"spec.status === 'APPROVED'\"");
		const ts = read(P + 'profile/public/public.ts');
		expect(ts).toContain("'بانتظار اعتماد الإدارة'");
		expect(ts).toContain("'تم رفض التخصص'");
		expect(ts).not.toContain("'تخصص غير معتمد'");
	});

	it('no page keeps the vague "تخصصاتك المعتمدة فقط" for passed-but-unapproved specialties', () => {
		expect(read(P + 'business-models/accreditation/new/components/step1-specialty/step1-specialty.component.html')).not.toContain('تخصصاتك المعتمدة فقط');
	});
});

// H3 D7: a specialty pass score is shown with at most one decimal, never as a raw float.
import { formatPercent } from '../../core/utils/specialty-states';
describe('pass-score percent formatting', () => {
	it('formats with at most 1 decimal, no trailing zero', () => {
		expect(formatPercent(93.33333333333333)).toBe('93.3%');
		expect(formatPercent(80)).toBe('80%');
		expect(formatPercent(66.66666)).toBe('66.7%');
		expect(formatPercent('72.5')).toBe('72.5%');
	});
	it('guards null / undefined / NaN / non-finite', () => {
		for (const v of [null, undefined, NaN, Infinity, 'abc', '']) expect(formatPercent(v as any)).toBe('');
	});
	it('the selector tag never prints a long float and drops a missing score', () => {
		expect(approvalTag({ approvalState: 'APPROVED' }, 93.33333333333333)).toBe('✓ معتمد 93.3%');
		expect(approvalTag({ approvalState: 'PASSED_NO_SAMPLES' }, NaN)).not.toContain('NaN');
		expect(approvalTag({ approvalState: 'PASSED_NO_SAMPLES' }, null)).not.toContain('%');
	});
});
