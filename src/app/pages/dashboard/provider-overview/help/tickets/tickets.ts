import { Component, ChangeDetectionStrategy, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

interface Ticket {
	id: string;
	title: string;
	category: string;
	timestamp: string;
	status: 'review' | 'wait' | 'ai' | 'open' | 'solved' | 'closed';
	statusLabel: string;
	icon: 'escrow' | 'wallet' | 'ai' | 'list' | 'check' | 'doc';
}

@Component({
	selector: 'app-provider-tickets',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './tickets.html',
	styleUrls: ['./tickets.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketsComponent {
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	filter = signal<string>('all');

	private individualTickets: Ticket[] = [
		{ id: 'TK-4821', title: 'تأخر الإفراج عن مبلغ الضمان', category: 'العقود والضمان', timestamp: 'قبل ساعتين', status: 'review', statusLabel: 'لدى فريق الدعم', icon: 'escrow' },
		{ id: 'TK-4815', title: 'توضيح مطلوب لإكمال تسوية رصيد', category: 'المدفوعات', timestamp: 'أمس', status: 'wait', statusLabel: 'بانتظار ردّك', icon: 'wallet' },
		{ id: 'TK-4805', title: 'استفسار عن طريقة احتساب الكاش باك', category: 'المدفوعات', timestamp: 'أمس', status: 'ai', statusLabel: 'يعالجها المساعد الذكي', icon: 'ai' },
		{ id: 'TK-4799', title: 'طلب تعديل وصف العرض قبل الإرسال', category: 'الطلبات والعروض', timestamp: 'اليوم', status: 'open', statusLabel: 'مفتوحة', icon: 'list' },
		{ id: 'TK-4790', title: 'تعذّر رفع ملف تسليم في المشروع', category: 'المشاريع والتسليم', timestamp: 'حُلَّت قبل 3 أيام', status: 'solved', statusLabel: 'محلولة', icon: 'check' },
		{ id: 'TK-4772', title: 'استفسار عن فاتورة رسمية', category: 'الفواتير', timestamp: 'مغلقة قبل أسبوع', status: 'closed', statusLabel: 'مغلقة', icon: 'doc' }
	];

	private companyTickets: Ticket[] = [
		{ id: '2026-0188', title: 'أمر تغيير معتمد لم يُضف لمحفظة الشركة', category: 'مالية', timestamp: 'منذ ساعة', status: 'review', statusLabel: 'قيد المعالجة', icon: 'wallet' },
		{ id: '2026-0184', title: 'طلب تفعيل تخصص الذكاء الاصطناعي', category: 'سوق', timestamp: 'منذ 3 ساعات', status: 'wait', statusLabel: 'بانتظار ردّك', icon: 'list' },
		{ id: '2026-0179', title: 'خطأ في عرض مراحل مشروع PRJ-3084', category: 'تقني', timestamp: 'أمس', status: 'open', statusLabel: 'قيد المعالجة', icon: 'escrow' },
		{ id: '2026-0175', title: 'صلاحيات عضو فريق لا تُحدَّث', category: 'فريق', timestamp: 'أمس', status: 'wait', statusLabel: 'بانتظار ردّك', icon: 'list' },
		{ id: '2026-0160', title: 'تعذّر رفع مستند اعتماد نموذج', category: 'سوق', timestamp: 'حُلَّت قبل يومين', status: 'solved', statusLabel: 'محلولة', icon: 'check' },
		{ id: '2026-0142', title: 'استفسار عن فاتورة ضريبية سابقة', category: 'مالية', timestamp: 'مغلقة قبل أسبوع', status: 'closed', statusLabel: 'مغلقة', icon: 'doc' }
	];

	tickets = computed<Ticket[]>(() => this.isCompanyMode() ? this.companyTickets : this.individualTickets);

	filters = computed(() => {
		const t = this.tickets();
		const count = (pred: (t: Ticket) => boolean) => t.filter(pred).length;
		return [
			{ key: 'all', label: 'الكل', count: t.length },
			{ key: 'open', label: 'مفتوحة', count: count(x => x.status === 'open') },
			{ key: 'review', label: 'قيد المراجعة', count: count(x => x.status === 'review' || x.status === 'ai') },
			{ key: 'wait', label: 'بانتظار ردّك', count: count(x => x.status === 'wait') },
			{ key: 'solved', label: 'محلولة', count: count(x => x.status === 'solved') },
			{ key: 'closed', label: 'مغلقة', count: count(x => x.status === 'closed') }
		];
	});

	stats = computed(() => {
		const t = this.tickets();
		return {
			openCount: t.filter(x => x.status === 'open' || x.status === 'review' || x.status === 'ai').length,
			waitCount: t.filter(x => x.status === 'wait').length,
			solvedCount: t.filter(x => x.status === 'solved').length,
			avgResponse: '4س'
		};
	});

	filteredTickets = computed(() => {
		const f = this.filter();
		const t = this.tickets();
		if (f === 'all') return t;
		return t.filter(x => {
			if (f === 'review') return x.status === 'review' || x.status === 'ai';
			return x.status === f;
		});
	});

	setFilter(key: string) {
		this.filter.set(key);
	}

	statusClass(status: string): string {
		return `tks-${status}`;
	}

	routeId(id: string): string {
		return id.replace(/^TK-/, '');
	}
}
