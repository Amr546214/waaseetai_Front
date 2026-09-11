import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface RolePermission {
	name: string;
	granted: boolean;
}

interface RoleInfo {
	id: string;
	name: string;
	employeeCount: number;
	color: 'teal' | 'blue' | 'amber' | 'purple' | 'red';
	icon: string;
	permissions: RolePermission[];
}

@Component({
	selector: 'app-roles-permissions',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './roles-permissions.component.html',
	styleUrls: ['./roles-permissions.component.css']
})
export class RolesPermissionsComponent {
	roles: RoleInfo[] = [
		{
			id: 'R1',
			name: 'مالك الشركة',
			employeeCount: 1,
			color: 'teal',
			icon: 'crown',
			permissions: [
				{ name: 'إدارة الشركة', granted: true },
				{ name: 'إدارة الموظفين', granted: true },
				{ name: 'إدارة المشاريع', granted: true },
				{ name: 'إدارة الفواتير', granted: true },
				{ name: 'عرض التقارير المالية', granted: true },
				{ name: 'إدارة الأدوار والصلاحيات', granted: true },
				{ name: 'إدارة الإعدادات', granted: true }
			]
		},
		{
			id: 'R2',
			name: 'مدير المشاريع',
			employeeCount: 3,
			color: 'blue',
			icon: 'briefcase',
			permissions: [
				{ name: 'إدارة المشاريع', granted: true },
				{ name: 'تعيين المهام', granted: true },
				{ name: 'مراجعة التقارير', granted: true },
				{ name: 'الموافقة على الطلبات', granted: true },
				{ name: 'إدارة الفواتير', granted: false },
				{ name: 'إدارة الإعدادات', granted: false }
			]
		},
		{
			id: 'R3',
			name: 'محاسب',
			employeeCount: 2,
			color: 'amber',
			icon: 'calculator',
			permissions: [
				{ name: 'إدارة الفواتير', granted: true },
				{ name: 'عرض التقارير المالية', granted: true },
				{ name: 'إدارة المدفوعات', granted: true },
				{ name: 'إدارة المشاريع', granted: false },
				{ name: 'إدارة الموظفين', granted: false }
			]
		},
		{
			id: 'R4',
			name: 'مراقب',
			employeeCount: 4,
			color: 'purple',
			icon: 'eye',
			permissions: [
				{ name: 'عرض المشاريع', granted: true },
				{ name: 'عرض التقارير', granted: true },
				{ name: 'مراجعة المخرجات', granted: true },
				{ name: 'إدارة المشاريع', granted: false },
				{ name: 'إدارة الفواتير', granted: false }
			]
		},
		{
			id: 'R5',
			name: 'موظف',
			employeeCount: 14,
			color: 'red',
			icon: 'user',
			permissions: [
				{ name: 'عرض المهام', granted: true },
				{ name: 'تحديث حالة المهام', granted: true },
				{ name: 'رفع الملفات', granted: true },
				{ name: 'إدارة المشاريع', granted: false },
				{ name: 'إدارة الفواتير', granted: false },
				{ name: 'إدارة الموظفين', granted: false }
			]
		}
	];
}
