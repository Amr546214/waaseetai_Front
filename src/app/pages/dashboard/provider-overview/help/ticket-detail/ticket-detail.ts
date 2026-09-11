import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

interface TimelineStep { label: string; state: 'done' | 'active' | 'idle'; }
interface ChatMessage { from: 'me' | 'ai' | 'agent' | 'sys'; name?: string; time: string; text: string; isAi?: boolean; isAgent?: boolean; }

@Component({
	selector: 'app-ticket-detail',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './ticket-detail.html',
	styleUrls: ['./ticket-detail.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketDetailComponent {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	ticketId = signal<string>('TK-—');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	replyText = signal<string>('');
	toast = signal<string | null>(null);

	ticket = signal<any>(null);
	timeline = signal<TimelineStep[]>([]);
	messages = signal<ChatMessage[]>([]);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id') || '—';
		this.ticketId.set(`TK-${id}`);
		this.loadTicket(id);
	}

	loadTicket(id: string) {
		this.isLoading.set(true);
		this.hasError.set(false);
		// Simulate loading from API — replace with real API call when backend supports tickets
		setTimeout(() => {
			if (this.isCompanyMode()) {
				this.ticket.set({
					id: `TKT-2026-0188`,
					title: 'أمر تغيير معتمد لم يُضف لمحفظة الشركة',
					createdAt: '22 يوليو 2026',
					status: 'processing',
					statusLabel: 'قيد المعالجة',
					category: 'مالية',
					priority: 'متوسطة',
					priorityColor: '#FFB400',
					related: 'PRJ-3091',
					updatedAt: 'منذ ساعة',
				});
				this.timeline.set([
					{ label: 'فُتحت التذكرة', state: 'done' },
					{ label: 'أُحيلت لفريق المالية', state: 'done' },
					{ label: 'تم التحقق من حالة المبلغ', state: 'done' },
					{ label: 'متابعة حتى الإفراج', state: 'active' },
				]);
				this.messages.set([
					{ from: 'me', name: 'الخليج للتقنية', time: '22 يوليو 2026 — 09:12', text: 'وافق العميل على أمر التغيير في مشروع PRJ-3091 بتاريخ 20 يوليو، والمبلغ لم يظهر في محفظة الشركة حتى الآن. أرفقت لقطة شاشة للمحفظة وسجل أمر التغيير.' },
					{ from: 'agent', name: 'فريق الدعم', time: '22 يوليو 2026 — 11:40', isAgent: true, text: 'شكراً لتواصلك. استلمنا التذكرة وأحلناها لفريق المالية للتحقق من حالة المبلغ في حساب الضمان. سنوافيك بالنتيجة خلال يوم عمل.' },
					{ from: 'agent', name: 'عبدالله المطيري', time: '23 يوليو 2026 — 10:05', isAgent: true, text: 'تم التحقق: مبلغ أمر التغيير محتجز في حساب الضمان مرتبطاً بالمرحلة الثالثة، ويُفرَج عنه تلقائياً بعد اعتماد العميل لتسليم المرحلة. لا يوجد خلل في العملية.' },
					{ from: 'me', name: 'الخليج للتقنية', time: '23 يوليو 2026 — 13:22', text: 'واضح، شكراً للتوضيح. أرجو إبقاء التذكرة مفتوحة حتى يتم الإفراج فعلياً لنتأكد من ظهور المبلغ في سجل المعاملات.' },
					{ from: 'agent', name: 'عبدالله المطيري', time: '25 يوليو 2026 — 11:09', isAgent: true, text: 'تمام، أبقيتُ التذكرة مفتوحة مع تنبيه متابعة. بمجرد اعتماد التسليم سيظهر المبلغ في سجل معاملات الشركة وسنؤكد لك ذلك على التذكرة.' },
				]);
			} else {
				this.ticket.set({
					id: `TK-${id}`,
					title: 'تأخر الإفراج عن مبلغ الضمان',
					createdAt: '21 يونيو 2026',
					status: 'human',
					statusLabel: 'لدى فريق الدعم',
					category: 'العقود والضمان',
					priority: 'عالية',
					priorityColor: '#D98A0B',
					related: 'ORD-3092',
					updatedAt: 'قبل ساعتين',
					aiVerdict: 'صُنِّفت التذكرة تحت «العقود والضمان» بأولوية عالية لتعلّقها بمبلغ محتجز، ووُجِّهت لفريق الدعم المالي. اقتراح أولي: غالبًا التأخير بسبب عدم اكتمال «قبول التسليم» من طرفك'
				});
				this.timeline.set([
					{ label: 'مفتوحة', state: 'done' },
					{ label: 'فرز الذكاء', state: 'done' },
					{ label: 'قيد مراجعة الدعم', state: 'active' },
					{ label: 'الحل', state: 'idle' },
					{ label: 'الإغلاق', state: 'idle' }
				]);
				this.messages.set([
					{ from: 'sys', time: '21 يونيو 10:02ص', text: 'أنشئت التذكرة وصنّفها المساعد الذكي تلقائيًّا' },
					{ from: 'me', name: 'أنت', time: '10:02ص', text: 'سلّمت المشروع منذ يومين والمقدّم أكّد الإنهاء، لكن مبلغ الضمان لم يُفرَج بعد ولا أعرف سبب التأخير' },
					{ from: 'ai', name: 'المساعد الذكي', time: '10:02ص', isAi: true, text: 'يُفرَج مبلغ الضمان تلقائيًّا فور ضغطك «قبول التسليم» من صفحة المشروع. يبدو أن خطوة القبول لم تكتمل بعد. راجع التسليم واعتمده، وإن كان معتمدًا فعلًا فقد رفعت تذكرتك لفريق الدعم المالي للتحقق.' },
					{ from: 'agent', name: 'سارة · فريق الدعم المالي', time: 'قبل ساعتين', isAgent: true, text: 'شكرًا لتواصلك. راجعنا المشروع ORD-3092 ووجدنا أن التسليم بانتظار اعتمادك النهائي من صفحة «مراجعة التسليم». بمجرد اعتمادك يُفرَج المبلغ فورًا. هل ترغب أن نرشدك للخطوة؟' }
				]);
			}
			this.isLoading.set(false);
		}, 400);
	}

	retry() { this.loadTicket(this.ticketId().replace('TK-', '')); }

	sendReply() {
		const text = this.replyText().trim();
		if (!text) return;
		this.messages.update(msgs => [...msgs, { from: 'me', name: 'أنت', time: 'الآن', text }]);
		this.replyText.set('');
		this.showToast('تم إرسال ردّك');
	}

	markResolved() { this.showToast('وُسمت التذكرة كمحلولة، شكرًا لك'); }
	escalate() { this.showToast('طُلب تصعيد التذكرة لمشرف الدعم'); }
	closeTicket() { this.showToast('أُغلقت التذكرة، يمكنك إعادة فتحها لاحقًا'); }

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}

	goBack() {
		const route = this.isCompanyMode() ? '/provider-overview/help' : '/client-overview/help';
		this.router.navigate([route]);
	}
}
