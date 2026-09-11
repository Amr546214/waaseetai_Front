import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ModificationRequest {
	id: string; project: string; type: string; desc: string;
	status: 'pending' | 'approved' | 'rejected' | 'review';
	requestedBy: string; date: string; impact: string;
}

@Component({
	selector: 'app-project-modifications',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './project-modifications.component.html',
	styleUrls: ['./project-modifications.component.css']
})
export class ProjectModificationsComponent {
	activeFilter = 'all';

	filters = [
		{ id: 'all', label: 'الكل', count: 8 },
		{ id: 'pending', label: 'قيد المراجعة', count: 3 },
		{ id: 'approved', label: 'معتمد', count: 4 },
		{ id: 'rejected', label: 'مرفوض', count: 1 }
	];

	requests: ModificationRequest[] = [
		{ id: 'MOD-2026-018', project: 'تطوير تطبيق الجوال', type: 'إضافة مرحلة', desc: 'إضافة مرحلة اختبار أداء إضافية قبل الإطلاق', status: 'pending', requestedBy: 'سارة القحطاني', date: '2026-09-10', impact: 'زيادة المدة 5 أيام' },
		{ id: 'MOD-2026-017', project: 'تصميم هوية بصرية', type: 'تعديل نطاق', desc: 'إضافة 3 تصاميم إضافية للسوشيال ميديا', status: 'approved', requestedBy: 'أحمد العتيبي', date: '2026-09-08', impact: 'زيادة التكلفة 2,500 ريال' },
		{ id: 'MOD-2026-016', project: 'تطوير موقع إلكتروني', type: 'تغيير موعد', desc: 'تأجيل موعد التسليم النهائي 7 أيام', status: 'pending', requestedBy: 'نورة الحربي', date: '2026-09-07', impact: 'تمديد المدة' },
		{ id: 'MOD-2026-015', project: 'كتابة محتوى تسويقي', type: 'إضافة مرحلة', desc: 'إضافة مرحلة مراجعة لغوية إضافية', status: 'approved', requestedBy: 'سارة القحطاني', date: '2026-09-05', impact: 'زيادة المدة يومين' },
		{ id: 'MOD-2026-014', project: 'تصميم واجهة مستخدم', type: 'تعديل نطاق', desc: 'تعديل ألوان الواجهة الرئيسية', status: 'rejected', requestedBy: 'محمد الزهراني', date: '2026-09-03', impact: 'بدون تغيير' },
		{ id: 'MOD-2026-013', project: 'تطوير تطبيق الجوال', type: 'تغيير موعد', desc: 'تقديم موعد المرحلة الأولى', status: 'approved', requestedBy: 'أحمد العتيبي', date: '2026-09-01', impact: 'تقديم 3 أيام' },
		{ id: 'MOD-2026-012', project: 'استشارة تقنية', type: 'إضافة مرحلة', desc: 'إضافة جلسة استشارية متخصصة', status: 'review', requestedBy: 'فاطمة الغامدي', date: '2026-08-28', impact: 'زيادة التكلفة 800 ريال' },
		{ id: 'MOD-2026-011', project: 'تصميم هوية بصرية', type: 'تعديل نطاق', desc: 'إضافة دليل الهوية البصرية', status: 'approved', requestedBy: 'سارة القحطاني', date: '2026-08-25', impact: 'زيادة التكلفة 1,200 ريال' }
	];

	get filteredRequests(): ModificationRequest[] {
		if (this.activeFilter === 'all') return this.requests;
		return this.requests.filter(r => r.status === this.activeFilter);
	}

	setFilter(filter: string) {
		this.activeFilter = filter;
	}

	statusLabel(s: string): string {
		return s === 'pending' ? 'قيد المراجعة' : s === 'approved' ? 'معتمد' : s === 'rejected' ? 'مرفوض' : 'مراجعة فنية';
	}
}
