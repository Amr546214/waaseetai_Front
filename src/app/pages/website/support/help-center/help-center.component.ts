import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

/** One FAQ entry. `a` is static, trusted markup (paragraphs / lists / <strong>) written in this file. */
interface FaqItem { q: string; a: string; }
interface FaqSection {
	id: string;
	/** Short label shown in the side navigation (design P-SP-001). */
	nav: string;
	title: string;
	icon: 'shield' | 'alert' | 'trust-ai' | 'broker' | 'tag' | 'clock';
	/** Inline style of the section icon tile, verbatim from the design. */
	icoStyle: string;
	items: FaqItem[];
}

const ICO_TEAL = 'background:rgba(43,212,199,.1);border:1px solid rgba(43,212,199,.2);color:var(--teal)';
const ICO_KAHR = 'background:rgba(217,138,11,.1);border:1px solid rgba(217,138,11,.2);color:var(--kahr)';
const ICO_AI = 'background:var(--ai-bg);border:1px solid var(--ai-border);color:var(--ai-txt)';
const ICO_BLUE = 'background:rgba(43,127,255,.1);border:1px solid rgba(43,127,255,.2);color:var(--blue-txt)';

@Component({
	selector: 'app-help-center',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './help-center.component.html',
	styleUrls: ['./help-center.component.css']
})
export class HelpCenterComponent {
	/** Open FAQ items, keyed "section-item". The design opens the first question by default. */
	private open = new Set<string>(['0-0']);
	activeSection = 's1';

	// Wording follows the design (P-SP-001). Where the design describes behaviour the
	// backend does not have (AI dispute verdicts/appeals, AI review as a release
	// condition, 10,000 USD threshold, anti-manipulation weights, "no tax on invoices"),
	// the app's accurate wording is kept instead.
	sections: FaqSection[] = [
		{
			id: 's1', nav: 'الضمان المالي', title: 'كيف يعمل الضمان المالي', icon: 'shield', icoStyle: ICO_TEAL,
			items: [
				{ q: 'ما هو الضمان المالي وكيف يحمي أموالي؟', a: '<p>عند قبول عرض والدفع، يُحجز مبلغ المشروع في مسار ضمان مالي (Escrow) تشغيلي. المال لا يصل لمقدم الخدمة إلا بعد تسليم مقبول أو انتهاء مهلة الاعتراض دون نزاع.</p>' },
				{ q: 'متى يُفرج عن المبلغ لمقدم الخدمة؟', a: '<p>يحدث الإفراج عند اجتماع ثلاثة شروط:</p><ul><li>تسليم المرحلة أو العمل المتفق عليه</li><li>اعتماد طالب الخدمة يدوياً أو انتهاء مهلة المراجعة بدون اعتراض</li><li>عدم وجود نزاع أو تجميد مفتوح</li></ul><p>القرار النهائي بالاعتماد يبقى بيد طالب الخدمة دائماً — أي تحليل استشاري بالذكاء الاصطناعي لا يُفرج عن أي مبلغ ولا يُعد شرطاً للإفراج.</p>' },
				{ q: 'ما مهل مراجعة التسليم؟', a: '<p>تتراوح بين 48 ساعة للخدمات البسيطة و5 إلى 7 أيام عمل للمشاريع الكبيرة. إذا انقضت المهلة بدون اعتراض أو تمديد، يُفرج تلقائياً.</p>' }
			]
		},
		{
			id: 's2', nav: 'النزاعات', title: 'كيف أفتح نزاعاً', icon: 'alert', icoStyle: ICO_KAHR,
			items: [
				{ q: 'متى يحق لي فتح نزاع؟', a: '<p>يمكنك فتح نزاع إذا: لم يُسلَّم العمل في الموعد المتفق، أو كان التسليم مخالفاً جوهرياً للعقد، أو وجدت مشكلة واضحة في الجودة خلال مهلة المراجعة.</p>' },
				{ q: 'ماذا يحدث بعد فتح النزاع؟', a: '<p>يُعلَّق الإفراج عن المبلغ المرتبط بالنزاع. يراجع فريق الإدارة تفاصيل النزاع والأدلة المرفقة من الطرفين، ثم يصدر قراراً نهائياً بقبول النزاع أو رفضه مع توضيح السبب.</p>' }
			]
		},
		{
			id: 's3', nav: 'تقييم AI', title: 'كيف يعمل AI في وسيط AI', icon: 'trust-ai', icoStyle: ICO_AI,
			items: [
				{ q: 'ماذا يفعل AI في كل مشروع؟', a: '<p>يؤدي AI دورين أساسيين:</p><ul><li><strong>توصية:</strong> يساعد في صياغة الطلب، تحليل العرض، تنبيهات السعر والمدة</li><li><strong>تقييم:</strong> جودة التسليم، التخصصات، مؤشرات الأداء</li></ul>' },
				{ q: 'هل يمكن لـAI أن يخطئ؟', a: '<p>AI مساعد وليس ضماناً مطلقاً. توصياته وتقييماته مبنية على البيانات المتاحة، والقرار النهائي يبقى لك أو لفريق الإدارة.</p>' },
				{ q: 'ما الذي يظهر للمستخدم من تحليل AI؟', a: '<p>تُعرض نسبة التطابق، ملاحظات النطاق والمخرجات، والتحذيرات عند الحاجة. لا تُعرض المعادلات الداخلية أو أوزان التقييم التفصيلية.</p>' }
			]
		},
		{
			id: 's4', nav: 'عمولة الوسيط', title: 'كيف تعمل عمولة الوسيط', icon: 'broker', icoStyle: ICO_BLUE,
			items: [
				{ q: 'متى تُحسب عمولة الوسيط التسويقي؟', a: '<p>العمولة لا تُحسب عند التسجيل أو الإيداع. تُحسب فقط عند إفراج مرحلة أو استقرار معاملة مالية معتمدة من عميل أُحيل عبر رابطك.</p>' },
				{ q: 'ما هي قاعدة First-Touch؟', a: '<p>أول وسيط موثق يجلب المستخدم يبقى صاحب ارتباط الإحالة لذلك المستخدم مدى الحياة — ما لم يثبت تلاعب أو إحالة ذاتية أو قرار إداري بإبطاله.</p>' },
				{ q: 'هل يجوز إحالة نفسي أو أفراد عائلتي؟', a: '<p>الإحالة الذاتية والحسابات المرتبطة مرفوضة. عند الثبوت، تُجمَّد العمولة أو تُلغى مع تسجيل القرار.</p>' }
			]
		},
		{
			id: 's5', nav: 'المستويات', title: 'كيف تعمل المستويات', icon: 'tag', icoStyle: ICO_TEAL,
			items: [
				{ q: 'كم عدد المستويات وكيف أتقدم فيها؟', a: '<p>15 مستوى للوسيط التسويقي. التقدم يعتمد على النقاط المتراكمة، عدد العملاء النشطين، والإيراد المتولد من الإحالات الصحيحة.</p>' },
				{ q: 'هل يؤثر حذف عميل على مستواي؟', a: '<p>لا. حذف العميل لا ينقص مستواك ولا يحذف أثره من تقدمك التاريخي. الرصيد المحرر يبقى محفوظاً.</p>' },
				{ q: 'هل يمكن تحويل النقاط إلى مال؟', a: '<p>لا. النقاط هي مؤشر أداء وولاء فقط ولا تتحول إلى مال. العمولات المالية هي الوحيدة القابلة للسحب.</p>' }
			]
		},
		{
			id: 's6', nav: 'السحب والفواتير', title: 'السحب والفواتير', icon: 'clock', icoStyle: ICO_TEAL,
			items: [
				{ q: 'متى تتم معالجة طلبات السحب؟', a: '<p>الطلبات تُستقبل في أي وقت وتُعالج ضمن دفعة أسبوعية يوم الأربعاء. وصول المبلغ عبر PayPal يكون غالباً خلال 1 إلى 3 أيام عمل.</p>' },
				{ q: 'ما الحد الأدنى للسحب؟', a: '<p>حد سحب مقدم الخدمة: <strong>500 دولار</strong>. حد سحب الوسيط التسويقي: <strong>300 دولار</strong>.</p>' },
				{ q: 'متى يُعلَّق السحب؟', a: '<p>يُعلَّق السحب عند: وجود نزاع مفتوح، شبهة احتيال، نقص بيانات التحقق، أو مراجعة امتثال نشطة.</p>' },
				{ q: 'هل تصدر فواتير ضريبية؟', a: '<p>نعم، تُصدر فواتير ضريبية تلقائياً لكل معاملة مالية مستقرة وتظهر في صفحة الفواتير بحسابك.</p>' }
			]
		},
		{
			id: 's7', nav: 'الاعتماد', title: 'كيف أعتمد تخصصي كمقدم خدمة', icon: 'shield', icoStyle: ICO_TEAL,
			items: [
				{ q: 'كيف أضيف تخصصاً جديداً لحسابي؟', a: '<p>كل تخصص يحتاج اعتماداً مستقلاً: اختر التخصص، قدم وصف الخبرة أو عينة، ارفع نماذج أعمال مع إثبات الملكية. يُجرى تحليل تقني أولي بالذكاء الاصطناعي، يليه اعتماد أو رفض أو طلب استكمال من فريق مختص — قرار الاعتماد النهائي بشري دائماً.</p>' },
				{ q: 'كم مرة يمكنني إعادة رفع وثائق التحقق؟', a: '<p>3 محاولات خلال 30 يوماً من تاريخ الرفض الأول. بعدها يعلق المسار ويتطلب تواصلاً مع الدعم.</p>' }
			]
		},
		{
			id: 's8', nav: 'التعديلات والنطاق', title: 'ما الفرق بين تعديل وطلب تغيير نطاق', icon: 'alert', icoStyle: ICO_BLUE,
			items: [
				{ q: 'ما هو التعديل المشمول في العقد؟', a: '<p>التعديل هو طلب تصحيح أو تحسين يقع ضمن نطاق العمل وعدد التعديلات المحدد في العرض. مقدم الخدمة هو من يحدد عدد التعديلات في عرضه وهو ملتزم بما كتبه.</p>' },
				{ q: 'متى يصبح الطلب تغيير نطاق؟', a: '<p>إذا طلبت شيئاً خارج العقد الأصلي، فهو تغيير نطاق وليس تعديلاً. ينشأ طلب تغيير (نطاق أو ميزانية أو مدة) ولا يُعتمد إلا بموافقة الطرف الآخر قبل بدء التنفيذ.</p>' }
			]
		}
	];

	isOpen(si: number, ii: number): boolean {
		return this.open.has(si + '-' + ii);
	}

	toggleFaq(si: number, ii: number) {
		const key = si + '-' + ii;
		if (this.open.has(key)) this.open.delete(key); else this.open.add(key);
	}

	goSection(id: string) {
		this.activeSection = id;
		const el = document.getElementById(id);
		if (el) {
			const top = el.getBoundingClientRect().top + window.pageYOffset - 90;
			window.scrollTo({ top, behavior: 'smooth' });
		}
	}
}
