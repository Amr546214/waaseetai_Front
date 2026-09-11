import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ChangeOrder {
	id: string;
	title: string;
	type: 'scope' | 'time' | 'price';
	member: string;
	memberInitials: string;
	memberColor: string;
	project: string;
	ctId: string;
	from: string;
	status: 'pending' | 'review' | 'approved';
	pillLabel: string;
	diff: { label: string; value: string; isNew?: boolean; strike?: boolean; color?: string }[];
	aiNote: string;
	urgent?: boolean;
}

@Component({
	selector: 'app-change-orders',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './change-orders.component.html',
	styleUrls: ['./change-orders.component.css']
})
export class ChangeOrdersComponent {
	activeFilter = signal<string>('all');
	toast = signal<string | null>(null);

	filters = [
		{ id: 'all', label: 'الكل', count: 4 },
		{ id: 'pending', label: 'بانتظار الرد', count: 2 },
		{ id: 'review', label: 'قيد المراجعة', count: 1 },
		{ id: 'approved', label: 'مقبول', count: 1 },
	];

	kpis = [
		{ label: 'أوامر نشطة', value: 4, color: '#2BD4C7', sub: 'بانتظار إجراء' },
		{ label: 'بانتظار رد الفريق', value: 2, color: '#FFB400', sub: 'تحتاج توجيه' },
		{ label: 'قيد المراجعة', value: 1, color: '#5DA0FF', sub: 'من العميل' },
		{ label: 'مقبولة هذا الشهر', value: 7, color: '#2ECC8A', sub: '↑ 2 عن الشهر الماضي' },
	];

	orders: ChangeOrder[] = [
		{
			id: 'CO-001', title: 'إضافة وحدة إدارة المخزون للمتجر', type: 'scope',
			member: 'فهد العتيبي', memberInitials: 'فه', memberColor: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
			project: 'متجر أغذية', ctId: 'CT-2428', from: 'من العميل قبل يومين',
			status: 'pending', pillLabel: 'بانتظار رد فهد', urgent: true,
			diff: [
				{ label: 'النطاق الحالي', value: '5 وحدات أساسية فقط' },
				{ label: 'التعديل المطلوب', value: '5 وحدات + وحدة مخزون كاملة', isNew: true },
				{ label: 'السعر الحالي', value: '21,000 ريال', strike: true },
				{ label: 'السعر المقترح', value: '23,500 ريال', isNew: true },
			],
			aiNote: 'AI: الطلب معقول تقنياً — إضافة 10-12 يوماً وبرمجة ~2,500 ريال. ينصح بالقبول مع تعديل المدة.',
		},
		{
			id: 'CO-002', title: 'تمديد المدة 7 أيام بسبب تعديلات العميل', type: 'time',
			member: 'ريم الدوسري', memberInitials: 'ري', memberColor: 'linear-gradient(135deg,#0FA99A,#0D8A7E)',
			project: 'تطبيق مطاعم', ctId: 'CT-2391', from: 'طلبته ريم قبل 3 أيام',
			status: 'pending', pillLabel: 'بانتظار رد العميل',
			diff: [
				{ label: 'المدة الحالية', value: '25 يوماً', strike: true },
				{ label: 'المدة الجديدة', value: '32 يوماً', isNew: true },
				{ label: 'السبب', value: 'تعديلات واجهة طلبها العميل في المرحلة 3' },
				{ label: 'أثر السعر', value: 'بدون تغيير', isNew: true },
			],
			aiNote: 'AI: التمديد مبرر — التعديلات طلبها العميل وخارج النطاق الأصلي. توقع قبول العميل بنسبة 87%.',
		},
		{
			id: 'CO-003', title: 'تقليص النطاق — حذف لوحة الإدارة', type: 'price',
			member: 'فهد العتيبي', memberInitials: 'فه', memberColor: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
			project: 'متجر أغذية', ctId: 'CT-2428', from: 'من العميل اليوم',
			status: 'review', pillLabel: 'قيد المراجعة',
			diff: [
				{ label: 'النطاق الحالي', value: '5 وحدات شاملة لوحة إدارة' },
				{ label: 'النطاق الجديد', value: '4 وحدات بدون لوحة إدارة', isNew: true },
				{ label: 'السعر الحالي', value: '21,000 ريال' },
				{ label: 'السعر الجديد', value: '18,500 ريال (–2,500)', isNew: true, color: '#FFB400' },
			],
			aiNote: 'AI: تقليص السعر 11.9% — تأكّد أن فهد لم يبدأ العمل على لوحة الإدارة قبل القبول.',
		},
		{
			id: 'CO-004', title: 'إضافة دعم iOS للتطبيق', type: 'scope',
			member: 'ريم الدوسري', memberInitials: 'ري', memberColor: 'linear-gradient(135deg,#0FA99A,#0D8A7E)',
			project: 'تطبيق مطاعم', ctId: 'CT-2391', from: 'قُبل قبل أسبوع',
			status: 'approved', pillLabel: 'مقبول',
			diff: [
				{ label: 'قبل', value: 'Android فقط' },
				{ label: 'بعد', value: 'Android + iOS', isNew: true },
				{ label: 'السعر السابق', value: '35,000 ريال', strike: true },
				{ label: 'السعر الجديد', value: '42,000 ريال', isNew: true },
			],
			aiNote: 'AI: تم القبول — المبلغ مُفرَّج في محفظة الشركة ومرتبط بمرحلة iOS.',
		},
	];

	filteredOrders = computed<ChangeOrder[]>(() => {
		if (this.activeFilter() === 'all') return this.orders;
		return this.orders.filter(o => o.status === this.activeFilter());
	});

	setFilter(id: string) { this.activeFilter.set(id); }

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}

	typeIcon(type: string): string {
		const map: Record<string, string> = { scope: 'edit', time: 'clock', price: 'money' };
		return map[type] || 'edit';
	}
}
