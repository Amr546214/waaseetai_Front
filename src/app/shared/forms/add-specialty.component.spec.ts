/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AddSpecialtyComponent } from './add-specialty.component';
import { ATTEMPT_LIMIT_TEXT, approvalTag, approvalView, registeredStateText, retryAfterText, specialtyEmptyView, type RegisteredSpecialty } from '../../core/utils/specialty-states';

const r = (name: string, state: RegisteredSpecialty['state'], extra: Partial<RegisteredSpecialty> & { approvalState?: any } = {}): RegisteredSpecialty & { approvalState?: any } => ({ specialtyId: name, name, state, ...extra });
const mount = (rows: any[], returnTo: string | null = 'accreditation') => {
	TestBed.configureTestingModule({ imports: [AddSpecialtyComponent], providers: [provideRouter([])] });
	const f = TestBed.createComponent(AddSpecialtyComponent);
	f.componentRef.setInput('registered', rows); f.componentRef.setInput('returnTo', returnTo); f.detectChanges();
	return f.nativeElement as HTMLElement;
};

describe('retake wording', () => {
	it('"you can retake in X hours" rounds up; under an hour says so', () => {
		expect(retryAfterText(22 * 3600)).toBe('يمكنك إعادة الاختبار بعد 22 ساعة');
		expect(retryAfterText(21.2 * 3600)).toBe('يمكنك إعادة الاختبار بعد 22 ساعة');
		expect(retryAfterText(10 * 60)).toBe('يمكنك إعادة الاختبار بعد أقل من ساعة');
	});
	it('a failed specialty in cooldown shows the wait, the limit shows the limit text; never-tested / passed are unaffected', () => {
		expect(registeredStateText({ state: 'TEST_NOT_PASSED', retryAfterSeconds: 3 * 3600 })).toContain('يمكنك إعادة الاختبار بعد 3 ساعة');
		expect(registeredStateText({ state: 'TEST_NOT_PASSED', attemptLimitReached: true })).toBe(ATTEMPT_LIMIT_TEXT);
		expect(registeredStateText({ state: 'TEST_NOT_TAKEN' })).toContain('لم تُجرِ اختبار');
		expect(registeredStateText({ state: 'PASSED' })).toBe('');
	});
	it('the empty notice and the status view carry the wait too, and offer no retry button while waiting', () => {
		const v = specialtyEmptyView([r('تصميم', 'TEST_NOT_PASSED', { retryAfterSeconds: 5 * 3600 })]);
		expect(v.items[0].text).toContain('بعد 5 ساعة');
		const view = approvalView({ approvalState: 'TEST_NOT_PASSED', retryAfterSeconds: 5 * 3600 });
		expect(view.detail).toContain('بعد 5 ساعة');
		expect(view.ctaLink).toBeNull();
		expect(approvalView({ approvalState: 'TEST_NOT_PASSED' }).ctaLink).toBe('/provider-overview/profile/specialties');
	});
	it('a specialty that passed the test and has no accreditation sample says "ارفع نموذج اعتماد" — not "معتمد", not "بانتظار اعتماد الأدمن"', () => {
		const tag = approvalTag({ approvalState: 'PASSED_NO_SAMPLES' }, 33);
		expect(tag).toContain('اجتزت الاختبار');
		expect(tag).toContain('ارفع نموذج اعتماد');
		expect(tag).not.toContain('معتمد ');
		expect(tag).not.toContain('بانتظار اعتماد الأدمن');
	});
});

describe('ws-add-specialty (the way to a new specialty from the accreditation page)', () => {
	it('shows a clear "إضافة تخصص جديد" button to the specialties page that carries ?returnTo=accreditation', () => {
		const el = mount([r('تصميم', 'PASSED')]);
		const cta = el.querySelector('[data-testid="add-specialty-cta"]') as HTMLAnchorElement;
		expect(cta.textContent!.trim()).toBe('إضافة تخصص جديد');
		expect(cta.getAttribute('href')).toBe('/provider-overview/profile/specialties?returnTo=accreditation');
		expect(el.textContent).toContain('15 سؤالًا');
		expect(el.textContent).toContain('اجتياز الاختبار لا يعني الاعتماد');
	});
	it('without returnTo the link is the plain specialties page', () => {
		expect(mount([], null).querySelector('[data-testid="add-specialty-cta"]')!.getAttribute('href')).toBe('/provider-overview/profile/specialties');
	});
	it('lists only the specialties that have not passed, each with its state and the wait; passed ones are not repeated', () => {
		const el = mount([r('ناجح', 'PASSED'), r('راسب', 'TEST_NOT_PASSED', { retryAfterSeconds: 4 * 3600, approvalState: 'TEST_NOT_PASSED' }), r('جديد', 'TEST_NOT_TAKEN', { approvalState: 'TEST_NOT_TAKEN' })]);
		const text = el.querySelector('[data-testid="specialty-status"]')!.textContent!;
		expect(text).not.toContain('ناجح');
		expect(text).toContain('راسب');
		expect(text).toContain('يمكنك إعادة الاختبار بعد 4 ساعة');
		expect(text).toContain('جديد');
		// the test CTA of a not-yet-tested specialty brings the provider back to the accreditation page afterwards
		const cta = el.querySelector('[data-testid="specialty-status"] .wss-cta') as HTMLAnchorElement;
		expect(cta.getAttribute('href')).toContain('returnTo=accreditation');
	});
	it('no pending specialties: just the button, no empty status box', () => {
		expect(mount([r('ناجح', 'PASSED')]).querySelector('[data-testid="specialty-status"]')).toBeNull();
	});
});

describe('wiring', () => {
	const APP = join(__dirname, '../..');
	const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
	const P = 'pages/dashboard/provider-overview/';
	it('the accreditation page (with and without passed specialties) points to "add a new specialty"', () => {
		const html = read(P + 'business-models/accreditation/new/components/step1-specialty/step1-specialty.component.html');
		expect(html).toContain('<ws-add-specialty');
		expect(html).toContain('returnTo="accreditation"');
		expect(html).toMatch(/<ws-specialty-empty[^>]*returnTo="accreditation"/);
	});
	it('the specialties page reads ?returnTo and sends the result / error back to the accreditation page; the plain flow still ends at step 1', () => {
		const ts = read(P + 'profile/specialties/specialties.ts');
		expect(ts).toContain("queryParamMap.get('returnTo') === 'accreditation'");
		expect(ts).toContain('ACCREDITATION_NEW_PAGE');
		expect(ts).toContain('this.currentStep.set(1)');
		const html = read(P + 'profile/specialties/specialties.html');
		expect(html).toContain('(primary)="leaveTest()"');
		expect(html).toContain('(back)="leaveTest()"');
		expect(html).toContain('data-testid="return-to-accreditation-note"');
	});
});
