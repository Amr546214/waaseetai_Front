import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AdminTeamService, StaffMember, TaskRow, TaskSummary } from '../../../../core/services/admin-team.service';

export const TASK_TYPE_LABEL: Record<string, string> = { DISPUTE: 'نزاع', REPORT: 'بلاغ', SUPPORT: 'دعم', APPROVAL: 'اعتماد', FINANCE: 'مالي', DOCUMENT: 'تقرير' };
export const TASK_STATUS_LABEL: Record<string, string> = { NEW: 'جديدة', IN_PROGRESS: 'جارٍ', PENDING: 'معلق', DONE: 'مكتمل', CANCELLED: 'ملغاة' };
export const TASK_PRIORITY_LABEL: Record<string, string> = { URGENT: 'عاجلة', HIGH: 'عالية', MEDIUM: 'متوسطة', NORMAL: 'عادية', LOW: 'منخفضة' };
const PRIORITY_STYLE: Record<string, [string, string]> = { URGENT: ['#FF5050', 'rgba(255,80,80,.10)'], HIGH: ['#FF8C69', 'rgba(255,140,105,.10)'], MEDIUM: ['#D98A0B', 'rgba(255,180,0,.10)'], NORMAL: ['#6B7699', 'rgba(255,255,255,.06)'], LOW: ['#6B7699', 'rgba(255,255,255,.06)'] };
const STATUS_STYLE: Record<string, [string, string]> = { NEW: ['#6B7699', 'rgba(255,255,255,.06)'], IN_PROGRESS: ['#FFB400', 'rgba(255,180,0,.10)'], PENDING: ['#5DA0FF', 'rgba(43,127,255,.10)'], DONE: ['#0FA99A', 'rgba(15,169,154,.10)'], CANCELLED: ['#6B7699', 'rgba(255,255,255,.06)'] };
const errText = (e: any, fallback: string) => e?.error?.errors?.[0]?.message || e?.error?.message || fallback;

/** P-AD-025: tasks and assignments, for real. A member sees their own tasks; whoever holds tasks.manage sees the team's. Assigning grants nothing; the server refuses an assignee who lacks the permission the work needs. */
@Component({
	selector: 'app-sa-tasks',
	standalone: true,
	imports: [WsDatePipe, CommonModule, FormsModule, RouterLink, WsSelectComponent],
	templateUrl: './sa-tasks.html',
	styleUrl: './sa-tasks.css',
})
export class SaTasks implements OnInit {
	private api = inject(AdminTeamService);
	readonly access = inject(AdminAccessService);
	readonly typeOpts = Object.entries(TASK_TYPE_LABEL).map(([value, label]) => ({ value, label: label as string }));
	readonly prioOpts = Object.entries(TASK_PRIORITY_LABEL).map(([value, label]) => ({ value, label: label as string }));
	readonly allStaff = [{ value: '', label: 'كل الموظفين' }]; readonly allTypes = [{ value: '', label: 'كل الأنواع' }]; readonly noAssignee = [{ value: '', label: 'بلا تكليف' }];
	readonly teamOpts = computed(() => this.team().map(m => ({ value: m.userId, label: m.name })));
	readonly typeLabel = TASK_TYPE_LABEL; readonly statusLabel = TASK_STATUS_LABEL; readonly priorityLabel = TASK_PRIORITY_LABEL;

	loading = signal(true); error = signal(''); tasks = signal<TaskRow[]>([]); summary = signal<TaskSummary | null>(null); team = signal<StaffMember[]>([]);
	tab = signal('open'); search = signal(''); assigneeFilter = signal(''); typeFilter = signal(''); view = signal<'list' | 'kanban'>('kanban');
	detail = signal<(TaskRow & { events: Array<{ kind: string; from: string | null; to: string | null; at: string }> }) | null>(null); detailError = signal(''); busy = signal(false);
	creating = signal(false); createError = signal(''); form = { title: '', description: '', type: 'SUPPORT', priority: 'NORMAL', dueAt: '', assigneeId: '' };

	canManage = computed(() => this.access.can('tasks.manage'));
	workload = computed(() => {
		const m = new Map<string, { name: string; n: number }>();
		for (const t of this.tasks()) if (t.assignee && ['NEW', 'IN_PROGRESS', 'PENDING'].includes(t.status)) { const x = m.get(t.assignee.id) ?? { name: t.assignee.name, n: 0 }; x.n++; m.set(t.assignee.id, x); }
		const rows = [...m.values()].sort((a, b) => b.n - a.n); const max = Math.max(1, ...rows.map(r => r.n));
		return rows.map(r => ({ ...r, pct: Math.round((r.n / max) * 100), color: r.n > 8 ? '#FF8C69' : r.n >= 4 ? '#FFB400' : '#0FA99A' }));
	});
	kanban = computed(() => ['NEW', 'IN_PROGRESS', 'OVERDUE', 'DONE'].map(k => ({ key: k, tasks: this.tasks().filter(t => k === 'OVERDUE' ? t.overdue : k === 'NEW' ? t.status === 'NEW' && !t.overdue : k === 'IN_PROGRESS' ? (t.status === 'IN_PROGRESS' || t.status === 'PENDING') && !t.overdue : t.status === 'DONE') })));

	ngOnInit() { this.load(); if (this.canManage() && this.access.can('team.view')) this.api.staff({ status: 'ACTIVE' }).subscribe({ next: r => this.team.set(r.data.members), error: () => undefined }); }
	load() {
		this.loading.set(true); this.error.set('');
		this.api.taskSummary().subscribe({ next: r => this.summary.set(r.data), error: () => this.summary.set(null) });
		this.api.tasks({ tab: this.tab() === 'all' ? '' : this.tab(), search: this.search(), assigneeId: this.assigneeFilter(), type: this.typeFilter() }).subscribe({
			next: r => { this.tasks.set(r.data); this.loading.set(false); },
			error: e => { this.error.set(errText(e, 'تعذّر تحميل المهام، حاول مرة أخرى')); this.loading.set(false); },
		});
	}
	setTab(t: string) { this.tab.set(t); this.load(); }
	pStyle(p: string) { const [c, b] = PRIORITY_STYLE[p] ?? PRIORITY_STYLE['NORMAL']; return { color: c, background: b }; }
	sStyle(s: string) { const [c, b] = STATUS_STYLE[s] ?? STATUS_STYLE['NEW']; return { color: c, background: b }; }
	title = computed(() => ({ open: 'المهام الجارية', pending: 'المهام المعلقة', done: 'المهام المكتملة', all: 'كل المهام' } as Record<string, string>)[this.tab()]);

	open(t: TaskRow) { this.detailError.set(''); this.api.task(t.id).subscribe({ next: r => this.detail.set(r.data), error: e => this.error.set(errText(e, 'تعذّر فتح المهمة')) }); }
	closeDetail() { this.detail.set(null); }
	setStatus(status: string) {
		const d = this.detail(); if (!d || this.busy()) return; this.busy.set(true); this.detailError.set('');
		this.api.setTaskStatus(d.id, status, d.version).subscribe({
			next: () => { this.busy.set(false); this.open(d); this.load(); },
			error: e => { this.busy.set(false); this.detailError.set(e?.error?.code === 'TASK_VERSION_CONFLICT' ? 'عُدّلت المهمة من جهة أخرى. أُعيد تحميلها، راجعها ثم أعد المحاولة.' : errText(e, 'تعذّر تغيير الحالة')); if (e?.error?.code === 'TASK_VERSION_CONFLICT') { this.open(d); this.load(); } },
		});
	}
	canChangeStatus(d: TaskRow) { return this.canManage() || d.assignee?.id === this.access.access()?.userId; }

	openCreate() { this.form = { title: '', description: '', type: 'SUPPORT', priority: 'NORMAL', dueAt: '', assigneeId: '' }; this.createError.set(''); this.creating.set(true); }
	create() {
		if (this.busy()) return; this.busy.set(true); this.createError.set('');
		const b: Record<string, string> = { title: this.form.title, type: this.form.type, priority: this.form.priority };
		if (this.form.description) b['description'] = this.form.description; if (this.form.dueAt) b['dueAt'] = new Date(this.form.dueAt).toISOString(); if (this.form.assigneeId) b['assigneeId'] = this.form.assigneeId;
		this.api.createTask(b as any).subscribe({ next: () => { this.busy.set(false); this.creating.set(false); this.load(); }, error: e => { this.busy.set(false); this.createError.set(errText(e, 'تعذّر إنشاء المهمة')); } });
	}
}
