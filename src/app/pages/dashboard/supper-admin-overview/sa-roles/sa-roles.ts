import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AccessAuditRow, AdminRoleRow, AdminTeamService, PermissionDef, PermissionsCatalog, RolePreview, RoleTemplate } from '../../../../core/services/admin-team.service';

const COLORS = ['#D98A0B', '#A56BE0', '#2BD4C7', '#5DA0FF', '#0FA99A', '#FF8C69'];
const ACTION_TEXT: Record<string, { label: string; cls: string }> = {
	ROLE_CREATED: { label: 'دور جديد', cls: 'rl-audit-new' }, ROLE_UPDATED: { label: 'تعديل', cls: 'rl-audit-edited' }, STAFF_ROLE_SET: { label: 'تعيين دور', cls: 'rl-audit-added' },
	STAFF_SUSPENDED: { label: 'إيقاف', cls: 'rl-audit-removed' }, STAFF_REACTIVATED: { label: 'إعادة تفعيل', cls: 'rl-audit-added' }, STAFF_ATTACHED: { label: 'ضم للفريق', cls: 'rl-audit-added' },
	INVITE_CREATED: { label: 'دعوة', cls: 'rl-audit-new' }, INVITE_RESENT: { label: 'إعادة إرسال', cls: 'rl-audit-edited' }, INVITE_CANCELLED: { label: 'إلغاء دعوة', cls: 'rl-audit-removed' },
	INVITE_ACCEPTED: { label: 'قُبلت دعوة', cls: 'rl-audit-added' }, STAFF_ACCESS_SET: { label: 'ضُبطت صلاحيات موظف', cls: 'rl-audit-new' }, STAFF_ACCESS_RESET: { label: 'أُعيد ضبط صلاحيات موظف إلى دوره', cls: 'rl-audit-removed' },
};
const errText = (e: any, fallback: string) => e?.error?.message || fallback;

/** P-AD-024: roles and permissions, for real. Only a SUPER_ADMIN sees this page and changes anything; the matrix, the counts and the trail come from the server. */
@Component({
	selector: 'app-sa-roles',
	standalone: true,
	imports: [WsDatePipe, CommonModule, FormsModule],
	templateUrl: './sa-roles.html',
	styleUrl: './sa-roles.css',
})
export class SaRoles implements OnInit {
	private api = inject(AdminTeamService);
	readonly access = inject(AdminAccessService);

	loading = signal(true); error = signal('');
	roles = signal<AdminRoleRow[]>([]); catalog = signal<PermissionsCatalog | null>(null); audit = signal<AccessAuditRow[]>([]); auditError = signal(false);
	notice = signal('');

	editing = signal<{ id: string | null; version: number; name: string; description: string; color: string; selected: Set<string> } | null>(null);
	preview = signal<RolePreview | null>(null); saving = signal(false); editError = signal(''); conflict = signal(false); needConfirm = signal<string[]>([]); templateNote = signal('');

	permsByGroup = computed(() => {
		const c = this.catalog(); if (!c) return [] as Array<{ group: string; label: string; items: PermissionDef[] }>;
		const out = new Map<string, PermissionDef[]>();
		for (const p of c.permissions) out.set(p.group, [...(out.get(p.group) ?? []), p]);
		return [...out.entries()].map(([group, items]) => ({ group, label: c.groups[group] ?? group, items }));
	});
	label = (id: string) => this.catalog()?.permissions.find(p => p.id === id)?.label ?? id;

	ngOnInit() { this.load(); }
	load() {
		this.loading.set(true); this.error.set('');
		this.api.catalog().subscribe({
			next: c => { this.catalog.set(c.data); this.api.roles().subscribe({ next: r => { this.roles.set(r.data); this.loading.set(false); }, error: e => { this.error.set(errText(e, 'تعذر تحميل الأدوار، حاول مرة أخرى')); this.loading.set(false); } }); },
			error: e => { this.error.set(errText(e, 'تعذر تحميل الأدوار، حاول مرة أخرى')); this.loading.set(false); },
		});
		this.api.accessAudit(12).subscribe({ next: r => { this.audit.set(r.data); this.auditError.set(false); }, error: () => this.auditError.set(true) });
	}
	color(i: number) { return COLORS[i % COLORS.length]; }
	has(role: AdminRoleRow, id: string) { return role.permissions.includes(id); }
	auditView(r: AccessAuditRow) {
		const t = ACTION_TEXT[r.action] ?? { label: r.action, cls: '' };
		const who = r.actor ?? '—', subj = r.subject ? ` ← ${r.subject}` : '';
		const a: any = r.after ?? {};
		const detail = r.action === 'ROLE_UPDATED' ? ` (أُضيف ${a.permissionsAdded?.length ?? 0}، سُحب ${a.permissionsRemoved?.length ?? 0}، متأثرون ${a.affectedMembers?.length ?? 0})` : '';
		return { cls: t.cls, kind: t.label, text: `${who}${subj}${detail}` };
	}

	openCreate(t?: RoleTemplate) {
		this.editError.set(''); this.preview.set(null); this.conflict.set(false); this.needConfirm.set([]); this.templateNote.set(t?.notes ?? '');
		this.editing.set({ id: null, version: 0, name: t?.name ?? '', description: t?.description ?? '', color: t?.color ?? '#2BD4C7', selected: new Set(t?.permissions ?? []) });
	}
	openEdit(r: AdminRoleRow) {
		this.editError.set(''); this.preview.set(null); this.conflict.set(false); this.needConfirm.set([]); this.templateNote.set('');
		this.editing.set({ id: r.id, version: r.version, name: r.name, description: r.description ?? '', color: r.color, selected: new Set(r.permissions) });
	}
	close() { this.editing.set(null); }
	toggle(id: string) { const e = this.editing(); if (!e) return; const s = new Set(e.selected); s.has(id) ? s.delete(id) : s.add(id); this.editing.set({ ...e, selected: s }); this.preview.set(null); this.needConfirm.set([]); }
	isSensitive(id: string) { return !!this.catalog()?.permissions.find(p => p.id === id)?.sensitive; }

	showPreview() {
		const e = this.editing(); if (!e?.id) return;
		this.api.previewRole(e.id, [...e.selected]).subscribe({ next: r => this.preview.set(r.data), error: x => this.editError.set(errText(x, 'تعذّر حساب أثر التعديل')) });
	}
	save(confirmSensitive = false) {
		const e = this.editing(); if (!e || this.saving()) return;
		this.saving.set(true); this.editError.set(''); this.conflict.set(false);
		const body = { name: e.name, description: e.description, color: e.color, permissions: [...e.selected] };
		const done = () => { this.saving.set(false); this.editing.set(null); this.notice.set('حُفظ الدور'); this.load(); };
		const fail = (x: any) => {
			this.saving.set(false);
			const code = x?.error?.code;
			if (code === 'ROLE_VERSION_CONFLICT') { this.conflict.set(true); this.editError.set(x.error.message); return; }
			if (code === 'SENSITIVE_CONFIRMATION_REQUIRED') { this.needConfirm.set(x.error.errors?.[0]?.addedSensitive ?? []); return; }
			this.editError.set(x?.error?.errors?.[0]?.message || errText(x, 'تعذّر الحفظ'));
		};
		if (e.id) this.api.updateRole(e.id, { ...body, expectedVersion: e.version, confirmSensitive }).subscribe({ next: done, error: fail });
		else this.api.createRole(body).subscribe({ next: done, error: fail });
	}
	reloadEditing() { const id = this.editing()?.id; this.close(); this.api.roles().subscribe(r => { this.roles.set(r.data); const cur = r.data.find(x => x.id === id); if (cur) this.openEdit(cur); }); }
}
