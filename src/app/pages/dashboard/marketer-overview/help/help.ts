import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';

interface KbAnswer {
	a: string;
	links: [string, string][];
}

@Component({
	selector: 'app-marketer-help',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './help.html',
	styleUrl: './help.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Help implements OnInit {
	private overviewService = inject(MarketerOverviewService);

	summary = signal<MarketerSummary | null>(null);

	searchQuery = signal<string>('');
	searchedQuery = signal<string>('');
	aiAnswer = signal<KbAnswer | null>(null);
	isTyping = signal<boolean>(false);

	toastMessage = signal<string | null>(null);
	faqState = signal<boolean[]>([false, false, false, false, false]);

	// Client-side keyword matching — an honest, transparent FAQ search, not a
	// real AI call (there's no backend endpoint for that on this page).
	private knowledgeBase: { k: string[]; a: KbAnswer }[] = [
		{
			k: ['عمولة', 'العمولة', 'احتساب', 'نسبة'],
			a: { a: 'العمولة تُحتسب كنسبة من قيمة الخدمة المكتملة التي أحالها العميل عبر رابطك، وتُضاف لرصيدك القابل للسحب بعد إتمام المشروع وتقييمه.', links: [['بيانات العمولات', '/marketer-overview/commissions']] }
		},
		{
			k: ['مساعد', 'موصل', 'مستوى', 'المستوى', 'ترقية', 'ترقّي'],
			a: { a: 'مستوى موصل يمنحك نسبة عمولة أعلى بـ 5% ويُدرجك في قائمة الوسطاء المميزين المرئية للعملاء الجدد. الترقية تعتمد على عدد الإحالات الناجحة.', links: [['ملفي التسويقي', '/marketer-overview/profile/data']] }
		},
		{
			k: ['سحب', 'السحب', 'إيداع', 'ايداع', 'رصيد'],
			a: { a: 'طلبات السحب المؤكدة قبل الخميس تُودَع الأحد، والمؤكدة بعد الخميس تُودَع الأسبوع التالي في حسابك البنكي المسجّل.', links: [['طلب سحب', '/marketer-overview/withdraw']] }
		},
		{
			k: ['رابط', 'الرابط', 'إحالة', 'احالة', 'الإحالة'],
			a: { a: 'كل وسيط له رابط إحالة فريد يُتتبَّع تلقائيًا. إن لم تُسجَّل زيارة أو تسجيل عبر رابطك، تأكّد أنك تستخدم الرابط الكامل من صفحة روابط الإحالة دون تعديل.', links: [['روابط الإحالة', '/marketer-overview/ref-links']] }
		},
		{
			k: ['بريد', 'جوال', 'كلمة المرور', 'تعديل', 'أعدل', 'اعدل', 'رقم'],
			a: { a: 'البيانات الحسّاسة كالبريد والجوال وكلمة المرور تُعدّل عبر مسار محكوم من صفحة طلبات تعديل الملف، ليراجعها الفريق المختص قبل تطبيقها حفاظًا على أمان حسابك.', links: [['طلبات تعديل الملف', '/marketer-overview/profile/requests']] }
		},
		{
			k: ['ملف عام', 'الملف العام', 'قنوات', 'القنوات'],
			a: { a: 'ملفك العام يظهر للعملاء الذين يزورون رابط إحالتك. أضف صورة ووصفًا تسويقيًا وقنوات التواصل من صفحة ملفي التسويقي ليظهر تلقائيًا في ملفك العام.', links: [['ملفي التسويقي', '/marketer-overview/profile/data']] }
		},
	];

	ngOnInit(): void {
		this.overviewService.getSummary().subscribe(res => {
			if (res.success) this.summary.set(res.data);
		});
	}

	askAI(): void {
		const q = this.searchQuery().trim();
		if (!q) {
			this.showToast('اكتب سؤالك أولاً');
			return;
		}
		this.searchedQuery.set(q);
		this.aiAnswer.set(null);
		this.isTyping.set(true);

		setTimeout(() => {
			this.isTyping.set(false);
			const match = this.knowledgeBase.find(item => item.k.some(kw => q.includes(kw)));
			this.aiAnswer.set(match ? match.a : {
				a: 'لم أتأكّد تمامًا من قصدك. جرّب إعادة صياغة سؤالك، أو افتح تذكرة دعم ليتابع معك فريق الدعم البشري.',
				links: []
			});
		}, 700);
	}

	fillQ(text: string): void {
		this.searchQuery.set(text);
		this.askAI();
	}

	toggleFaq(index: number): void {
		const state = [...this.faqState()];
		state[index] = !state[index];
		this.faqState.set(state);
	}

	showToast(msg: string): void {
		this.toastMessage.set(msg);
		setTimeout(() => this.toastMessage.set(null), 3000);
	}
}
