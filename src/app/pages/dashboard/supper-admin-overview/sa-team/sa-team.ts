import { ADMIN_DEPARTMENTS } from '../../../../core/services/admin-team.service';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { AdminRoleRow, AdminTeamService, PendingInvite, StaffList, StaffMember } from '../../../../core/services/admin-team.service';

const AVATARS = ['linear-gradient(135deg,#A56BE0,#5DA0FF)', 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', 'linear-gradient(135deg,#FFB400,#D98A0B)', 'linear-gradient(135deg,#FF8C69,#D98A0B)', 'linear-gradient(135deg,#0FA99A,#2BD4C7)', 'linear-gradient(135deg,#5DA0FF,#2BD4C7)'];
const errText = (e: any, fallback: string) => e?.error?.message || fallback;

/** P-AD-022: the admin team. Real staff, roles, invitations and task counts from the server; nothing from the design's sample data. Inviting and placing accounts is a SUPER_ADMIN's alone. */
@Component({
	selector: 'app-sa-team',
	standalone: true,
	imports: [WsDatePipe, CommonModule, FormsModule, RouterLink, DatePipe, WsSelectComponent],
	templateUrl: './sa-team.html',
	styleUrl: './sa-team.css',
})
export class SaTeam implements OnInit {
	private api = inject(AdminTeamService);
	readonly access = inject(AdminAccessService);

	loading = signal(true); error = signal(''); data = signal<StaffList | null>(null); roles = signal<AdminRoleRow[]>([]);
	tab = signal<string>('all'); search = signal(''); roleFilter = signal(''); statusFilter = signal('');
	inviteOpen = signal(false); inviteBusy = signal(false); inviteError = signal(''); invite = { email: '', fullName: '', roleId: '' }; inviteResult = signal<{ link: string; emailed: boolean } | null>(null);
	unplaced = signal<Array<{ userId: string; name: string; email: string; accountType: string; lastActiveAt: string | null }>>([]); attachRole: Record<string, string> = {};
	notice = signal(''); busyId = signal('');

	isSuperAdmin = computed(() => this.access.isSuperAdmin());
	canSeeRoles = computed(() => this.access.isSuperAdmin());
	filtered = computed<StaffMember[]>(() => {
		const d = this.data(); if (!d) return [];
		return d.members.filter(m => (this.tab() === 'all' || this.tab() === 'pending' || m.role?.id === this.tab()));
	});
	counts = computed(() => this.data()?.counts);
	workload = computed(() => {
		const ms = this.data()?.members.filter(m => m.status === 'ACTIVE') ?? [];
		const heavy = ms.filter(m => m.openTasks > 8).length, mid = ms.filter(m => m.openTasks >= 4 && m.openTasks <= 8).length, light = ms.filter(m => m.openTasks < 4).length;
		const avg = ms.length ? Math.round((ms.reduce((a, m) => a + m.openTasks, 0) / ms.length) * 10) / 10 : null;
		return { heavy, mid, light, avg };
	});

	ngOnInit() { this.load(); if (this.isSuperAdmin()) { this.api.roles().subscribe({ next: r => this.roles.set(r.data), error: () => undefined }); this.loadUnplaced(); } }

	load() {
		this.loading.set(true); this.error.set('');
		this.api.staff({ search: this.search(), roleId: this.roleFilter(), status: this.statusFilter(), tab: this.tab() === 'pending' ? 'pending' : undefined }).subscribe({
			next: r => { this.data.set(r.data); this.loading.set(false); },
			error: e => { this.error.set(errText(e, 'تعذّر تحميل الفريق، حاول مرة أخرى')); this.loading.set(false); },
		});
	}
	loadUnplaced() { this.api.unplaced().subscribe({ next: r => this.unplaced.set(r.data), error: () => this.unplaced.set([]) }); }
	setTab(t: string) { this.tab.set(t); this.load(); }
	onFilter() { this.load(); }
	avatar(i: number) { return AVATARS[i % AVATARS.length]; }
	/** At most three departments are written out; the rest is a count (a broad role would otherwise fill the card). */
	departments(m: { departments: string[] }): string { const d = m.departments; return d.length ? d.slice(0, 3).join(' · ') + (d.length > 3 ? ` +${d.length - 3}` : '') : 'بلا أقسام'; }
	initial(name: string) { return (name || '?').trim().charAt(0); }
	roleTabs = computed(() => this.roles());
	/** The design's «الأقسام المتاحة»: a REAL data scope. Nothing selected = no section scope (the role decides); selected sections narrow what the member's permissions apply to. It never grants. */
	readonly departmentList = ADMIN_DEPARTMENTS;
	inviteDeps = signal<string[]>([]);
	toggleDept(key: string) { this.inviteDeps.update(l => (l.includes(key) ? l.filter(x => x !== key) : [...l, key])); }
	roleCovers(key: string): boolean { const held = new Set(this.roles().find(r => r.id === this.invite.roleId)?.permissions ?? []); return !!ADMIN_DEPARTMENTS.find(d => d.key === key)?.permissions.some(p => held.has(p)); }
	readonly roleOpts = computed(() => this.roles().map(r => ({ value: r.id, label: r.name })));
	readonly allRoles = [{ value: '', label: 'كل الأدوار' }]; readonly noRole = [{ value: '', label: 'بلا دور' }];
	readonly statusOpts = [{ value: '', label: 'كل الحالات' }, { value: 'ACTIVE', label: 'نشط' }, { value: 'SUSPENDED', label: 'موقوف' }];

	openInvite() { this.invite = { email: '', fullName: '', roleId: this.roles()[0]?.id ?? '' }; this.inviteDeps.set([]); this.inviteError.set(''); this.inviteResult.set(null); this.inviteOpen.set(true); }
	closeInvite() { this.inviteOpen.set(false); this.load(); }
	sendInvite() {
		if (this.inviteBusy()) return; this.inviteBusy.set(true); this.inviteError.set('');
		this.api.invite({ email: this.invite.email, fullName: this.invite.fullName, roleId: this.invite.roleId, ...(this.inviteDeps().length ? { departments: this.inviteDeps() } : {}) }).subscribe({
			next: r => { this.inviteBusy.set(false); this.inviteResult.set({ link: r.data.link, emailed: r.data.emailed }); },
			error: e => { this.inviteBusy.set(false); this.inviteError.set(e?.error?.errors?.[0]?.message || errText(e, 'تعذّر إنشاء الدعوة')); },
		});
	}
	copy(link: string) { void navigator.clipboard?.writeText(link).then(() => this.notice.set('نُسخ رابط الدعوة'), () => this.notice.set('تعذّر النسخ، انسخ الرابط يدويًا')); }
	resend(i: PendingInvite) {
		this.busyId.set(i.id);
		this.api.resendInvite(i.id).subscribe({
			next: r => { this.busyId.set(''); this.inviteResult.set({ link: r.data.link, emailed: r.data.emailed }); this.inviteOpen.set(true); this.invite = { email: i.email, fullName: i.fullName, roleId: '' }; this.load(); },
			error: e => { this.busyId.set(''); this.notice.set(errText(e, 'تعذّرت إعادة الإرسال')); },
		});
	}
	cancel(i: PendingInvite) {
		this.busyId.set(i.id);
		this.api.cancelInvite(i.id).subscribe({ next: () => { this.busyId.set(''); this.notice.set('أُلغيت الدعوة'); this.load(); }, error: e => { this.busyId.set(''); this.notice.set(errText(e, 'تعذّر إلغاء الدعوة')); } });
	}
	attach(userId: string) {
		const roleId = this.attachRole[userId] || null; this.busyId.set(userId);
		this.api.attach(userId, roleId).subscribe({ next: () => { this.busyId.set(''); this.notice.set('أُضيف الحساب إلى الفريق'); this.load(); this.loadUnplaced(); }, error: e => { this.busyId.set(''); this.notice.set(errText(e, 'تعذّرت الإضافة')); } });
	}
}
