import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { WsDateTextPipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { ADMIN_DEPARTMENTS, AdminRoleRow, AdminTeamService, PermissionsCatalog, StaffAccess, StaffMember, TaskRow } from '../../../../../core/services/admin-team.service';
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_TYPE_LABEL } from '../../sa-tasks/sa-tasks';

const errText = (e: any, fallback: string) => e?.error?.message || fallback;

/** P-AD-022-موظف: one team member. Role, status and workload are real; only a SUPER_ADMIN changes the role or the member's access. The permission switches are real: the role gives the base, a SUPER_ADMIN can add (GRANT) or take away (DENY, which beats the role) single permissions for THIS member, narrow the sections, or reset to the role. */
@Component({
	selector: 'app-sa-team-member-detail',
	standalone: true,
	imports: [WsDateTextPipe, WsDatePipe, CommonModule, FormsModule, RouterLink, WsSelectComponent],
	templateUrl: './sa-team-member-detail.html',
	styleUrls: ['../sa-team.css', './sa-team-member-detail.css'],
})
export class SaTeamMemberDetail implements OnInit {
	private api = inject(AdminTeamService);
	private route = inject(ActivatedRoute);
	readonly access = inject(AdminAccessService);
	readonly typeLabel = TASK_TYPE_LABEL; readonly statusLabel = TASK_STATUS_LABEL; readonly priorityLabel = TASK_PRIORITY_LABEL;

	loading = signal(true); error = signal(''); member = signal<StaffMember | null>(null); roles = signal<AdminRoleRow[]>([]); catalog = signal<PermissionsCatalog | null>(null);
	tasks = signal<TaskRow[]>([]); tab = signal<'overview' | 'tasks' | 'perms' | 'log'>('overview'); activity = signal<Array<{ id: string; at: string; kind: string; from: string | null; to: string | null; taskNumber: number; taskTitle: string }>>([]); activityDenied = signal(false);
	readonly kpiBars = ['معدل حل النزاعات', 'الالتزام بـ SLA', 'رضا المستخدمين']; notice = signal(''); busy = signal(false); newRoleId = signal('');
	isSuperAdmin = computed(() => this.access.isSuperAdmin());
	userId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
	readonly roleOpts = computed(() => this.roles().map(r => ({ value: r.id, label: r.name })));
	readonly noRole = [{ value: '', label: 'بلا دور (لا صلاحيات)' }];
	// ---- personal access: what the role gives (inherited), the personal changes on top, the section scope, and the result ----
	access2 = signal<StaffAccess | null>(null);
	draft = signal<Record<string, 'GRANT' | 'DENY'>>({}); draftScoped = signal(false); draftDeps = signal<string[]>([]); needConfirm = signal<string[]>([]);
	readonly departmentList = ADMIN_DEPARTMENTS;
	private deptOf = (id: string) => ADMIN_DEPARTMENTS.find(d => d.permissions.includes(id))?.key ?? null;
	rolePerms = computed(() => new Set(this.access2()?.rolePermissions ?? []));
	/** what the SERVER would apply with the current draft: (role + GRANT) - DENY, then narrowed by the sections */
	private result(id: string): { inherited: boolean; effect: 'GRANT' | 'DENY' | null; effective: boolean; cutByScope: boolean } {
		const inherited = this.rolePerms().has(id); const effect = this.draft()[id] ?? null;
		const base = effect === 'DENY' ? false : effect === 'GRANT' ? true : inherited;
		const dept = this.deptOf(id); const cutByScope = base && this.draftScoped() && !!dept && !this.draftDeps().includes(dept);
		return { inherited, effect, effective: base && !cutByScope, cutByScope };
	}
	groups = computed(() => {
		const c = this.catalog(); if (!c || !this.access2()) return [] as Array<{ label: string; items: Array<{ id: string; label: string; on: boolean; sensitive: boolean; inherited: boolean; effect: 'GRANT' | 'DENY' | null; cutByScope: boolean }> }>;
		const out = new Map<string, any[]>();
		for (const p of c.permissions) { const r = this.result(p.id); out.set(p.group, [...(out.get(p.group) ?? []), { id: p.id, label: p.label, on: r.effective, sensitive: p.sensitive, inherited: r.inherited, effect: r.effect, cutByScope: r.cutByScope }]); }
		return [...out.entries()].map(([g, items]) => ({ label: c.groups[g] ?? g, items }));
	});
	personalCount = computed(() => Object.keys(this.draft()).length);
	dirty = computed(() => {
		const a = this.access2(); if (!a) return false;
		const cur = Object.fromEntries(a.overrides.map(o => [o.permission, o.effect]));
		const same = JSON.stringify(Object.entries(cur).sort()) === JSON.stringify(Object.entries(this.draft()).sort());
		return !same || a.scoped !== this.draftScoped() || (this.draftScoped() && JSON.stringify([...a.departments].sort()) !== JSON.stringify([...this.draftDeps()].sort()));
	});
	private loadAccess() {
		const m = this.member(); if (!m || !this.isSuperAdmin()) return;
		this.api.staffAccess(m.userId).subscribe({ next: r => { this.access2.set(r.data); this.draft.set(Object.fromEntries(r.data.overrides.map(o => [o.permission, o.effect]))); this.draftScoped.set(r.data.scoped); this.draftDeps.set([...r.data.departments]); this.needConfirm.set([]); }, error: () => this.access2.set(null) });
	}
	/** flipping a switch: back to what the role gives = no personal change; otherwise a personal GRANT (role lacks it) or DENY (role has it) */
	togglePerm(id: string) {
		const r = this.result(id); const wantOn = !(r.effect ? r.effect === 'GRANT' : r.inherited);
		this.draft.update(d => { const n = { ...d }; if (wantOn === r.inherited) delete n[id]; else n[id] = wantOn ? 'GRANT' : 'DENY'; return n; });
		this.needConfirm.set([]);
	}
	toggleScoped() { this.draftScoped.update(v => !v); if (this.draftScoped() && !this.draftDeps().length) this.draftDeps.set(ADMIN_DEPARTMENTS.filter(d => d.permissions.some(p => this.rolePerms().has(p))).map(d => d.key)); }
	toggleDraftDept(key: string) { this.draftDeps.update(l => (l.includes(key) ? l.filter(x => x !== key) : [...l, key])); }
	savePerms(confirm = false) {
		const m = this.member(), a = this.access2(); if (!m || !a || this.busy()) return; this.busy.set(true); this.notice.set('');
		this.api.setStaffAccess(m.userId, { overrides: Object.entries(this.draft()).map(([permission, effect]) => ({ permission, effect })), scoped: this.draftScoped(), departments: this.draftScoped() ? this.draftDeps() : [], expectedVersion: a.version, ...(confirm ? { confirmSensitive: true } : {}) }).subscribe({
			next: () => { this.busy.set(false); this.notice.set('حُفظت صلاحيات الموظف وسرت على طلبه التالي؛ زملاؤه لم يتغيروا'); this.load(); },
			error: e => { this.busy.set(false);
				if (e?.error?.code === 'SENSITIVE_CONFIRMATION_REQUIRED') { this.needConfirm.set(e.error.errors?.[0]?.addedSensitive ?? []); return; }
				this.notice.set(e?.error?.code === 'STAFF_VERSION_CONFLICT' ? 'تغيّر ملف الموظف من جهة أخرى. أُعيد التحميل، راجع ثم أعد المحاولة.' : errText(e, 'تعذّر حفظ الصلاحيات')); if (e?.error?.code === 'STAFF_VERSION_CONFLICT') this.load(); },
		});
	}
	/** «إعادة الضبط إلى صلاحيات الدور»: removes every personal change and the section scope */
	resetToRole() { this.draft.set({}); this.draftScoped.set(false); this.draftDeps.set([]); this.savePerms(); }
	confirmText() { return this.needConfirm().map(id => this.labelOf(id)).join('، '); }
	labelOf(id: string) { return this.catalog()?.permissions.find(p => p.id === id)?.label ?? id; }

	ngOnInit() { this.load(); }
	load() {
		this.loading.set(true); this.error.set('');
		this.api.staff({}).subscribe({
			next: r => {
				const m = r.data.members.find(x => x.userId === this.userId()) ?? null; this.member.set(m); this.newRoleId.set(m?.role?.id ?? ''); this.loading.set(false);
				if (m && (this.access.can('tasks.manage') || m.userId === this.access.access()?.userId)) this.api.tasks({ assigneeId: m.userId, tab: '' }).subscribe({ next: t => this.tasks.set(t.data), error: () => this.tasks.set([]) });
				if (m) this.api.staffActivity(m.userId).subscribe({ next: a => { this.activity.set(a.data); this.activityDenied.set(false); }, error: e => { this.activity.set([]); this.activityDenied.set(e?.status === 403); } });
				if (this.isSuperAdmin()) { this.api.roles().subscribe(x => this.roles.set(x.data)); this.api.catalog().subscribe(x => { this.catalog.set(x.data); }); this.loadAccess(); }
			},
			error: e => { this.error.set(errText(e, 'تعذّر تحميل ملف الموظف')); this.loading.set(false); },
		});
	}
	saveRole() {
		const m = this.member(); if (!m || this.busy()) return; this.busy.set(true); this.notice.set('');
		this.api.setStaffRole(m.userId, this.newRoleId() || null, m.version).subscribe({
			next: () => { this.busy.set(false); this.notice.set('تغيّر الدور وسرى على الطلب التالي للموظف'); this.load(); },
			error: e => { this.busy.set(false); this.notice.set(e?.error?.code === 'STAFF_VERSION_CONFLICT' ? 'تغيّر ملف الموظف من جهة أخرى. أُعيد التحميل، راجع ثم أعد المحاولة.' : errText(e, 'تعذّر تغيير الدور')); if (e?.error?.code === 'STAFF_VERSION_CONFLICT') this.load(); },
		});
	}
	toggleAccess() {
		const m = this.member(); if (!m || this.busy()) return; this.busy.set(true); this.notice.set('');
		(m.status === 'ACTIVE' ? this.api.suspend(m.userId) : this.api.reactivate(m.userId)).subscribe({
			next: () => { this.busy.set(false); this.notice.set(m.status === 'ACTIVE' ? 'أُوقف وصول الموظف فورًا' : 'أُعيد تفعيل وصول الموظف'); this.load(); },
			error: e => { this.busy.set(false); this.notice.set(errText(e, 'تعذّر تنفيذ الإجراء')); },
		});
	}
	activityText(a: { kind: string; from: string | null; to: string | null; taskNumber: number; taskTitle: string }) {
		const code = `T-${String(a.taskNumber).padStart(4, '0')}`;
		switch (a.kind) {
			case 'CREATED': return `أنشأ المهمة ${code} · ${a.taskTitle}`;
			case 'ASSIGNED': return `أعاد إسناد المهمة ${code} · ${a.taskTitle}`;
			case 'STATUS': return `نقل المهمة ${code} إلى «${this.statusLabel[a.to ?? ''] ?? a.to}»`;
			default: return `عدّل المهمة ${code} · ${a.taskTitle}`;
		}
	}
	departmentsText(d: string[]): string { return d.length ? d.slice(0, 3).join(' · ') + (d.length > 3 ? ` +${d.length - 3}` : '') : '—'; }
	initial(n: string) { return (n || '?').trim().charAt(0); }
}
