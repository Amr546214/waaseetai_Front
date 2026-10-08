import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Client "create request": every AI claim on the page must be backed by something real.
//  - real: the description stream (socket ai:generate_description -> WaseetAI generate/enhance) and POST /ai-suggest;
//  - NOT real (so never claimed): a file scan, AI-flagged content, "AI proposes requirements", a market/regional-contract
//    compliance verdict, "approved by Waseet AI" agreements, a title/specialty "AI check" (the only title check is a local rule
//    on the server), a description "quality analysis" (only the length is looked at), and suggestions "based on your past requests".
const ROOT = join(process.cwd(), 'src', 'app', 'pages', 'dashboard', 'clients-overview', 'create-request');
const FILES = [
	'components/step1-specialty/step1-specialty.html',
	'components/step2-conditions/step2-conditions.html',
	'components/step3-details/step3-details.html',
	'components/step4-budget/step4-budget.html',
	'components/step5-files/step5-files.html',
	'components/step6-review/step6-review.html',
	'create-request.ts',
];
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
const all = () => FILES.map(f => `\n/*${f}*/\n${read(f)}`).join('');

// Phrases that used to be shown and are not backed by any capability.
const MISLEADING = [
	'AI يقترح متطلبات',
	'يتم فحص كل ملف بواسطة AI',
	'يخضع لفحص AI',
	'AI رصد محتوى',
	'تم رصد محتوى مشبوه',
	'تم إشعار فريق الإشراف تلقائيا',
	'AI يقترح رفع هذه الملفات',
	'أضف وصفا لتحليل الجودة',
	'وصف قوي ومتوافق مع المعايير',
	'متوافق مع متطلبات السوق وعقود العمل الحر الإقليمية',
	'معتمدة من وسيط AI',
	'جاري تحليل العنوان ومطابقته',
	'يفحص AI وضوح العنوان',
	'تم التحقق · جاري صياغة',
	'بناء على طلباتك السابقة',
	'يقترح التخصصات بناء على خياراتك',
	'الصياغة الاحترافية',
	'hasInappropriateFile',
	'تعبّئ الحقول الفارغة فقط', // applyAISuggestion() also sets the budget and adds sub-specialties, not only empty fields
];

describe('create request: AI copy is truthful', () => {
	for (const phrase of MISLEADING) {
		it(`does not contain "${phrase}"`, () => {
			expect(all()).not.toContain(phrase);
		});
	}

	it('step 1: the AI banner describes what the real /ai-suggest call does, and the note says the suggestions are guidance', () => {
		const t = read('components/step1-specialty/step1-specialty.html');
		expect(t).toContain('اقتراح بالذكاء الاصطناعي');
		expect(t).toContain('بناءً على ما أدخلته حتى الآن');
		// matches applyAISuggestion(): title/description/duration only when empty; budget range and sub-specialties may be added
		expect(t).toContain('تُملأ العنوان والوصف والمدة إن كانت فارغة');
		expect(t).toContain('وقد تُضاف ميزانية مقترحة وتخصصات فرعية');
		expect(t).toContain('ويمكنك تعديل كل ذلك');
		expect(t).toContain('اقترح لي');
		expect(t).toContain('اقتراحات الذكاء الاصطناعي إرشادية وقابلة للتعديل');
	});

	it('step 2: the default NDA and the custom-NDA note make no AI approval / scan claim', () => {
		const t = read('components/step2-conditions/step2-conditions.html');
		expect(t).toContain('اتفاقية موحدة تُطبَّق افتراضيًا');
		expect(t).toContain('هذه الميزة غير متاحة حاليًا');
	});

	it('step 3: the length hint is neutral, the draft is editable, and "requirements" are described as the client\'s own list', () => {
		const t = read('components/step3-details/step3-details.html');
		expect(t).toContain('طول الوصف مناسب');
		expect(t).toContain('أضف وصفًا أوضح لطلبك');
		expect(t).toContain('مسودة قابلة للتعديل قبل الإرسال');
		expect(t).toContain('أضف المتطلبات التي يجب أن يلتزم بها مقدم الخدمة');
		// the real streaming labels stay
		expect(t).toContain('جاري صياغة الوصف بواسطة الذكاء الاصطناعي');
		expect(t).toContain('تحسين وصياغة AI');
	});

	it('step 5: file limits are stated without a scan claim, and the static suggestions are "suggested files"', () => {
		const t = read('components/step5-files/step5-files.html');
		expect(t).toContain('حجم أقصى 10MB لكل ملف');
		expect(t).toContain('ملفات مقترحة لتحسين وضوح الطلب');
		expect(t).not.toMatch(/AI[^<]*ملف/);
	});

	it('step 6: the acknowledgment no longer says the request requirements are "approved by Waseet AI"', () => {
		const t = read('components/step6-review/step6-review.html');
		expect(t).toContain('ومتطلبات نشر الطلب على المنصة');
		expect(t).toContain('مراجعة قبل النشر');
	});

	it('the completion toast no longer calls the draft "professional" and asks the user to review it', () => {
		expect(read('create-request.ts')).toContain('راجعها قبل اعتمادها');
	});
});
