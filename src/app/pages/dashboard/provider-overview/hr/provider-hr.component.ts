import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';

/* ============================== Models ============================== */

type AccountStatus = 'active' | 'suspended' | 'inactive';
type InviteStatus = 'accepted' | 'pending';
type CompletionStatus = 'complete' | 'partial' | 'none';

interface AdminEmployee {
	id: string;
	name: string;
	email: string;
	avatarInitials: string;
	avatarColor: string;
	distinguished: boolean;
	jobTitle: string;
	taskIds: string[];
	lastLogin: string;
	accountStatus: AccountStatus;
	completion: CompletionStatus;
	completionPct: number;
	inviteStatus: InviteStatus;
}

interface DocItem {
	name: string;
	accepted: boolean;
	date?: string;
}

interface AffiliatedProvider {
	id: string;
	name: string;
	email: string;
	avatarInitials: string;
	avatarColor: string;
	level: 'خبير' | 'متقن' | 'رصين' | 'محترف';
	levelColor: string;
	skillIds: string[];
	rating: number;
	activeProjects: number;
	lastDelivery: string;
	docsTotal: number;
	docsAccepted: number;
	accountStatus: AccountStatus;
	inviteStatus: InviteStatus;
	docs: DocItem[];
}

interface Specialty {
	id: string;
	name: string;
	type: 'main' | 'sub';
	parentId: string | null;
	assignedProviderIds: string[];
	missingDocsCount: number;
	active: boolean;
}

interface PermissionOption {
	id: string;
	label: string;
	category: string;
}

interface TaskTemplate {
	id: string;
	name: string;
	groupId: string | null;
	description: string;
	permissionIds: string[];
	assignedEmployeeIds: string[];
	active: boolean;
	expanded: boolean;
}

interface TaskGroup {
	id: string;
	name: string;
	description: string;
	taskIds: string[];
}

interface Assignment {
	id: string;
	memberId: string;
	memberName: string;
	memberInitials: string;
	memberColor: string;
	type: 'admin' | 'provider';
	label: string;
	startDate: string;
	active: boolean;
}

type ActivityType = 'add' | 'edit' | 'doc' | 'warn' | 'ai' | 'login';

interface ActivityEntry {
	id: string;
	type: ActivityType;
	who: string;
	desc: string;
	meta: { text: string; tone?: 'amber' | 'purple' | 'muted' }[];
}

type ModalId =
	| 'invite-admin'
	| 'invite-provider'
	| 'edit-employee'
	| 'edit-provider'
	| 'docs-review'
	| null;

type MainTab = 'emp' | 'prov' | 'specs' | 'tasks' | 'assign' | 'log';
type TasksSubTab = 'tasks' | 'groups';
type ActivityFilter = 'all' | 'add' | 'edit' | 'doc' | 'warn' | 'ai';

let idCounter = 100;
function nextId(prefix: string): string {
	idCounter += 1;
	return `${prefix}-${idCounter}`;
}

@Component({
	selector: 'app-provider-hr',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './provider-hr.component.html',
	styleUrls: ['./provider-hr.component.css']
})
export class ProviderHrComponent {
	private confirmModal = inject(ConfirmModalService);

	/* ---------------- tabs ---------------- */
	activeTab = signal<MainTab>('emp');
	tasksSubTab = signal<TasksSubTab>('tasks');

	tabs: { id: MainTab; label: string }[] = [
		{ id: 'emp', label: 'الموظفون الإداريون' },
		{ id: 'prov', label: 'مقدمو الخدمات التابعون' },
		{ id: 'specs', label: 'تخصصات الشركة' },
		{ id: 'tasks', label: 'المهام والصلاحيات' },
		{ id: 'assign', label: 'الإسناد' },
		{ id: 'log', label: 'السجل والرقابة' }
	];

	setTab(tab: MainTab) { this.activeTab.set(tab); }
	setTasksSubTab(sub: TasksSubTab) { this.tasksSubTab.set(sub); }

	/* ---------------- toast ---------------- */
	toastMessage = signal<string>('');
	private toastTimer: ReturnType<typeof setTimeout> | null = null;
	toast(msg: string) {
		this.toastMessage.set(msg);
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3500);
	}

	/* ---------------- permission catalogue ---------------- */
	permissionCategories: { label: string; icon: 'list' | 'briefcase' | 'hr' | 'wallet' | 'settings'; ids: string[] }[] = [
		{ label: 'الطلبات والعروض', icon: 'list', ids: ['p-view-requests', 'p-submit-offers', 'p-edit-offers', 'p-withdraw-offers'] },
		{ label: 'المشاريع والتسليم', icon: 'briefcase', ids: ['p-view-projects', 'p-upload-deliverables', 'p-contact-clients', 'p-progress-reports', 'p-manage-stages'] },
		{ label: 'إدارة الموارد البشرية', icon: 'hr', ids: ['p-manage-admins', 'p-invite-employees', 'p-edit-employee-perms', 'p-manage-providers', 'p-assign-specialties', 'p-review-docs'] },
		{ label: 'المالية', icon: 'wallet', ids: ['p-view-earnings', 'p-request-withdrawal', 'p-view-invoices'] },
		{ label: 'إدارة الشركة', icon: 'settings', ids: ['p-edit-company-settings', 'p-view-full-reports', 'p-manage-specialties'] }
	];

	permissions: PermissionOption[] = [
		{ id: 'p-view-requests', label: 'عرض طلبات الخدمة المتاحة', category: 'الطلبات والعروض' },
		{ id: 'p-submit-offers', label: 'تقديم عروض للطلبات', category: 'الطلبات والعروض' },
		{ id: 'p-edit-offers', label: 'تعديل العروض المقدمة', category: 'الطلبات والعروض' },
		{ id: 'p-withdraw-offers', label: 'سحب العروض', category: 'الطلبات والعروض' },
		{ id: 'p-view-projects', label: 'عرض المشاريع المسندة', category: 'المشاريع والتسليم' },
		{ id: 'p-upload-deliverables', label: 'رفع التسليمات', category: 'المشاريع والتسليم' },
		{ id: 'p-contact-clients', label: 'التواصل مع العملاء', category: 'المشاريع والتسليم' },
		{ id: 'p-progress-reports', label: 'تقديم تقارير التقدم', category: 'المشاريع والتسليم' },
		{ id: 'p-manage-stages', label: 'إدارة مراحل المشروع', category: 'المشاريع والتسليم' },
		{ id: 'p-manage-admins', label: 'إدارة الموظفين الإداريين', category: 'إدارة الموارد البشرية' },
		{ id: 'p-invite-employees', label: 'دعوة موظفين جدد', category: 'إدارة الموارد البشرية' },
		{ id: 'p-edit-employee-perms', label: 'تعديل صلاحيات الموظفين', category: 'إدارة الموارد البشرية' },
		{ id: 'p-manage-providers', label: 'إدارة مقدمي الخدمات التابعين', category: 'إدارة الموارد البشرية' },
		{ id: 'p-assign-specialties', label: 'إسناد التخصصات للمقدمين', category: 'إدارة الموارد البشرية' },
		{ id: 'p-review-docs', label: 'مراجعة مستندات المقدمين', category: 'إدارة الموارد البشرية' },
		{ id: 'p-view-earnings', label: 'عرض الأرباح والمدفوعات', category: 'المالية' },
		{ id: 'p-request-withdrawal', label: 'طلب سحب أرباح الشركة', category: 'المالية' },
		{ id: 'p-view-invoices', label: 'عرض الفواتير', category: 'المالية' },
		{ id: 'p-edit-company-settings', label: 'تعديل إعدادات الشركة', category: 'إدارة الشركة' },
		{ id: 'p-view-full-reports', label: 'عرض التقارير الكاملة', category: 'إدارة الشركة' },
		{ id: 'p-manage-specialties', label: 'إدارة التخصصات والمهارات', category: 'إدارة الشركة' }
	];

	permLabel(id: string): string { return this.permissions.find(p => p.id === id)?.label ?? id; }

	// No employee / affiliated-provider / assignment / activity endpoint (or model) exists — these lists start empty
	// instead of being seeded with invented people (previously a hard-coded roster) and events.
	/* ---------------- admin employees ---------------- */
	employees = signal<AdminEmployee[]>([]);

	empSearch = signal('');
	empStatusFilter = signal('');
	empTaskFilter = signal('');

	filteredEmployees = computed(() => {
		const q = this.empSearch().trim().toLowerCase();
		const status = this.empStatusFilter();
		const taskFilter = this.empTaskFilter();
		return this.employees().filter(e => {
			if (q && !e.name.toLowerCase().includes(q) && !e.email.toLowerCase().includes(q)) return false;
			if (status && this.empStatusLabel(e) !== status) return false;
			if (taskFilter && !e.taskIds.some(id => this.taskName(id) === taskFilter)) return false;
			return true;
		});
	});

	empStatusLabel(e: AdminEmployee): string {
		if (e.inviteStatus === 'pending') return 'دعوة معلقة';
		if (e.accountStatus === 'suspended') return 'موقوف';
		if (e.accountStatus === 'active') return 'نشط';
		return 'غير نشط';
	}

	completionLabel(e: AdminEmployee): string {
		if (e.completion === 'complete') return 'مكتمل';
		if (e.completion === 'partial') return `جزئي ${e.completionPct}%`;
		return 'لم تبدأ';
	}

	adminEmployeesActiveCount = computed(() => this.employees().filter(e => e.accountStatus === 'active' && e.inviteStatus === 'accepted').length);
	adminEmployeesPendingCount = computed(() => this.employees().filter(e => e.inviteStatus === 'pending').length);

	/* ---------------- affiliated providers ---------------- */
	private docNames = ['هوية وطنية / إقامة', 'عينة أعمال (Portfolio)', 'شهادة إثبات التخصص'];
	private buildDocs(accepted: number, total: number): DocItem[] {
		return this.docNames.slice(0, total).map((name, i) => ({
			name,
			accepted: i < accepted,
			date: i < accepted ? '2026-03-0' + (i + 5) : undefined
		}));
	}

	providers = signal<AffiliatedProvider[]>([]);

	pendingProviderInvites = signal(2);

	provSearch = signal('');
	provStatusFilter = signal('');
	provSpecFilter = signal('');

	filteredProviders = computed(() => {
		const q = this.provSearch().trim().toLowerCase();
		const status = this.provStatusFilter();
		const spec = this.provSpecFilter();
		return this.providers().filter(p => {
			if (q && !p.name.toLowerCase().includes(q) && !p.skillIds.some(id => this.skillName(id).toLowerCase().includes(q))) return false;
			if (status && this.provStatusLabel(p) !== status) return false;
			if (spec && !p.skillIds.some(id => this.specialtyOf(id) === spec)) return false;
			return true;
		});
	});

	provStatusLabel(p: AffiliatedProvider): string {
		if (p.accountStatus === 'suspended') return 'موقوف';
		if (p.accountStatus === 'active') return 'نشط';
		return 'دعوة معلقة';
	}

	docsFillClass(p: AffiliatedProvider): string {
		const pct = p.docsTotal === 0 ? 0 : (p.docsAccepted / p.docsTotal) * 100;
		if (pct >= 100) return 'full';
		if (pct >= 50) return 'partial';
		return 'low';
	}
	docsPct(p: AffiliatedProvider): number { return p.docsTotal === 0 ? 0 : Math.round((p.docsAccepted / p.docsTotal) * 100); }

	providersActiveCount = computed(() => this.providers().filter(p => p.accountStatus === 'active').length);
	providersPendingCount = computed(() => this.pendingProviderInvites());

	missingDocsTotalCount = computed(() => this.providers().reduce((sum, p) => sum + (p.docsTotal - p.docsAccepted), 0));

	/* ---------------- specialties ---------------- */
	skills = signal<Specialty[]>([
		{ id: 's-dev', name: 'تطوير البرمجيات', type: 'main', parentId: null, assignedProviderIds: ['p1', 'p3'], missingDocsCount: 0, active: true },
		{ id: 's-fe-react', name: 'Frontend: React.js', type: 'sub', parentId: 's-dev', assignedProviderIds: ['p1'], missingDocsCount: 0, active: true },
		{ id: 's-be-node', name: 'Backend: Node.js', type: 'sub', parentId: 's-dev', assignedProviderIds: ['p3'], missingDocsCount: 0, active: true },
		{ id: 's-db', name: 'قواعد بيانات', type: 'sub', parentId: 's-dev', assignedProviderIds: ['p3'], missingDocsCount: 0, active: true },
		{ id: 's-uiux', name: 'تصميم UI/UX', type: 'main', parentId: null, assignedProviderIds: ['p1'], missingDocsCount: 1, active: true },
		{ id: 's-brand', name: 'هوية بصرية وتصميم شعارات', type: 'sub', parentId: 's-uiux', assignedProviderIds: ['p2'], missingDocsCount: 1, active: true },
		{ id: 's-graphic', name: 'تصميم جرافيك', type: 'sub', parentId: 's-uiux', assignedProviderIds: ['p2'], missingDocsCount: 0, active: true },
		{ id: 's-content', name: 'كتابة المحتوى', type: 'main', parentId: null, assignedProviderIds: ['p4'], missingDocsCount: 2, active: true },
		{ id: 's-translate', name: 'ترجمة', type: 'sub', parentId: 's-content', assignedProviderIds: ['p4'], missingDocsCount: 0, active: true }
	]);

	skillName(id: string): string { return this.skills().find(s => s.id === id)?.name ?? id; }
	specialtyOf(skillId: string): string {
		const skill = this.skills().find(s => s.id === skillId);
		if (!skill) return '';
		if (skill.type === 'main') return skill.name;
		return this.skills().find(s => s.id === skill.parentId)?.name ?? '';
	}
	mainSpecialties = computed(() => this.skills().filter(s => s.type === 'main'));
	subSpecialtiesOf(mainId: string) { return this.skills().filter(s => s.type === 'sub' && s.parentId === mainId); }
	/** flat rows: main followed immediately by its subs, for the hierarchical table */
	specialtyRows = computed(() => {
		const rows: Specialty[] = [];
		for (const main of this.mainSpecialties()) {
			rows.push(main);
			rows.push(...this.subSpecialtiesOf(main.id));
		}
		return rows;
	});

	createSpecOpen = signal(false);
	specName = signal('');
	specType = signal<'main' | 'sub'>('main');
	specParentId = signal('');
	specDesc = signal('');

	toggleCreateSpec() { this.createSpecOpen.update(v => !v); }

	saveSpec() {
		const name = this.specName().trim();
		if (!name) { this.toast('يرجى إدخال اسم التخصص'); return; }
		if (this.specType() === 'sub' && !this.specParentId()) { this.toast('يرجى اختيار التخصص الرئيسي الأب'); return; }
		const spec: Specialty = {
			id: nextId('s'),
			name,
			type: this.specType(),
			parentId: this.specType() === 'sub' ? this.specParentId() : null,
			assignedProviderIds: [],
			missingDocsCount: 0,
			active: true
		};
		this.skills.update(list => [...list, spec]);
		this.toast(`تم إنشاء التخصص "${name}" بنجاح`);
		this.specName.set(''); this.specDesc.set(''); this.specParentId.set(''); this.specType.set('main');
		this.createSpecOpen.set(false);
		this.pushActivity('add', 'المدير - شركة التقنية', `تم إنشاء تخصص جديد: ${name}`);
	}

	async deleteSpecialty(spec: Specialty) {
		const ok = await this.confirmModal.confirm({ title: 'حذف تخصص', message: `هل أنت متأكد من حذف "${spec.name}"؟ سيتم أيضاً حذف كل التخصصات الفرعية التابعة له.`, type: 'danger' });
		if (!ok) return;
		this.skills.update(list => list.filter(s => s.id !== spec.id && s.parentId !== spec.id));
		this.toast(`تم حذف التخصص "${spec.name}"`);
	}

	editSpecialty(spec: Specialty) { this.toast(`تعديل التخصص "${spec.name}" (عرض فقط في هذه النسخة)`); }

	assignSpecProviderId = signal('');
	assignSpecSkillId = signal('');

	assignSpecialtyToProvider() {
		const providerId = this.assignSpecProviderId();
		const skillId = this.assignSpecSkillId();
		if (!providerId || !skillId) { this.toast('يرجى اختيار مقدم الخدمة والتخصص'); return; }
		this.providers.update(list => list.map(p => p.id === providerId && !p.skillIds.includes(skillId) ? { ...p, skillIds: [...p.skillIds, skillId] } : p));
		this.skills.update(list => list.map(s => s.id === skillId && !s.assignedProviderIds.includes(providerId) ? { ...s, assignedProviderIds: [...s.assignedProviderIds, providerId] } : s));
		const provider = this.providers().find(p => p.id === providerId);
		const skill = this.skills().find(s => s.id === skillId);
		this.toast('تم إسناد التخصص للمقدم بنجاح');
		if (provider && skill) this.pushActivity('add', 'المدير - شركة التقنية', `تم إسناد تخصص ${skill.name} للمقدم ${provider.name}`);
		this.assignSpecProviderId.set(''); this.assignSpecSkillId.set('');
	}

	/* ---------------- tasks & permission groups ---------------- */
	taskGroups = signal<TaskGroup[]>([
		{ id: 'g1', name: 'مجموعة العمليات', description: 'متابعة العقود والتسليمات', taskIds: ['t1', 't2', 't-extra'] },
		{ id: 'g2', name: 'مجموعة الشؤون المالية', description: 'الفواتير والمدفوعات', taskIds: ['t3'] }
	]);

	tasks = signal<TaskTemplate[]>([
		{ id: 't1', name: 'إدارة عقود مقدمي الخدمات', groupId: 'g1', description: 'إنشاء ومتابعة عقود المشاريع', permissionIds: ['p-view-projects', 'p-upload-deliverables', 'p-contact-clients', 'p-progress-reports', 'p-manage-stages', 'p-view-invoices'], assignedEmployeeIds: ['e1'], active: true, expanded: false },
		{ id: 't2', name: 'متابعة أداء مقدمي الخدمات', groupId: 'g1', description: 'تقييم الأداء ومتابعة التسليمات', permissionIds: ['p-review-docs', 'p-assign-specialties', 'p-view-full-reports', 'p-manage-providers'], assignedEmployeeIds: ['e1'], active: true, expanded: false },
		{ id: 't3', name: 'الشؤون المالية والسحب', groupId: 'g2', description: 'متابعة المحفظة وطلبات السحب', permissionIds: ['p-view-earnings', 'p-request-withdrawal', 'p-view-invoices'], assignedEmployeeIds: ['e2'], active: true, expanded: false }
	]);

	taskName(id: string): string { return this.tasks().find(t => t.id === id)?.name ?? ''; }
	groupName(id: string | null): string { return this.taskGroups().find(g => g.id === id)?.name ?? ''; }
	taskAssignedCountLabel(t: TaskTemplate): string { return `${t.assignedEmployeeIds.length} موظف${t.assignedEmployeeIds.length === 1 ? '' : 'ين'}`; }
	groupEmployeeCount(g: TaskGroup): number {
		const empIds = new Set<string>();
		for (const taskId of g.taskIds) {
			const task = this.tasks().find(t => t.id === taskId);
			task?.assignedEmployeeIds.forEach(id => empIds.add(id));
		}
		return empIds.size;
	}

	toggleTaskExpand(id: string) { this.tasks.update(list => list.map(t => t.id === id ? { ...t, expanded: !t.expanded } : t)); }

	createTaskOpen = signal(false);
	taskFormName = signal('');
	taskFormGroupId = signal('');
	taskFormDesc = signal('');
	taskFormPermIds = signal<Set<string>>(new Set());

	toggleCreateTask() { this.createTaskOpen.update(v => !v); }

	toggleTaskFormPerm(id: string) {
		this.taskFormPermIds.update(set => {
			const next = new Set(set);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	}

	saveTask() {
		const name = this.taskFormName().trim();
		if (!name) { this.toast('يرجى إدخال اسم المهمة'); return; }
		if (this.taskFormPermIds().size === 0) { this.toast('يرجى تحديد صلاحية واحدة على الأقل'); return; }
		const task: TaskTemplate = {
			id: nextId('t'),
			name,
			groupId: this.taskFormGroupId() || null,
			description: this.taskFormDesc().trim(),
			permissionIds: Array.from(this.taskFormPermIds()),
			assignedEmployeeIds: [],
			active: true,
			expanded: false
		};
		this.tasks.update(list => [...list, task]);
		if (task.groupId) this.taskGroups.update(list => list.map(g => g.id === task.groupId ? { ...g, taskIds: [...g.taskIds, task.id] } : g));
		this.toast(`تم إنشاء المهمة "${name}" بنجاح بـ ${task.permissionIds.length} صلاحيات`);
		this.taskFormName.set(''); this.taskFormGroupId.set(''); this.taskFormDesc.set(''); this.taskFormPermIds.set(new Set());
		this.createTaskOpen.set(false);
	}

	toggleTaskHidden(t: TaskTemplate) {
		this.tasks.update(list => list.map(x => x.id === t.id ? { ...x, active: !x.active } : x));
		this.toast(t.active ? `تم إخفاء المهمة "${t.name}"` : `تم تفعيل المهمة "${t.name}"`);
	}

	async deleteTask(t: TaskTemplate) {
		const ok = await this.confirmModal.confirm({ title: 'حذف مهمة وظيفية', message: `هل أنت متأكد من حذف المهمة "${t.name}"؟`, type: 'danger' });
		if (!ok) return;
		this.tasks.update(list => list.filter(x => x.id !== t.id));
		this.taskGroups.update(list => list.map(g => ({ ...g, taskIds: g.taskIds.filter(id => id !== t.id) })));
		this.toast(`تم حذف المهمة "${t.name}"`);
	}

	createGroupOpen = signal(false);
	groupFormName = signal('');
	groupFormDesc = signal('');
	groupFormTaskIds = signal<Set<string>>(new Set());

	toggleCreateGroup() { this.createGroupOpen.update(v => !v); }
	toggleGroupFormTask(id: string) {
		this.groupFormTaskIds.update(set => {
			const next = new Set(set);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	}

	saveGroup() {
		const name = this.groupFormName().trim();
		if (!name) { this.toast('يرجى إدخال اسم المجموعة'); return; }
		const group: TaskGroup = { id: nextId('g'), name, description: this.groupFormDesc().trim(), taskIds: Array.from(this.groupFormTaskIds()) };
		this.taskGroups.update(list => [...list, group]);
		this.toast('تم حفظ المجموعة');
		this.groupFormName.set(''); this.groupFormDesc.set(''); this.groupFormTaskIds.set(new Set());
		this.createGroupOpen.set(false);
	}

	async deleteGroup(g: TaskGroup) {
		const ok = await this.confirmModal.confirm({ title: 'حذف مجموعة', message: `هل أنت متأكد من حذف "${g.name}"؟`, type: 'danger' });
		if (!ok) return;
		this.taskGroups.update(list => list.filter(x => x.id !== g.id));
		this.toast(`تم حذف المجموعة "${g.name}"`);
	}

	toggleGroupHidden(g: TaskGroup) { this.toast(`تم إخفاء المجموعة "${g.name}"`); }
	editGroup(g: TaskGroup) { this.toast(`تعديل المجموعة "${g.name}" (عرض فقط في هذه النسخة)`); }

	/* ---------------- assignment tab ---------------- */
	assignments = signal<Assignment[]>([]);

	assignTaskEmployeeId = signal('');
	assignTaskTaskId = signal('');
	assignTaskGroupId = signal('');
	assignTaskDate = signal('');

	applyTaskAssignment() {
		const empId = this.assignTaskEmployeeId();
		const taskId = this.assignTaskTaskId();
		if (!empId || !taskId) { this.toast('يرجى اختيار الموظف والمهمة'); return; }
		const emp = this.employees().find(e => e.id === empId);
		const task = this.tasks().find(t => t.id === taskId);
		if (!emp || !task) return;
		this.employees.update(list => list.map(e => e.id === empId && !e.taskIds.includes(taskId) ? { ...e, taskIds: [...e.taskIds, taskId] } : e));
		this.tasks.update(list => list.map(t => t.id === taskId && !t.assignedEmployeeIds.includes(empId) ? { ...t, assignedEmployeeIds: [...t.assignedEmployeeIds, empId] } : t));
		this.assignments.update(list => [...list, { id: nextId('a'), memberId: empId, memberName: emp.name, memberInitials: emp.avatarInitials, memberColor: emp.avatarColor, type: 'admin', label: task.name, startDate: this.assignTaskDate() || 'اليوم', active: true }]);
		this.toast('تم إسناد المهمة');
		this.pushActivity('add', 'المدير - شركة التقنية', `تم إسناد مهمة "${task.name}" للموظف ${emp.name}`);
		this.assignTaskEmployeeId.set(''); this.assignTaskTaskId.set(''); this.assignTaskGroupId.set(''); this.assignTaskDate.set('');
	}

	assignSpecProviderId2 = signal('');
	assignSpecMainId2 = signal('');
	assignSpecSubId2 = signal('');

	applySpecialtyAssignment() {
		const providerId = this.assignSpecProviderId2();
		const skillId = this.assignSpecSubId2() || this.assignSpecMainId2();
		if (!providerId || !skillId) { this.toast('يرجى اختيار مقدم الخدمة والتخصص'); return; }
		const provider = this.providers().find(p => p.id === providerId);
		const skill = this.skills().find(s => s.id === skillId);
		if (!provider || !skill) return;
		this.providers.update(list => list.map(p => p.id === providerId && !p.skillIds.includes(skillId) ? { ...p, skillIds: [...p.skillIds, skillId] } : p));
		this.skills.update(list => list.map(s => s.id === skillId && !s.assignedProviderIds.includes(providerId) ? { ...s, assignedProviderIds: [...s.assignedProviderIds, providerId] } : s));
		this.assignments.update(list => [...list, { id: nextId('a'), memberId: providerId, memberName: provider.name, memberInitials: provider.avatarInitials, memberColor: provider.avatarColor, type: 'provider', label: skill.name, startDate: 'اليوم', active: true }]);
		this.toast('تم إسناد التخصص');
		this.pushActivity('add', 'المدير - شركة التقنية', `تم إسناد تخصص ${skill.name} للمقدم ${provider.name}`);
		this.assignSpecProviderId2.set(''); this.assignSpecMainId2.set(''); this.assignSpecSubId2.set('');
	}

	pauseAssignment(a: Assignment) {
		this.assignments.update(list => list.map(x => x.id === a.id ? { ...x, active: !x.active } : x));
		this.toast(a.active ? `تم إيقاف الإسناد لـ${a.memberName}` : `تم تفعيل الإسناد لـ${a.memberName}`);
	}
	editAssignment(a: Assignment) { this.toast(`تعديل إسناد ${a.memberName} (عرض فقط في هذه النسخة)`); }
	async deleteAssignment(a: Assignment) {
		const ok = await this.confirmModal.confirm({ title: 'حذف إسناد', message: `هل أنت متأكد من حذف إسناد "${a.label}" عن ${a.memberName}؟`, type: 'danger' });
		if (!ok) return;
		this.assignments.update(list => list.filter(x => x.id !== a.id));
		this.toast('تم حذف الإسناد');
	}

	/* ---------------- activity log ---------------- */
	activity = signal<ActivityEntry[]>([]);

	activityFilter = signal<ActivityFilter>('all');
	setActivityFilter(f: ActivityFilter) { this.activityFilter.set(f); }
	filteredActivity = computed(() => {
		const f = this.activityFilter();
		return f === 'all' ? this.activity() : this.activity().filter(a => a.type === f);
	});

	private pushActivity(type: ActivityType, who: string, desc: string) {
		this.activity.update(list => [{ id: nextId('ac'), type, who, desc, meta: [{ text: 'الآن' }] }, ...list]);
	}

	exportLog() { this.toast('جاري تصدير السجل'); }

	/* ---------------- modals ---------------- */
	activeModal = signal<ModalId>(null);
	openModal(id: ModalId) { this.activeModal.set(id); }
	closeModal() { this.activeModal.set(null); }

	/* invite admin */
	inviteAdminContact = signal('');
	inviteAdminJob = signal('');
	inviteAdminTaskIds = signal<Set<string>>(new Set());
	toggleInviteAdminTask(id: string) {
		this.inviteAdminTaskIds.update(set => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
	}
	openInviteAdmin() {
		this.inviteAdminContact.set(''); this.inviteAdminJob.set(''); this.inviteAdminTaskIds.set(new Set());
		this.openModal('invite-admin');
	}
	sendAdminInvite() {
		const contact = this.inviteAdminContact().trim();
		const job = this.inviteAdminJob().trim();
		if (!contact || !job) { this.toast('يرجى تعبئة بيانات التواصل والمسمى الوظيفي'); return; }
		if (this.inviteAdminTaskIds().size === 0) { this.toast('يرجى إسناد مهمة وظيفية واحدة على الأقل'); return; }
		const emp: AdminEmployee = {
			id: nextId('e'),
			name: contact.includes('@') ? contact.split('@')[0] : contact,
			email: contact.includes('@') ? contact : `${contact}@company.com`,
			avatarInitials: 'جد',
			avatarColor: 'rgba(107,118,153,.20)',
			distinguished: false,
			jobTitle: job,
			taskIds: Array.from(this.inviteAdminTaskIds()),
			lastLogin: 'لم تسجل دخول',
			accountStatus: 'inactive',
			completion: 'none',
			completionPct: 0,
			inviteStatus: 'pending'
		};
		this.employees.update(list => [...list, emp]);
		this.closeModal();
		this.toast('تم إرسال دعوة الموظف الإداري');
		this.pushActivity('add', 'المدير - شركة التقنية', `تم إرسال دعوة موظف إداري جديد: ${job}`);
	}

	resendInvite(e: AdminEmployee) { this.toast(`تم إعادة إرسال الدعوة إلى ${e.name}`); }
	async cancelInvite(e: AdminEmployee) {
		const ok = await this.confirmModal.confirm({ title: 'إلغاء دعوة', message: `هل أنت متأكد من إلغاء دعوة ${e.name}؟`, type: 'warning' });
		if (!ok) return;
		this.employees.update(list => list.filter(x => x.id !== e.id));
		this.toast(`تم إلغاء دعوة ${e.name}`);
	}

	/* invite provider */
	inviteProvContact = signal('');
	inviteProvSpecId = signal('');
	inviteProvPermIds = signal<Set<string>>(new Set(['p-view-projects', 'p-upload-deliverables', 'p-contact-clients']));
	toggleInviteProvPerm(id: string) {
		this.inviteProvPermIds.update(set => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
	}
	openInviteProvider() {
		this.inviteProvContact.set(''); this.inviteProvSpecId.set('');
		this.inviteProvPermIds.set(new Set(['p-view-projects', 'p-upload-deliverables', 'p-contact-clients']));
		this.openModal('invite-provider');
	}
	sendProviderInvite() {
		const contact = this.inviteProvContact().trim();
		if (!contact || !this.inviteProvSpecId()) { this.toast('يرجى تعبئة بيانات التواصل واختيار التخصص'); return; }
		this.pendingProviderInvites.update(v => v + 1);
		this.closeModal();
		this.toast('تم إرسال دعوة مقدم الخدمة التابع');
		this.pushActivity('add', 'المدير - شركة التقنية', `تم إرسال دعوة مقدم خدمة تابع بتخصص ${this.skillName(this.inviteProvSpecId())}`);
	}

	/* edit employee */
	editingEmployee = signal<AdminEmployee | null>(null);
	editEmpName = signal('');
	editEmpJob = signal('');
	editEmpEmail = signal('');
	editEmpTaskIds = signal<Set<string>>(new Set());

	openEditEmployee(e: AdminEmployee) {
		this.editingEmployee.set(e);
		this.editEmpName.set(e.name);
		this.editEmpJob.set(e.jobTitle);
		this.editEmpEmail.set(e.email);
		this.editEmpTaskIds.set(new Set(e.taskIds));
		this.openModal('edit-employee');
	}
	toggleEditEmpTask(id: string) {
		this.editEmpTaskIds.update(set => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
	}
	saveEditEmployee() {
		const target = this.editingEmployee();
		if (!target) return;
		const name = this.editEmpName().trim() || target.name;
		this.employees.update(list => list.map(e => e.id === target.id ? { ...e, name, jobTitle: this.editEmpJob().trim(), email: this.editEmpEmail().trim(), taskIds: Array.from(this.editEmpTaskIds()) } : e));
		this.closeModal();
		this.toast('تم حفظ تعديلات الموظف');
		this.pushActivity('edit', 'المدير - شركة التقنية', `تم تعديل بيانات وصلاحيات الموظف ${name}`);
	}

	/* edit provider skills */
	editingProvider = signal<AffiliatedProvider | null>(null);
	editProvSkillIds = signal<Set<string>>(new Set());
	editProvPermIds = signal<Set<string>>(new Set());
	providerPermissionOptions: { id: string; label: string }[] = [
		{ id: 'pp-exec', label: 'تنفيذ المشاريع المسندة' },
		{ id: 'pp-contact', label: 'التواصل مع العملاء' },
		{ id: 'pp-docs', label: 'رفع مستندات الإثبات' }
	];

	openEditProvider(p: AffiliatedProvider) {
		this.editingProvider.set(p);
		this.editProvSkillIds.set(new Set(p.skillIds));
		this.editProvPermIds.set(new Set(['pp-exec', 'pp-contact', 'pp-docs']));
		this.openModal('edit-provider');
	}
	toggleEditProvSkill(id: string) {
		this.editProvSkillIds.update(set => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
	}
	toggleEditProvPerm(id: string) {
		this.editProvPermIds.update(set => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
	}
	saveEditProvider() {
		const target = this.editingProvider();
		if (!target) return;
		const newSkillIds = Array.from(this.editProvSkillIds());
		this.providers.update(list => list.map(p => p.id === target.id ? { ...p, skillIds: newSkillIds } : p));
		// keep the specialties' assignedProviderIds in sync
		this.skills.update(list => list.map(s => {
			const shouldHave = newSkillIds.includes(s.id);
			const has = s.assignedProviderIds.includes(target.id);
			if (shouldHave && !has) return { ...s, assignedProviderIds: [...s.assignedProviderIds, target.id] };
			if (!shouldHave && has) return { ...s, assignedProviderIds: s.assignedProviderIds.filter(id => id !== target.id) };
			return s;
		}));
		this.closeModal();
		this.toast('تم حفظ تعديلات مقدم الخدمة');
		this.pushActivity('edit', 'المدير - شركة التقنية', `تم تعديل المهارات المسندة لمقدم الخدمة ${target.name}`);
	}

	/* docs review */
	reviewingProvider = signal<AffiliatedProvider | null>(null);
	openDocsReview(p: AffiliatedProvider) { this.reviewingProvider.set(p); this.openModal('docs-review'); }
	sendDocReminder() {
		const p = this.reviewingProvider();
		this.closeModal();
		if (!p) return;
		this.toast(`تم إرسال تذكير لـ${p.name} بالمستند الناقص`);
		this.pushActivity('doc', 'المدير - شركة التقنية', `تم إرسال تذكير لـ${p.name} برفع المستندات الناقصة`);
	}

	/* ---------------- generic row actions (confirm-modal backed) ---------------- */
	async pauseOrResumeEmployee(e: AdminEmployee) {
		if (e.accountStatus === 'suspended') {
			this.employees.update(list => list.map(x => x.id === e.id ? { ...x, accountStatus: 'active' } : x));
			this.toast(`تم تفعيل حساب ${e.name}`);
			return;
		}
		const ok = await this.confirmModal.confirm({ title: 'إيقاف مؤقت', message: `هل أنت متأكد من إيقاف حساب ${e.name} مؤقتاً؟`, type: 'warning' });
		if (!ok) return;
		this.employees.update(list => list.map(x => x.id === e.id ? { ...x, accountStatus: 'suspended' } : x));
		this.toast(`تم إيقاف حساب ${e.name} مؤقتاً`);
	}

	async banEmployee(e: AdminEmployee) {
		const ok = await this.confirmModal.confirm({ title: 'حظر', message: `هل أنت متأكد من حظر ${e.name}؟ سيفقد كل صلاحياته فوراً.`, type: 'danger' });
		if (!ok) return;
		this.employees.update(list => list.map(x => x.id === e.id ? { ...x, accountStatus: 'inactive' } : x));
		this.toast(`تم حظر ${e.name}`);
	}

	async deleteEmployee(e: AdminEmployee) {
		const ok = await this.confirmModal.confirm({ title: 'حذف', message: `هل أنت متأكد من حذف حساب ${e.name}؟ لا يمكن التراجع عن هذا الإجراء.`, type: 'danger' });
		if (!ok) return;
		this.employees.update(list => list.filter(x => x.id !== e.id));
		this.toast(`تم حذف ${e.name}`);
	}

	async pauseOrResumeProvider(p: AffiliatedProvider) {
		if (p.accountStatus === 'suspended') {
			this.providers.update(list => list.map(x => x.id === p.id ? { ...x, accountStatus: 'active' } : x));
			this.toast(`تم تفعيل حساب ${p.name}`);
			return;
		}
		const ok = await this.confirmModal.confirm({ title: 'إيقاف مؤقت', message: `هل أنت متأكد من إيقاف حساب ${p.name} مؤقتاً؟`, type: 'warning' });
		if (!ok) return;
		this.providers.update(list => list.map(x => x.id === p.id ? { ...x, accountStatus: 'suspended' } : x));
		this.toast(`تم إيقاف حساب ${p.name} مؤقتاً`);
	}

	async deleteProvider(p: AffiliatedProvider) {
		const ok = await this.confirmModal.confirm({ title: 'حذف', message: `هل أنت متأكد من حذف مقدم الخدمة ${p.name}؟ لا يمكن التراجع عن هذا الإجراء.`, type: 'danger' });
		if (!ok) return;
		this.providers.update(list => list.filter(x => x.id !== p.id));
		this.toast(`تم حذف ${p.name}`);
	}

	viewLogFor(name: string) {
		this.setTab('log');
		this.toast(`عرض سجل نشاط ${name}`);
	}

	showPendingInvites() { this.toast(`${this.pendingProviderInvites()} مقدمان في انتظار قبول الدعوة`); }
}
