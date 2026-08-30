import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

type AmendmentStatus = 'open' | 'closed';
type WaitOn = 'provider' | 'client' | 'done';

interface ChangeItem {
	label: string;
	value: string;
	isUp?: boolean;
}

interface Amendment {
	id: string;
	title: string;
	subtitle: string;
	status: AmendmentStatus;
	waitOn: WaitOn;
	icon: 'edit' | 'hands' | 'done';
	flowStep: number; // 0: submitted, 1: AI evaluated, 2: pending reply, 3: updated
	changes: ChangeItem[];
	aiAssessment: string;
	metaText: string;
	unreadCount?: number;
	actionText: string;
	isAiDone?: boolean;
}

@Component({
	selector: 'app-amendments-project',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './amendments-project.html',
})
export class AmendmentsProject {
	activeFilter = signal<'all' | AmendmentStatus>('all');

	amendments = signal<Amendment[]>([
		{
			id: 'CR-2026-021',
			title: 'إضافة مرحلة: صفحة هبوط للحملة',
			subtitle: 'تصميم هوية بصرية · مع نورة التصميم',
			status: 'open',
			waitOn: 'provider',
			icon: 'edit',
			flowStep: 2, // Pending provider
			changes: [
				{ label: 'النطاق', value: '+ مرحلة جديدة' },
				{ label: 'الميزانية', value: '+1,500 ريال', isUp: true },
				{ label: 'المدة', value: '+5 أيام', isUp: true }
			],
			aiAssessment: 'الإضافة معقولة وسعرها ضمن سوق التصميم، يُقترح إيداع 1,500 ريال إضافية بالضمان عند موافقة المقدّم وتمديد التسليم 5 أيام',
			metaText: 'سيُضاف للضمان عند الاعتماد',
			unreadCount: 2,
			actionText: 'متابعة النقاش'
		},
		{
			id: 'CR-2026-018',
			title: 'تعديل من المقدّم: تمديد المدة',
			subtitle: 'تطوير متجر · من تقنية الرواد',
			status: 'open',
			waitOn: 'client',
			icon: 'hands',
			flowStep: 2, // Pending client
			changes: [
				{ label: 'النطاق', value: 'بلا تغيير' },
				{ label: 'الميزانية', value: 'بلا تغيير' },
				{ label: 'المدة', value: '+7 أيام', isUp: true }
			],
			aiAssessment: 'طلب التمديد مبرَّر بسبب توسيع نطاق ربط بوابات الدفع، ولا أثر على الميزانية. يُقترح القبول مع تثبيت موعد نهائي جديد',
			metaText: 'لا أثر مالي · تمديد المدة فقط',
			unreadCount: 1,
			actionText: 'متابعة النقاش'
		},
		{
			id: 'CR-2026-012',
			title: 'رفع الميزانية: عناصر إضافية',
			subtitle: 'كتابة محتوى متجر · مع رشا الكاتبة',
			status: 'closed',
			waitOn: 'done',
			icon: 'done',
			flowStep: 4,
			isAiDone: true,
			changes: [],
			aiAssessment: 'وافق الطرفان على إضافة 5 صفحات منتجات مقابل 600 ريال و3 أيام، وحُدِّث العقد وأُودع الفرق بالضمان',
			metaText: 'اعتُمد 14 مايو · +600 ريال للضمان',
			actionText: 'عرض النقاش'
		},
		{
			id: 'CR-2026-005',
			title: 'تقليص النطاق: حذف مرحلة',
			subtitle: 'استشارة تسويقية · مع مكتب أفق',
			status: 'closed',
			waitOn: 'done',
			icon: 'done',
			flowStep: 4,
			isAiDone: true,
			changes: [],
			aiAssessment: 'اتُّفق على حذف مرحلة التقارير الشهرية وردّ 800 ريال إليك من الضمان، وحُدِّث العقد',
			metaText: 'اعتُمد 2 مايو · رُدّ 800 ريال',
			actionText: 'عرض النقاش'
		}
	]);

	filteredAmendments = computed(() => {
		const filter = this.activeFilter();
		if (filter === 'all') return this.amendments();
		return this.amendments().filter(a => a.status === filter);
	});

	setFilter(filter: 'all' | AmendmentStatus) {
		this.activeFilter.set(filter);
	}

	getCount(filter: 'all' | AmendmentStatus): number {
		if (filter === 'all') return this.amendments().length;
		return this.amendments().filter(a => a.status === filter).length;
	}
}
