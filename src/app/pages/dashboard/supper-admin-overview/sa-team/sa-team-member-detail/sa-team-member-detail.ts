import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { AdminRoleRow, AdminTeamService, PermissionsCatalog, StaffMember, TaskRow } from '../../../../../core/services/admin-team.service';
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL, TASK_TYPE_LABEL } from '../../sa-tasks/sa-tasks';

const errText = (e: any, fallback: string) => e?.error?.message || fallback;

/** P-AD-022-موظف: one team member. Role, status and workload are real; only the owner changes the role or the member's access. Per-person permission toggles of the design are NOT built: access comes from the role (one source of truth). */
@Component({
	selector: 'app-sa-team-member-detail',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink, DatePipe, WsSelectComponent],
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
	isOwner = computed(() => this.access.isOwner());
	userId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
	readonly roleOpts = computed(() => this.roles().map(r => ({ value: r.id, label: r.name })));
	readonly noRole = [{ value: '', label: 'بلا دور (لا صلاحيات)' }];
	rolePerms = computed(() => { const m = this.member(); return this.roles().find(r => r.id === m?.role?.id)?.permissions ?? []; });
	groups = computed(() => {
		const c = this.catalog(); if (!c) return [] as Array<{ label: string; items: Array<{ id: string; label: string; on: boolean; sensitive: boolean }> }>;
		const on = new Set(this.rolePerms()); const out = new Map<string, Array<{ id: string; label: string; on: boolean; sensitive: boolean }>>();
		for (const p of c.permissions) out.set(p.group, [...(out.get(p.group) ?? []), { id: p.id, label: p.label, on: this.member()?.isOwner ? true : on.has(p.id), sensitive: p.sensitive }]);
		return [...out.entries()].map(([g, items]) => ({ label: c.groups[g] ?? g, items }));
	});

	ngOnInit() { this.load(); }
	load() {
		this.loading.set(true); this.error.set('');
		this.api.staff({}).subscribe({
			next: r => {
				const m = r.data.members.find(x => x.userId === this.userId()) ?? null; this.member.set(m); this.newRoleId.set(m?.role?.id ?? ''); this.loading.set(false);
				if (m && (this.access.can('tasks.manage') || m.userId === this.access.access()?.userId)) this.api.tasks({ assigneeId: m.userId, tab: '' }).subscribe({ next: t => this.tasks.set(t.data), error: () => this.tasks.set([]) });
				if (m) this.api.staffActivity(m.userId).subscribe({ next: a => { this.activity.set(a.data); this.activityDenied.set(false); }, error: e => { this.activity.set([]); this.activityDenied.set(e?.status === 403); } });
				if (this.isOwner()) { this.api.roles().subscribe(x => this.roles.set(x.data)); this.api.catalog().subscribe(x => this.catalog.set(x.data)); }
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
	initial(n: string) { return (n || '?').trim().charAt(0); }
}
