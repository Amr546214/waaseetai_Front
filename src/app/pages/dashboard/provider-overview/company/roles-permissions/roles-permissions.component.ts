import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface PermissionItem {
	name: string;
	granted: boolean;
}

interface PermissionCategory {
	label: string;
	iconColor: string;
	iconBg: string;
	items: PermissionItem[];
}

interface RoleInfo {
	id: string;
	name: string;
	desc: string;
	members: number;
	badge: 'sys' | 'custom' | 'ok';
	badgeLabel: string;
	iconColor: string;
	iconBg: string;
	isProtected: boolean;
	categories: PermissionCategory[];
}

@Component({
	selector: 'app-roles-permissions',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './roles-permissions.component.html',
	styleUrls: ['./roles-permissions.component.css']
})
export class RolesPermissionsComponent {
	activeGroup = signal<string>('prov');
	selectedRoleId = signal<string>('prov-standard');

	providerRoles: RoleInfo[] = [
		{
			id: 'prov-standard', name: 'مقدم قياسي', desc: 'الدور الافتراضي لكل مقدم — ينفذ المشاريع المُسندة إليه ويرفع التسليمات.', members: 8, badge: 'sys', badgeLabel: 'ثابت', iconColor: '#2BD4C7', iconBg: 'rgba(43,212,199,.12)', isProtected: true,
			categories: [
				{ label: 'تنفيذ المشاريع', iconColor: '#2BD4C7', iconBg: 'rgba(43,212,199,.12)', items: [
					{ name: 'عرض المشروع المُسند', granted: true },
					{ name: 'الدخول لمساحة العمل', granted: true },
					{ name: 'رفع التسليمات', granted: true },
					{ name: 'طلب تمديد الموعد', granted: true },
					{ name: 'رفع أوامر تغيير', granted: false },
				]},
				{ label: 'التواصل مع العميل', iconColor: '#5DA0FF', iconBg: 'rgba(43,127,255,.12)', items: [
					{ name: 'مراسلة العميل في المشروع', granted: true },
					{ name: 'الرد على ملاحظات التسليم', granted: false },
					{ name: 'التفاوض على التعديلات', granted: false },
				]},
				{ label: 'الملف والإيرادات', iconColor: '#2ECC8A', iconBg: 'rgba(46,204,138,.12)', items: [
					{ name: 'عرض إيراداته الخاصة', granted: true },
					{ name: 'تعديل مهاراته وتخصصاته', granted: true },
					{ name: 'طلب سحب حصته', granted: false },
					{ name: 'عرض تقييماته العامة', granted: false },
				]},
			]
		},
		{
			id: 'prov-senior', name: 'مقدم متقدم', desc: 'مقدم موثوق بصلاحيات إضافية — يتواصل مع العميل مباشرة ويطّلع على تفاصيل التفاوض.', members: 0, badge: 'custom', badgeLabel: 'مخصص', iconColor: '#2ECC8A', iconBg: 'rgba(46,204,138,.12)', isProtected: false,
			categories: [
				{ label: 'تنفيذ المشاريع', iconColor: '#2BD4C7', iconBg: 'rgba(43,212,199,.12)', items: [
					{ name: 'عرض المشروع المُسند', granted: true },
					{ name: 'الدخول لمساحة العمل', granted: true },
					{ name: 'رفع التسليمات', granted: true },
					{ name: 'طلب تمديد الموعد', granted: true },
					{ name: 'رفع أوامر تغيير', granted: true },
				]},
				{ label: 'التواصل مع العميل', iconColor: '#5DA0FF', iconBg: 'rgba(43,127,255,.12)', items: [
					{ name: 'مراسلة العميل في المشروع', granted: true },
					{ name: 'الرد على ملاحظات التسليم', granted: true },
					{ name: 'التفاوض على التعديلات', granted: true },
				]},
			]
		},
	];

	employeeRoles: RoleInfo[] = [
		{
			id: 'emp-owner', name: 'مالك الشركة', desc: 'صلاحيات كاملة على الشركة وكل أقسامها.', members: 1, badge: 'sys', badgeLabel: 'ثابت', iconColor: '#2BD4C7', iconBg: 'rgba(43,212,199,.12)', isProtected: true,
			categories: [
				{ label: 'إدارة الشركة', iconColor: '#2BD4C7', iconBg: 'rgba(43,212,199,.12)', items: [
					{ name: 'إدارة بيانات الشركة', granted: true },
					{ name: 'إدارة الموظفين والمقدمين', granted: true },
					{ name: 'إدارة الأدوار والصلاحيات', granted: true },
					{ name: 'إدارة الإعدادات', granted: true },
				]},
			]
		},
		{
			id: 'emp-pm', name: 'مدير مشاريع', desc: 'يدير المشاريع ويسند المهام ويتابع التسليمات.', members: 2, badge: 'custom', badgeLabel: 'مخصص', iconColor: '#5DA0FF', iconBg: 'rgba(43,127,255,.12)', isProtected: false,
			categories: [
				{ label: 'إدارة المشاريع', iconColor: '#5DA0FF', iconBg: 'rgba(43,127,255,.12)', items: [
					{ name: 'إدارة المشاريع', granted: true },
					{ name: 'تعيين المهام', granted: true },
					{ name: 'مراجعة التقارير', granted: true },
					{ name: 'الموافقة على الطلبات', granted: true },
				]},
			]
		},
		{
			id: 'emp-accountant', name: 'محاسب', desc: 'يدير الفواتير والمدفوعات والتقارير المالية.', members: 1, badge: 'custom', badgeLabel: 'مخصص', iconColor: '#FFB400', iconBg: 'rgba(255,180,0,.12)', isProtected: false,
			categories: [
				{ label: 'المالية', iconColor: '#FFB400', iconBg: 'rgba(255,180,0,.12)', items: [
					{ name: 'إدارة الفواتير', granted: true },
					{ name: 'عرض التقارير المالية', granted: true },
					{ name: 'إدارة المدفوعات', granted: true },
				]},
			]
		},
		{
			id: 'emp-qa', name: 'مراقب جودة', desc: 'يراجع المخرجات ويعتمد الجودة.', members: 1, badge: 'custom', badgeLabel: 'مخصص', iconColor: '#A56BE0', iconBg: 'rgba(165,107,224,.12)', isProtected: false,
			categories: [
				{ label: 'الجودة', iconColor: '#A56BE0', iconBg: 'rgba(165,107,224,.12)', items: [
					{ name: 'مراجعة المخرجات', granted: true },
					{ name: 'اعتماد الجودة', granted: true },
					{ name: 'رفع التقارير', granted: true },
				]},
			]
		},
	];

	currentRoles = computed<RoleInfo[]>(() => {
		return this.activeGroup() === 'prov' ? this.providerRoles : this.employeeRoles;
	});

	selectedRole = computed<RoleInfo | undefined>(() => {
		return this.currentRoles().find(r => r.id === this.selectedRoleId()) || this.currentRoles()[0];
	});

	setGroup(group: string) {
		this.activeGroup.set(group);
		const roles = group === 'prov' ? this.providerRoles : this.employeeRoles;
		this.selectedRoleId.set(roles[0].id);
	}

	selectRole(id: string) {
		this.selectedRoleId.set(id);
	}

	togglePermission(catIndex: number, itemIndex: number) {
		const role = this.selectedRole();
		if (!role || role.isProtected) return;
		role.categories[catIndex].items[itemIndex].granted = !role.categories[catIndex].items[itemIndex].granted;
	}

	countActive(cat: PermissionCategory): string {
		const active = cat.items.filter(i => i.granted).length;
		return `${active} من ${cat.items.length} مفعّل`;
	}
}
