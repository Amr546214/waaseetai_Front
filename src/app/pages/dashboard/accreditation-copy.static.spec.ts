/// <reference types="node" />
import { TestBed } from '@angular/core/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Step3EvaluationComponent } from './provider-overview/business-models/accreditation/new/components/step3-evaluation/step3-evaluation.component';

// Backend truth (accreditation-ai.service.ts:5-15, :81-91, :95-105): submitting an accreditation sample stores it with status
// MANUAL_REVIEW and NO AI fields; the response carries `evaluation: null` and an "AI unavailable" payload. Only an admin
// approval (adminApproveSample) later sets AI_VERIFIED. So the UI says "مراجعة يدوية من فريق وسيط" and shows an AI value only
// where a stored AI score/rating/feedback exists on the item.

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf-8');
const B = 'pages/dashboard/provider-overview/business-models/';

describe('accreditation copy matches the manual-review reality', () => {
	it('the old AI-review promises are gone from the accreditation flow, list, admin banner and tiles', () => {
		const files = [
			B + 'accreditation/new/new.html', B + 'accreditation/new/new.ts',
			B + 'accreditation/new/components/step1-specialty/step1-specialty.component.html',
			B + 'accreditation/new/components/step2-upload/step2-upload.component.html',
			B + 'accreditation/new/components/step3-evaluation/step3-evaluation.component.html',
			B + 'accreditation/list/list.html', B + 'center/center.html',
			B + 'new-project/components/step3-model/step3-model.component.html',
			'pages/dashboard/supper-admin-overview/sa-accreditations/sa-accreditations.html',
		].map(f => f.replace(/^pages\/dashboard\//, ''));
		const banned = [
			'مراجعة الذكاء الاصطناعي', 'المراجعة والاعتماد بالذكاء الاصطناعي', 'إرسال للمراجعة والاعتماد بالذكاء الاصطناعي',
			'لإخضاع نموذج عملك لتقييم الذكاء الاصطناعي', 'يحلل الذكاء الاصطناعي نماذج أعمالك', 'يقارن مع متطلبات التخصص',
			'حدث تنبيه أثناء التدقيق', 'نتيجة التقييم الآلي', 'لإخضاعه لفحص الذكاء الاصطناعي', 'يقيّم الذكاء الاصطناعي كل نموذج تلقائياً',
			'قيد مراجعة وتدقيق الذكاء', 'المعاينة بواسطة AI', 'التحليل الفني غير متاح حالياً', 'تحليل الذكاء الاصطناعي</div>',
			'اكتمال متطلبات النموذج', 'وضوح نطاق العمل', '★4.9', '↑ 18%', 'تحليل الذكاء الاصطناعي ✓', 'يقارن مع', 'التقييم الشامل والتقرير الآلي',
		];
		for (const f of files) {
			const t = read('pages/dashboard/' + f);
			for (const b of banned) expect(t, `${f}: ${b}`).not.toContain(b);
		}
	});

	it('accreditation list tab badges are real counts, not fixed zeros', () => {
		const t = read('pages/dashboard/' + B.replace('pages/dashboard/', '') + 'accreditation/list/list.html');
		expect(t).not.toMatch(/<span>0<\/span>/);
		expect(t).not.toContain('قيد الفحص');
		expect(t).toContain('counts().pending');
	});

	it('replacement wording is present', () => {
		expect(read('pages/dashboard/' + B.replace('pages/dashboard/', '') + 'accreditation/new/new.html')).toContain('إرسال للمراجعة اليدوية من فريق وسيط');
		expect(read('pages/dashboard/' + B.replace('pages/dashboard/', '') + 'center/center.html')).toContain('قيد المراجعة اليدوية من فريق وسيط');
		expect(read('pages/dashboard/' + B.replace('pages/dashboard/', '') + 'accreditation/list/list.html')).toContain('قيد المراجعة اليدوية');
	});

	it('tiles show the real item status / stored AI rating instead of fixed ✓ marks', () => {
		const center = read('pages/dashboard/' + B.replace('pages/dashboard/', '') + 'center/center.html');
		expect(center).toContain("sample.status === 'AI_VERIFIED'");
		expect(center).toContain('@if (sample.aiQualityRating)');
		const model = read('pages/dashboard/' + B.replace('pages/dashboard/', '') + 'new-project/components/step3-model/step3-model.component.html');
		expect(model).toContain('@if (model.score > 0)');
		expect(model).toContain("model.status === 'AI_VERIFIED' || model.status === 'APPROVED'");
	});

	it('create-request file suggestions are a static list and are not styled/named as AI', () => {
		const t = read('pages/dashboard/clients-overview/create-request/components/step5-files/step5-files.html');
		expect(t).not.toContain('ai-suggestions');
		expect(t).not.toContain('var(--ai)');
		expect(t).not.toContain('AI SUGGESTIONS');
	});

	it('step 3 shows a "received — manual review" success state (not an error, no retry) when the sample is stored without AI evaluation', async () => {
		await TestBed.configureTestingModule({ imports: [Step3EvaluationComponent] }).compileComponents();
		const f = TestBed.createComponent(Step3EvaluationComponent);
		f.componentRef.setInput('isAnalyzing', false);
		f.componentRef.setInput('hasError', null);
		f.componentRef.setInput('evaluationResult', null);
		f.componentRef.setInput('manualReviewNotice', 'تم استلام نموذجك وتحويله للمراجعة اليدوية من فريق وسيط.');
		f.detectChanges();
		const t = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
		expect(t).toContain('تم استلام نموذجك');
		expect(t).toContain('مراجعة يدوية من فريق وسيط');
		expect(t).toContain('عرض نماذج الاعتماد');
		expect(t).not.toContain('تعذّر إرسال النموذج');
		expect(t).not.toContain('إعادة المحاولة');
		expect(t).not.toContain('الذكاء الاصطناعي');
	});

	it('a real submission failure still shows the error with retry', async () => {
		await TestBed.configureTestingModule({ imports: [Step3EvaluationComponent] }).compileComponents();
		const f = TestBed.createComponent(Step3EvaluationComponent);
		f.componentRef.setInput('isAnalyzing', false);
		f.componentRef.setInput('hasError', 'حدث خطأ أثناء إرسال النموذج. يرجى المحاولة لاحقاً.');
		f.componentRef.setInput('evaluationResult', null);
		f.detectChanges();
		const t = ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
		expect(t).toContain('تعذّر إرسال النموذج للمراجعة');
		expect(t).toContain('إعادة المحاولة');
	});
});
