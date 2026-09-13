import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

export interface TeamDelivery {
	id: number;
	memberId: string;
	memberName: string;
	memberSpec: string;
	memberInitials: string;
	memberGradient: string;
	title: string;
	phaseLabel: string;
	status: 'pending' | 'approved' | 'notes';
	statusLabel: string;
	aiMatchPct: number;
	dateLabel: string;
	period: 'week' | 'month' | 'older';
	contractRef: string;
	amountLabel: string;
	files: string[];
	aiNote: string;
	deliveryNote: string;
}

@Component({
	selector: 'app-team-deliveries',
	standalone: true,
	imports: [CommonModule, RouterLink, FormsModule],
	templateUrl: './team-deliveries.html',
	styleUrl: './team-deliveries.css'
})
export class TeamDeliveries {
	activeMember = signal<string>('all');
	activePeriod = signal<'all' | 'week' | 'month'>('all');
	activeStatus = signal<'all' | 'pending' | 'approved' | 'notes'>('all');
	searchQuery = signal<string>('');
	selectedDelivery = signal<TeamDelivery | null>(null);
	toastMessage = signal<string>('');
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	members = [
		{ id: 'fahad', name: 'فهد', initials: 'فه', gradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)' },
		{ id: 'reem', name: 'ريم', initials: 'ري', gradient: 'linear-gradient(135deg,#0FA99A,#0D8A7E)' },
		{ id: 'sara', name: 'سارة', initials: 'سا', gradient: 'linear-gradient(135deg,#FFB400,#D98A0B)' }
	];

	deliveries = signal<TeamDelivery[]>([
		{
			id: 1, memberId: 'fahad', memberName: 'فهد العتيبي', memberSpec: 'React / Node.js', memberInitials: 'فه', memberGradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
			title: 'واجهة المستخدم النهائية', phaseLabel: 'متجر أغذية · المرحلة 4 من 5', status: 'pending', statusLabel: 'بانتظار رد العميل',
			aiMatchPct: 94, dateLabel: 'قبل يومين', period: 'week', contractRef: 'CT-2428', amountLabel: '4,500 ريال',
			files: ['frontend-v3.zip', 'deployment-guide.pdf'], aiNote: 'تطابق 94٪ مع العقد — الملفات كاملة وبدون مشكلات',
			deliveryNote: 'واجهة المستخدم النهائية مع انيميشن المنتجات وصفحة التفاصيل والمفضلة — متجاوب بالكامل مع الموبايل.'
		},
		{
			id: 2, memberId: 'reem', memberName: 'ريم الدوسري', memberSpec: 'Flutter · iOS/Android', memberInitials: 'ري', memberGradient: 'linear-gradient(135deg,#0FA99A,#0D8A7E)',
			title: 'ربط API المطعم', phaseLabel: 'تطبيق مطاعم · المرحلة 4 من 5', status: 'pending', statusLabel: 'بانتظار رد العميل',
			aiMatchPct: 97, dateLabel: 'قبل 3 أيام', period: 'week', contractRef: 'CT-2431', amountLabel: '3,200 ريال',
			files: ['api-integration.zip'], aiNote: 'تطابق 97٪ مع العقد — جميع نقاط الربط تعمل بنجاح',
			deliveryNote: 'ربط كامل لواجهة برمجة تطبيقات المطعم مع تحديث القوائم والطلبات لحظياً.'
		},
		{
			id: 3, memberId: 'sara', memberName: 'سارة الزهراني', memberSpec: 'UI/UX · Figma', memberInitials: 'سا', memberGradient: 'linear-gradient(135deg,#FFB400,#D98A0B)',
			title: 'دليل الهوية المرحلة 2', phaseLabel: 'هوية بصرية · المرحلة 2 من 4', status: 'notes', statusLabel: 'بانتظار مراجعة الإدارة',
			aiMatchPct: 91, dateLabel: 'اليوم', period: 'week', contractRef: 'CT-2440', amountLabel: '1,800 ريال',
			files: ['brand-guide-v2.pdf'], aiNote: 'تطابق 91٪ — يُنصح بمراجعة تناسق الألوان مع الشعار الأساسي',
			deliveryNote: 'دليل الهوية البصرية الكامل مع تطبيقات الشعار على القرطاسية والمواد التسويقية.'
		},
		{
			id: 4, memberId: 'fahad', memberName: 'فهد العتيبي', memberSpec: 'React / Node.js', memberInitials: 'فه', memberGradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
			title: 'سلة التسوق والمدفوعات', phaseLabel: 'متجر أغذية · المرحلة 3 من 5', status: 'approved', statusLabel: 'مكتمل ومُفرَج',
			aiMatchPct: 99, dateLabel: '27 مايو', period: 'month', contractRef: 'CT-2428', amountLabel: '4,500 ريال',
			files: ['cart-payments.zip'], aiNote: 'تطابق 99٪ — تم اعتماد التسليم والإفراج عن الدفعة',
			deliveryNote: 'نظام سلة تسوق كامل مع بوابة دفع متكاملة ودعم كوبونات الخصم.'
		},
		{
			id: 5, memberId: 'reem', memberName: 'ريم الدوسري', memberSpec: 'Flutter · iOS/Android', memberInitials: 'ري', memberGradient: 'linear-gradient(135deg,#0FA99A,#0D8A7E)',
			title: 'شاشات واجهة التطبيق الأساسية', phaseLabel: 'تطبيق مطاعم · المرحلة 3 من 5', status: 'approved', statusLabel: 'مكتمل ومُفرَج',
			aiMatchPct: 96, dateLabel: '23 مايو', period: 'month', contractRef: 'CT-2431', amountLabel: '3,200 ريال',
			files: ['ui-screens.fig'], aiNote: 'تطابق 96٪ — تم اعتماد التسليم والإفراج عن الدفعة',
			deliveryNote: 'الشاشات الأساسية للتطبيق متضمنة الرئيسية والقوائم وسلة الطلب.'
		},
		{
			id: 6, memberId: 'fahad', memberName: 'فهد العتيبي', memberSpec: 'React / Node.js', memberInitials: 'فه', memberGradient: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
			title: 'الواجهة الأمامية v2', phaseLabel: 'متجر أغذية · المرحلة 2 من 5', status: 'approved', statusLabel: 'مكتمل ومُفرَج',
			aiMatchPct: 97, dateLabel: '18 مايو', period: 'older', contractRef: 'CT-2428', amountLabel: '4,500 ريال',
			files: ['frontend-v2.zip'], aiNote: 'تطابق 97٪ — تم اعتماد التسليم والإفراج عن الدفعة',
			deliveryNote: 'تحديث كامل للواجهة الأمامية بتصميم متجاوب جديد.'
		},
		{
			id: 7, memberId: 'sara', memberName: 'سارة الزهراني', memberSpec: 'UI/UX · Figma', memberInitials: 'سا', memberGradient: 'linear-gradient(135deg,#FFB400,#D98A0B)',
			title: 'الشعار والهوية النهائية', phaseLabel: 'هوية بصرية · المرحلة 1 من 4', status: 'approved', statusLabel: 'مكتمل ومُفرَج',
			aiMatchPct: 94, dateLabel: '8 مايو', period: 'older', contractRef: 'CT-2440', amountLabel: '1,800 ريال',
			files: ['logo-final.ai', 'logo-final.svg'], aiNote: 'تطابق 94٪ — تم اعتماد التسليم والإفراج عن الدفعة',
			deliveryNote: 'الشعار النهائي بجميع الصيغ المطلوبة مع دليل استخدام مبسّط.'
		}
	]);

	kpis = computed(() => {
		const list = this.deliveries();
		return {
			thisMonth: list.filter(d => d.period === 'week' || d.period === 'month').length,
			pending: list.filter(d => d.status === 'pending').length,
			approved: list.filter(d => d.status === 'approved').length,
			avgAiMatch: list.length ? Math.round(list.reduce((sum, d) => sum + d.aiMatchPct, 0) / list.length) : 0
		};
	});

	filteredDeliveries = computed(() => {
		let list = this.deliveries();
		if (this.activeMember() !== 'all') list = list.filter(d => d.memberId === this.activeMember());
		if (this.activePeriod() !== 'all') list = list.filter(d => d.period === this.activePeriod());
		if (this.activeStatus() !== 'all') list = list.filter(d => d.status === this.activeStatus());
		const q = this.searchQuery().trim().toLowerCase();
		if (q) list = list.filter(d => d.title.toLowerCase().includes(q) || d.memberName.toLowerCase().includes(q));
		return list;
	});

	setMember(id: string): void { this.activeMember.set(id); }
	setPeriod(period: 'all' | 'week' | 'month'): void { this.activePeriod.set(period); }
	setStatus(status: 'all' | 'pending' | 'approved' | 'notes'): void { this.activeStatus.set(status); }

	openDetail(delivery: TeamDelivery): void {
		this.selectedDelivery.set(delivery);
	}

	closeDetail(): void {
		this.selectedDelivery.set(null);
	}

	sendDirection(): void {
		this.showToast('تم إرسال التوجيه لعضو الفريق');
	}

	messageClient(): void {
		this.showToast('تم فتح محادثة مع العميل');
	}

	private showToast(msg: string): void {
		this.toastMessage.set(msg);
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3000);
	}
}
