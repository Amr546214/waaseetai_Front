import { Component, Input, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

interface ArticleSection { id: string; title: string; content: (string | string[])[]; }
interface ArticleDoc { title: string; subtitle: string; sections: ArticleSection[]; }

@Component({
	selector: 'app-help-article',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './help-article.component.html',
	styleUrls: ['./help-article.component.css']
})
export class HelpArticleComponent {
	@Input() article!: 'escrow' | 'disputes' | 'ai' | 'commissions';
	activeSection = 's1';

	constructor(@Inject(PLATFORM_ID) private platformId: Object, private route: ActivatedRoute) {}

	ngOnInit() {
		if (!this.article) {
			const data = this.route.snapshot.data;
			if (data && data['article']) this.article = data['article'];
		}
	}

	get document(): ArticleDoc {
		switch (this.article) {
			case 'escrow': return ESCROW_ARTICLE;
			case 'disputes': return DISPUTES_ARTICLE;
			case 'ai': return AI_ARTICLE;
			case 'commissions': return COMMISSIONS_ARTICLE;
			default: return ESCROW_ARTICLE;
		}
	}

	@HostListener('window:scroll')
	onScroll() {
		if (isPlatformBrowser(this.platformId)) {
			const scrollPosition = window.scrollY + 150;
			for (const sec of this.document.sections) {
				const el = document.getElementById(sec.id);
				if (el) {
					const top = el.offsetTop;
					const height = el.offsetHeight;
					if (scrollPosition >= top && scrollPosition < top + height) {
						this.activeSection = sec.id;
					}
				}
			}
		}
	}

	scrollTo(sectionId: string) {
		if (isPlatformBrowser(this.platformId)) {
			const element = document.getElementById(sectionId);
			if (element) {
				const y = element.getBoundingClientRect().top + window.scrollY - 100;
				window.scrollTo({ top: y, behavior: 'smooth' });
				this.activeSection = sectionId;
			}
		}
	}
}

const ESCROW_ARTICLE: ArticleDoc = {
	title: 'كيف يعمل حساب الضمان وكيف يحمي مالي؟',
	subtitle: 'مركز المساعدة — وسيط AI',
	sections: [
		{ id: 's1', title: 'كيف يعمل خطوة بخطوة', content: [
			'عند بدء المشروع، يُودع المبلغ بالكامل في حساب الضمان المالي. لا يصل مقدم الخدمة للمبلغ قبل استيفاء شروط الإفراج.',
			'الإيداع يُحجز بالكامل حتى إفراج المرحلة المعنية. لا يتم تحويل أي مبلغ قبل تأكيد الإيداع.'
		]},
		{ id: 's2', title: 'متى أسترد مالي؟', content: [
			'تسترد مالك في الحالات التالية:',
			['إلغاء المشروع قبل بدء العمل الفعلي', 'فشل مقدم الخدمة في التسليم وثبوت ذلك', 'اتفاق الطرفين على الإلغاء', 'قرار نزاع لصالحك'],
			'يُعاد المبلغ إلى محفظتك أو بطاقتك حسب طريقة الدفع الأصلية.'
		]},
		{ id: 's3', title: 'متى يُفرج عن المبلغ لمقدم الخدمة؟', content: [
			'يحدث الإفراج عند اجتماع أربعة شروط:',
			['تسليم المرحلة أو العمل المتفق عليه', 'مراجعة AI للتسليم', 'قبول طالب الخدمة أو انتهاء مهلة المراجعة بدون اعتراض', 'عدم وجود نزاع أو تجميد مفتوح'],
			'عند استيفاء جميع الشروط، يُحوّل المبلغ تلقائياً إلى محفظة مقدم الخدمة.'
		]}
	]
};

const DISPUTES_ARTICLE: ArticleDoc = {
	title: 'كيف أفتح نزاعاً وماذا يحدث بعده؟',
	subtitle: 'مركز المساعدة — وسيط AI',
	sections: [
		{ id: 's1', title: 'متى يحق لي فتح نزاع؟', content: [
			'يمكنك فتح نزاع إذا: لم يُسلَّم العمل في الموعد المتفق، أو كان التسليم مخالفاً جوهرياً للعقد، أو وجدت مشكلة واضحة في الجودة خلال مهلة المراجعة.'
		]},
		{ id: 's2', title: 'ماذا يحدث بعد فتح النزاع؟', content: [
			'يُعلَّق الإفراج عن المبلغ المرتبط بالنزاع. يُحلل AI الأدلة من الطرفين ويُصدر قراراً أولياً. القرار قابل للاعتراض خلال 48 ساعة بسبب موثق.'
		]},
		{ id: 's3', title: 'الاعتراض على قرار AI', content: [
			'يمكنك الاعتراض خلال 48 ساعة مع تقديم سبب موثق ودليل جديد. القرار لا يُلغى بمجرد عدم الرضا — يجب وجود سبب حقيقي كخطأ في فهم العقد أو دليل جديد.'
		]}
	]
};

const AI_ARTICLE: ArticleDoc = {
	title: 'كيف يعمل AI في وسيط AI؟',
	subtitle: 'مركز المساعدة — وسيط AI',
	sections: [
		{ id: 's1', title: 'أدوار AI الثلاثة', content: [
			'يؤدي AI ثلاثة أدوار:',
			['توصية: يساعد في صياغة الطلب، تحليل العرض، تنبيهات السعر والمدة', 'تقييم: جودة التسليم، التخصصات، مؤشرات الأداء', 'قرار نزاع أولي: مبني على الأدلة وقابل للاعتراض']
		]},
		{ id: 's2', title: 'هل يمكن لـAI أن يخطئ؟', content: [
			'AI مساعد وليس ضماناً مطلقاً. قراراته مبنية على البيانات المتاحة وقابلة للاعتراض. المراجعة البشرية إلزامية للمشاريع التي تبلغ 10,000 ريال أو أكثر.'
		]},
		{ id: 's3', title: 'ما الذي يظهر للمستخدم؟', content: [
			'تُعرض نسبة التطابق، ملاحظات النطاق والمخرجات، والتحذيرات عند الحاجة. لا تُعرض المعادلات الداخلية أو أوزان مكافحة التلاعب.'
		]}
	]
};

const COMMISSIONS_ARTICLE: ArticleDoc = {
	title: 'كيف تعمل عمولة الوسيط التسويقي؟',
	subtitle: 'مركز المساعدة — وسيط AI',
	sections: [
		{ id: 's1', title: 'متى تستحق العمولة؟', content: [
			'العمولة لا تُحسب عند التسجيل أو الإيداع. تُحسب فقط عند إفراج مرحلة أو استقرار معاملة مالية معتمدة من عميل أُحيل عبر رابطك.'
		]},
		{ id: 's2', title: 'قاعدة First-Touch', content: [
			'أول وسيط موثق يجلب المستخدم يبقى صاحب ارتباط الإحالة لذلك المستخدم مدى الحياة — ما لم يثبت تلاعب أو إحالة ذاتية أو قرار إداري بإبطاله.'
		]},
		{ id: 's3', title: 'منع الإحالة الذاتية', content: [
			'الإحالة الذاتية والحسابات المرتبطة مرفوضة. عند الثبوت، تُجمَّد العمولة أو تُلغى مع تسجيل القرار.'
		]}
	]
};
