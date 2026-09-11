import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Employee {
	id: string; name: string; email: string; role: string; roleColor: string;
	status: 'active' | 'suspended'; avatar: string; joinedAt: string; tasksCount: number;
}

interface Role {
	id: string; name: string; count: number; color: string; permissions: string[];
}

interface Group {
	id: string; name: string; lead: string; members: string[]; memberCount: number;
}

interface Task {
	id: string; title: string; desc: string; priority: 'high' | 'med' | 'low';
	status: 'done' | 'progress' | 'pending' | 'review'; assignee: string; due: string;
}

@Component({
	selector: 'app-team-management',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './team-management.component.html',
	styleUrls: ['./team-management.component.css']
})
export class TeamManagementComponent {
	activeTab = 'employees';

	stats = [
		{ ico: 'group', color: 'teal', val: 8, lbl: 'إجمالي الموظفين' },
		{ ico: 'check', color: 'green', val: 6, lbl: 'موظفون نشطون' },
		{ ico: 'task', color: 'amber', val: 14, lbl: 'مهام نشطة' },
		{ ico: 'group', color: 'blue', val: 3, lbl: 'مجموعات عمل' }
	];

	employees: Employee[] = [
		{ id: '1', name: 'أحمد العتيبي', email: 'ahmed@company.sa', role: 'مالك الشركة', roleColor: 'teal', status: 'active', avatar: 'أ', joinedAt: '2025-01-15', tasksCount: 3 },
		{ id: '2', name: 'سارة القحطاني', email: 'sara@company.sa', role: 'مدير المشاريع', roleColor: 'blue', status: 'active', avatar: 'س', joinedAt: '2025-02-10', tasksCount: 5 },
		{ id: '3', name: 'محمد الزهراني', email: 'mohammed@company.sa', role: 'محاسب', roleColor: 'amber', status: 'active', avatar: 'م', joinedAt: '2025-03-01', tasksCount: 2 },
		{ id: '4', name: 'نورة الحربي', email: 'noura@company.sa', role: 'مراقب', roleColor: 'gray', status: 'active', avatar: 'ن', joinedAt: '2025-03-20', tasksCount: 1 },
		{ id: '5', name: 'خالد الدوسري', email: 'khaled@company.sa', role: 'موظف', roleColor: 'gray', status: 'suspended', avatar: 'خ', joinedAt: '2025-04-05', tasksCount: 0 },
		{ id: '6', name: 'فاطمة الغامدي', email: 'fatima@company.sa', role: 'موظف', roleColor: 'gray', status: 'active', avatar: 'ف', joinedAt: '2025-04-15', tasksCount: 3 }
	];

	roles: Role[] = [
		{ id: 'owner', name: 'مالك الشركة', count: 1, color: 'teal', permissions: ['كل الصلاحيات', 'إدارة الموظفين', 'إدارة المالية', 'إعدادات الحساب'] },
		{ id: 'manager', name: 'مدير المشاريع', count: 2, color: 'blue', permissions: ['إنشاء الطلبات', 'متابعة المشاريع', 'توقيع العقود', 'مراجعة التسليم'] },
		{ id: 'accountant', name: 'محاسب', count: 1, color: 'amber', permissions: ['عرض الفواتير', 'عرض المحفظة', 'تقارير الإنفاق'] },
		{ id: 'observer', name: 'مراقب', count: 3, color: 'gray', permissions: ['عرض المشاريع', 'عرض التقارير'] }
	];

	groups: Group[] = [
		{ id: '1', name: 'فريق التطوير', lead: 'سارة القحطاني', members: ['س', 'م', 'ف'], memberCount: 4 },
		{ id: '2', name: 'فريق المالية', lead: 'محمد الزهراني', members: ['م', 'ن'], memberCount: 2 },
		{ id: '3', name: 'فريق المتابعة', lead: 'نورة الحربي', members: ['ن', 'خ'], memberCount: 2 }
	];

	tasks: Task[] = [
		{ id: '1', title: 'مراجعة طلب رقم REQ-2026-042', desc: 'مراجعة تفاصيل الطلب وتأكيد النطاق', priority: 'high', status: 'progress', assignee: 'سارة القحطاني', due: '2026-09-15' },
		{ id: '2', title: 'توقيع عقد رقم C-2026-018', desc: 'مراجعة بنود العقد والتوقيع', priority: 'high', status: 'review', assignee: 'أحمد العتيبي', due: '2026-09-14' },
		{ id: '3', title: 'إعداد تقرير الإنفاق الشهري', desc: 'تجميع بيانات الإنفاق لشهر أغسطس', priority: 'med', status: 'pending', assignee: 'محمد الزهراني', due: '2026-09-20' },
		{ id: '4', title: 'متابعة تسليم المرحلة 2', desc: 'مراجعة تسليم المرحلة الثانية من المشروع', priority: 'med', status: 'progress', assignee: 'نورة الحربي', due: '2026-09-18' },
		{ id: '5', title: 'تحديث بيانات الموردين', desc: 'تحديث قائمة الموردين المعتمدين', priority: 'low', status: 'done', assignee: 'فاطمة الغامدي', due: '2026-09-10' }
	];

	switchTab(tab: string) {
		this.activeTab = tab;
	}

	statusLabel(s: string): string {
		return s === 'active' ? 'نشط' : 'موقوف';
	}

	priorityLabel(p: string): string {
		return p === 'high' ? 'عالية' : p === 'med' ? 'متوسطة' : 'منخفضة';
	}

	statusTag(s: string): string {
		return s === 'done' ? 'مكتمل' : s === 'progress' ? 'قيد التنفيذ' : s === 'pending' ? 'معلق' : 'مراجعة';
	}
}
