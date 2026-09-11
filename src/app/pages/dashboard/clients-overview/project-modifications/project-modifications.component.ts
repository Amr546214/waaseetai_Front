import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

interface AmendmentStep {
	label: string;
	state: 'done' | 'active' | 'pending';
	icon?: string;
}

interface AmendmentChange {
	scope: string;
	budget: string;
	budgetClass?: string;
	duration: string;
	durationClass?: string;
}

interface Amendment {
	id: string;
	title: string;
	subtitle: string;
	status: 'wait-provider' | 'wait-you' | 'approved';
	statusLabel: string;
	iconType: 'disp' | 'canc' | 'done';
	steps?: AmendmentStep[];
	changes?: AmendmentChange;
	aiText: string;
	aiDone?: boolean;
	aiIcon?: string;
	meta: string;
	ctaLabel: string;
	ctaVariant: 'primary' | 'ghost';
	unread?: number;
}

interface FilterTab {
	id: string;
	label: string;
	count: number;
}

@Component({
	selector: 'app-project-modifications',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './project-modifications.component.html',
	styleUrl: './project-modifications.component.css'
})
export class ProjectModificationsComponent {
	private authStore = inject(AuthStore);
	isCompanyMode = computed(() => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY);

	activeFilter = signal<string>('all');

	amendments: Amendment[] = [
		{
			id: 'CR-2026-021',
			title: 'إضافة مرحلة: صفحة هبوط للحملة',
			subtitle: 'CR-2026-021 · تصميم هوية بصرية · مع نورة التصميم',
			status: 'wait-provider',
			statusLabel: 'بانتظار رد المقدّم',
			iconType: 'disp',
			steps: [
				{ label: 'رُفع الطلب', state: 'done', icon: 'check' },
				{ label: 'تقييم الذكاء', state: 'done', icon: 'ai' },
				{ label: 'رد المقدّم', state: 'active', icon: 'person' },
				{ label: 'تحديث العقد', state: 'pending' }
			],
			changes: { scope: '+ مرحلة جديدة', budget: '+1,500 ريال', budgetClass: 'up', duration: '+5 أيام', durationClass: 'up' },
			aiText: 'الإضافة معقولة وسعرها ضمن سوق التصميم، يُقترح إيداع 1,500 ريال إضافية بالضمان عند موافقة المقدّم وتمديد التسليم 5 أيام',
			meta: 'سيُضاف للضمان عند الاعتماد',
			ctaLabel: 'متابعة النقاش',
			ctaVariant: 'primary',
			unread: 2
		},
		{
			id: 'CR-2026-018',
			title: 'تعديل من المقدّم: تمديد المدة',
			subtitle: 'CR-2026-018 · تطوير متجر · من تقنية الرواد',
			status: 'wait-you',
			statusLabel: 'بانتظار موافقتك',
			iconType: 'canc',
			steps: [
				{ label: 'رفعه المقدّم', state: 'done', icon: 'check' },
				{ label: 'تقييم الذكاء', state: 'done', icon: 'ai' },
				{ label: 'موافقتك', state: 'active', icon: 'person' },
				{ label: 'تحديث العقد', state: 'pending' }
			],
			changes: { scope: 'بلا تغيير', budget: 'بلا تغيير', duration: '+7 أيام', durationClass: 'up' },
			aiText: 'طلب التمديد مبرَّر بسبب توسيع نطاق ربط بوابات الدفع، ولا أثر على الميزانية. يُقترح القبول مع تثبيت موعد نهائي جديد',
			meta: 'لا أثر مالي · تمديد المدة فقط',
			ctaLabel: 'متابعة النقاش',
			ctaVariant: 'primary',
			unread: 1
		},
		{
			id: 'CR-2026-012',
			title: 'رفع الميزانية: عناصر إضافية',
			subtitle: 'CR-2026-012 · كتابة محتوى متجر · مع رشا الكاتبة',
			status: 'approved',
			statusLabel: 'مُعتمد ومُحدَّث',
			iconType: 'done',
			aiText: 'وافق الطرفان على إضافة 5 صفحات منتجات مقابل 600 ريال و3 أيام، وحُدِّث العقد وأُودع الفرق بالضمان',
			aiDone: true,
			aiIcon: 'check',
			meta: 'اعتُمد 14 مايو · +600 ريال للضمان',
			ctaLabel: 'عرض النقاش',
			ctaVariant: 'ghost'
		},
		{
			id: 'CR-2026-005',
			title: 'تقليص النطاق: حذف مرحلة',
			subtitle: 'CR-2026-005 · استشارة تسويقية · مع مكتب أفق',
			status: 'approved',
			statusLabel: 'مُعتمد ومُحدَّث',
			iconType: 'done',
			aiText: 'اتُّفق على حذف مرحلة التقارير الشهرية وردّ 800 ريال إليك من الضمان، وحُدِّث العقد',
			aiDone: true,
			aiIcon: 'check',
			meta: 'اعتُمد 2 مايو · رُدّ 800 ريال',
			ctaLabel: 'عرض النقاش',
			ctaVariant: 'ghost'
		}
	];

	tabs: FilterTab[] = [
		{ id: 'all', label: 'الكل', count: 4 },
		{ id: 'open', label: 'نشطة', count: 2 },
		{ id: 'closed', label: 'مُعتمدة', count: 2 }
	];

	stats = [
		{ icon: 'edit', iconClass: 'inv-ic-amber', value: '1', label: 'بانتظار رد المقدّم' },
		{ icon: 'person', iconClass: 'inv-ic-blue', value: '1', label: 'بانتظار موافقتك' },
		{ icon: 'check', iconClass: 'inv-ic-green', value: '2', label: 'مُعتمدة' },
		{ icon: 'ai', iconClass: 'inv-ic-ai', value: 'جارٍ', label: 'تقييم الذكاء' }
	];

	filteredAmendments = computed<Amendment[]>(() => {
		const filter = this.activeFilter();
		if (filter === 'all') return this.amendments;
		if (filter === 'open') return this.amendments.filter(a => a.status !== 'approved');
		if (filter === 'closed') return this.amendments.filter(a => a.status === 'approved');
		return this.amendments;
	});

	setFilter(filter: string) {
		this.activeFilter.set(filter);
	}
}
