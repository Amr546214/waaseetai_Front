import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Employee {
	id: string;
	name: string;
	role: string;
	status: 'active' | 'inactive';
	avatar: string;
}

interface Role {
	id: string;
	name: string;
	permissions: string[];
}

interface Group {
	id: string;
	name: string;
	members: number;
	description: string;
}

@Component({
	selector: 'app-company-team-management',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './team-management.component.html',
	styleUrls: ['./team-management.component.css']
})
export class CompanyTeamManagementComponent {
	activeTab = 'employees';

	tabs = [
		{ id: 'employees', label: 'الموظفون' },
		{ id: 'roles', label: 'الأدوار' },
		{ id: 'groups', label: 'المجموعات' }
	];

	stats = [
		{ label: 'إجمالي الموظفين', value: 24, color: 'blue' },
		{ label: 'نشطون', value: 19, color: 'teal' },
		{ label: 'أدوار', value: 5, color: 'amber' },
		{ label: 'مجموعات', value: 4, color: 'purple' }
	];

	employees: Employee[] = [
		{ id: 'EMP-001', name: 'أحمد العتيبي', role: 'مدير المشاريع', status: 'active', avatar: 'أ' },
		{ id: 'EMP-002', name: 'سارة القحطاني', role: 'مطورة واجهات', status: 'active', avatar: 'س' },
		{ id: 'EMP-003', name: 'محمد الزهراني', role: 'مطور باك إند', status: 'active', avatar: 'م' },
		{ id: 'EMP-004', name: 'نورة الحربي', role: 'مصممة جرافيك', status: 'inactive', avatar: 'ن' },
		{ id: 'EMP-005', name: 'خالد الشمري', role: 'محاسب', status: 'active', avatar: 'خ' },
		{ id: 'EMP-006', name: 'فاطمة القحطاني', role: 'مراقب جودة', status: 'active', avatar: 'ف' }
	];

	roles: Role[] = [
		{ id: 'R1', name: 'مدير المشاريع', permissions: ['إدارة المشاريع', 'تعيين المهام', 'مراجعة التقارير', 'الموافقة على الطلبات'] },
		{ id: 'R2', name: 'مطور', permissions: ['عرض المهام', 'تحديث الحالة', 'رفع الملفات'] },
		{ id: 'R3', name: 'محاسب', permissions: ['إدارة الفواتير', 'عرض التقارير المالية', 'إدارة المدفوعات'] },
		{ id: 'R4', name: 'مراقب جودة', permissions: ['مراجعة المخرجات', 'اعتماد الجودة', 'رفع التقارير'] }
	];

	groups: Group[] = [
		{ id: 'G1', name: 'فريق التطوير', members: 8, description: 'مطورو الواجهات والباك إند' },
		{ id: 'G2', name: 'فريق التصميم', members: 4, description: 'مصممو الواجهات والجرافيك' },
		{ id: 'G3', name: 'فريق الإدارة', members: 5, description: 'مديرو المشاريع والمحاسبون' },
		{ id: 'G4', name: 'فريق الجودة', members: 3, description: 'مراقبو الجودة والاختبار' }
	];

	setTab(tab: string): void {
		this.activeTab = tab;
	}

	statusLabel(status: string): string {
		return status === 'active' ? 'نشط' : 'غير نشط';
	}

	editEmployee(emp: Employee): void {
		console.log('Edit:', emp.id);
	}

	editRole(role: Role): void {
		console.log('Edit role:', role.id);
	}

	editGroup(group: Group): void {
		console.log('Edit group:', group.id);
	}
}
