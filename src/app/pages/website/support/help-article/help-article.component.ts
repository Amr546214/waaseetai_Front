import { Component, Input, HostListener, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

type ArticleKey = 'escrow' | 'disputes' | 'ai' | 'commissions';
interface ArticleSection { id: string; title: string; content: (string | string[])[]; }
interface ArticleDoc {
	title: string;
	/** Badge + breadcrumb category (design P-SP-002 shows "الدفع والمدفوعات" for the escrow article). */
	category: string;
	/** Last breadcrumb segment. */
	crumb: string;
	icon: 'shield' | 'alert' | 'trust-ai' | 'broker';
	sections: ArticleSection[];
}
interface RelatedLink { title: string; route: string; dot: string; }

@Component({
	selector: 'app-help-article',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './help-article.component.html',
	styleUrls: ['./help-article.component.css']
})
export class HelpArticleComponent implements OnInit {
	@Input() article!: ArticleKey;
	activeSection = 's1';
	/** Reading-progress width in %, like the design's progress bar. */
	progress = 0;
	/** Design: "نعم، مفيد" turns into "شكراً!" once clicked. */
	helpful = false;

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

	/** Reading time computed from the article's own text (≈200 words/minute). */
	get readingTime(): string {
		const text = this.document.sections.map(s => s.title + ' ' + s.content.flat().join(' ')).join(' ');
		const mins = Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 200));
		if (mins === 1) return 'دقيقة قراءة';
		if (mins === 2) return 'دقيقتان قراءة';
		return mins + ' دقائق قراءة';
	}

	/** The other help articles (real routes) + guest request tracking, as in the design's related list. */
	get related(): RelatedLink[] {
		const all: { key: ArticleKey; link: RelatedLink }[] = [
			{ key: 'escrow', link: { title: ESCROW_ARTICLE.title, route: '/support/help-article/escrow', dot: 'var(--teal)' } },
			{ key: 'disputes', link: { title: DISPUTES_ARTICLE.title, route: '/support/help-article/disputes', dot: 'var(--kahr)' } },
			{ key: 'ai', link: { title: AI_ARTICLE.title, route: '/support/help-article/ai', dot: 'var(--blue-txt)' } },
			{ key: 'commissions', link: { title: COMMISSIONS_ARTICLE.title, route: '/support/help-article/commissions', dot: 'var(--blue-txt)' } }
		];
		const current = this.article || 'escrow';
		return [
			...all.filter(a => a.key !== current).map(a => a.link),
			{ title: 'تتبع طلب بدون تسجيل', route: '/support/track-request', dot: 'var(--teal)' }
		];
	}

	isList(block: string | string[]): block is string[] {
		return Array.isArray(block);
	}

	@HostListener('window:scroll')
	onScroll() {
		if (isPlatformBrowser(this.platformId)) {
			// Whole-page progress: scrollY / (scrollHeight - innerHeight), so it is 0% at the top and
			// exactly 100% at the real end of the page (content after the article body, e.g. the footer,
			// no longer leaves the bar short).
			const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
			this.progress = maxScroll > 0 ? Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100)) : 0;
			const scrollPosition = window.scrollY + 150;
			for (const sec of this.document.sections) {
				const el = document.getElementById(sec.id);
				if (el) {
					const top = el.getBoundingClientRect().top + window.scrollY;
					if (scrollPosition >= top) this.activeSection = sec.id;
				}
			}
		}
	}

	scrollTo(sectionId: string) {
		if (isPlatformBrowser(this.platformId)) {
			const element = document.getElementById(sectionId);
			if (element) {
				const y = element.getBoundingClientRect().top + window.pageYOffset - 90;
				window.scrollTo({ top: y, behavior: 'smooth' });
				this.activeSection = sectionId;
			}
		}
	}
}

const ESCROW_ARTICLE: ArticleDoc = {
	title: 'كيف يعمل حساب الضمان وكيف يحمي مالي؟',
	category: 'الدفع والمدفوعات', crumb: 'حساب الضمان', icon: 'shield',
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
			'يحدث الإفراج عند اجتماع ثلاثة شروط:',
			['تسليم المرحلة أو العمل المتفق عليه', 'اعتماد طالب الخدمة يدوياً أو انتهاء مهلة المراجعة بدون اعتراض', 'عدم وجود نزاع أو تجميد مفتوح'],
			'عند استيفاء جميع الشروط، يُحوّل المبلغ تلقائياً إلى محفظة مقدم الخدمة. القرار النهائي بالاعتماد يبقى بيد طالب الخدمة دائماً — أي تحليل استشاري بالذكاء الاصطناعي لا يُفرج عن أي مبلغ ولا يُعد شرطاً للإفراج.'
		]}
	]
};

const DISPUTES_ARTICLE: ArticleDoc = {
	title: 'كيف أفتح نزاعاً وماذا يحدث بعده؟',
	category: 'النزاعات', crumb: 'فتح نزاع', icon: 'alert',
		sections: [
		{ id: 's1', title: 'متى يحق لي فتح نزاع؟', content: [
			'يمكنك فتح نزاع إذا: لم يُسلَّم العمل في الموعد المتفق، أو كان التسليم مخالفاً جوهرياً للعقد، أو وجدت مشكلة واضحة في الجودة خلال مهلة المراجعة.'
		]},
		{ id: 's2', title: 'ماذا يحدث بعد فتح النزاع؟', content: [
			'يراجع فريق الإدارة تفاصيل النزاع والأدلة المرفقة من الطرفين، ثم يصدر قراراً نهائياً بقبول النزاع أو رفضه مع توضيح السبب.'
		]}
	]
};

const AI_ARTICLE: ArticleDoc = {
	title: 'كيف يعمل AI في وسيط AI؟',
	category: 'تقييم AI', crumb: 'دور AI', icon: 'trust-ai',
		sections: [
		{ id: 's1', title: 'أدوار AI', content: [
			'يؤدي AI دورين أساسيين:',
			['توصية: يساعد في صياغة الطلب، تحليل العرض، تنبيهات السعر والمدة', 'تقييم: جودة التسليم، التخصصات، مؤشرات الأداء']
		]},
		{ id: 's2', title: 'هل يمكن لـAI أن يخطئ؟', content: [
			'AI مساعد وليس ضماناً مطلقاً. توصياته وتقييماته مبنية على البيانات المتاحة، والقرار النهائي يبقى لك أو لفريق الإدارة.'
		]},
		{ id: 's3', title: 'ما الذي يظهر للمستخدم؟', content: [
			'تُعرض نسبة التطابق، ملاحظات النطاق والمخرجات، والتحذيرات عند الحاجة. لا تُعرض المعادلات الداخلية أو أوزان التقييم التفصيلية.'
		]}
	]
};

const COMMISSIONS_ARTICLE: ArticleDoc = {
	title: 'كيف تعمل عمولة الوسيط التسويقي؟',
	category: 'عمولة الوسيط', crumb: 'عمولة الوسيط', icon: 'broker',
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
