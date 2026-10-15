import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SaNotifyModal } from '../../sa-notify-modal';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { handleAdminError, reportAdminProblems, SubmitGuard } from '../../shared/admin-form-report';
import { SaUsersService, AdminUserDetail } from '../sa-users.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

type DetailTab = 'overview' | 'requests' | 'purchases' | 'disputes' | 'reports' | 'contracts' | 'payments';

@Component({
	selector: 'app-sa-user-detail',
	standalone: true,
	imports: [CommonModule, RouterLink, FormsModule, WsSelectComponent, SaNotifyModal],
	templateUrl: './sa-user-detail.html',
	styleUrl: './sa-user-detail.css'
})
export class SaUserDetail implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private usersService = inject(SaUsersService);
	private authStore = inject(AuthStore);
	private notify = inject(UiNotificationService);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private guard = new SubmitGuard();

	readonly isSuperAdmin = computed(() => this.authStore.currentUser()?.accountType === AccountType.SUPER_ADMIN);
	readonly isSelf = computed(() => this.authStore.currentUser()?.id === this.user()?.id);

	// ── status / roles / delete modals (every one confirms; the server enforces the rules and writes the audit row)
	notifyOpen = signal(false);
	modal = signal<'status' | 'roles' | 'delete' | null>(null);
	busy = signal(false);
	modalError = signal('');
	reason = signal('');
	rolePick = signal<string[]>([]);
	activeRolePick = signal('');
	readonly activeRoleOptions = computed(() => this.rolePick().map(r => ({ value: r, label: this.roleLabels[r] ?? r })));
	readonly manageableRoles: { key: string; label: string }[] = [{ key: 'CLIENT', label: 'طالب خدمة' }, { key: 'PROVIDER', label: 'مقدم خدمة' }, { key: 'AFFILIATE', label: 'وسيط تسويقي' }];

	user = signal<AdminUserDetail | null>(null);
	loading = signal<boolean>(true);
	notFound = signal<boolean>(false);
	error = signal<string>('');
	activeTab = signal<DetailTab>('overview');

	SL: Record<string, string> = { active: 'نشط', suspended: 'موقوف', suspended_review: 'معلق مراجعة', pending_verification: 'معلق' };
	SC: Record<string, string> = { active: 's-active', suspended: 's-suspended', suspended_review: 's-pending', pending_verification: 's-pending' };
	LC: Record<string, string> = { Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#D98A0B', Platinum: '#5DA0FF' };

	tabs: { key: DetailTab; label: string }[] = [
		{ key: 'overview', label: 'نظرة عامة' },
		{ key: 'requests', label: 'طلباته' },
		{ key: 'purchases', label: 'مشترياته' },
		{ key: 'disputes', label: 'نزاعاته' },
		{ key: 'reports', label: 'تذاكر الدعم' },
		{ key: 'contracts', label: 'عقوده' },
		{ key: 'payments', label: 'مدفوعاته' },
	];

	ngOnInit(): void {
		const wanted = this.route.snapshot.queryParamMap.get('tab') as DetailTab | null;
		if (wanted && this.tabs.some(t => t.key === wanted)) this.activeTab.set(wanted);
		this.route.paramMap.subscribe(params => {
			const id = params.get('id');
			if (!id) {
				this.notFound.set(true);
				this.loading.set(false);
				return;
			}
			this.fetchDetail(id);
		});
	}

	private fetchDetail(id: string): void {
		this.loading.set(true);
		this.notFound.set(false);
		this.error.set('');
		this.user.set(null);

		this.usersService.getUserDetail(id).subscribe({
			next: (res) => {
				this.loading.set(false);
				if (res?.success && res.data) {
					this.user.set(res.data);
				} else {
					this.notFound.set(true);
				}
			},
			error: (err) => {
				this.loading.set(false);
				if (err?.status === 404) {
					this.notFound.set(true);
				} else {
					this.error.set(err?.error?.message || 'تعذر تحميل ملف المستخدم، حاول مرة أخرى');
				}
			}
		});
	}

	retry(): void {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) this.fetchDetail(id);
	}

	setTab(tab: DetailTab): void {
		this.activeTab.set(tab);
	}

	tabCount(u: AdminUserDetail, tab: DetailTab): number | null {
		const n = (u.tabs?.[tab as keyof typeof u.tabs] as unknown[] | undefined)?.length;
		return n || null;
	}

	/** Revenue bar chart: scale each point to the max in the series. */
	revenueBarHeight(u: AdminUserDetail, value: number): number {
		const max = Math.max(...u.revenueHistory.map(p => p.value), 1);
		return Math.max(4, Math.round((value / max) * 100));
	}

	get adminLocked(): boolean { return this.user()?.type === 'admin' && !this.isSuperAdmin(); }
	get isAdminAccount(): boolean { return this.user()?.type === 'admin'; }

	openModal(kind: 'status' | 'roles' | 'delete'): void {
		const u = this.user();
		if (!u) return;
		this.modal.set(kind);
		this.modalError.set('');
		this.reason.set('');
		if (kind === 'roles') { this.rolePick.set([...(u.roles ?? [])].filter(r => this.manageableRoles.some(m => m.key === r))); this.activeRolePick.set(u.activeRole ?? ''); }
	}

	closeModal(): void { if (!this.busy()) this.modal.set(null); }

	toggleRole(key: string): void {
		this.rolePick.update(list => (list.includes(key) ? list.filter(r => r !== key) : [...list, key]));
		if (!this.rolePick().includes(this.activeRolePick())) this.activeRolePick.set(this.rolePick()[0] ?? '');
	}

	private done(text: string): void {
		this.guard.release();
		this.busy.set(false);
		this.modal.set(null);
		this.notify.success(text);
	}

	private fail(err: any, fallback: string, resolve: Record<string, string> = {}): void {
		this.guard.release();
		this.busy.set(false);
		handleAdminError(this.host.nativeElement, err, { fallback, resolve }, (m) => this.modalError.set(m));
	}

	confirmStatus(): void {
		const u = this.user();
		if (!u || this.busy()) return;
		const suspend = u.statusOriginal === 'ACTIVE';
		const reason = this.reason().trim();
		this.modalError.set('');
		if (suspend && reason.length < 3) { void reportAdminProblems(this.host.nativeElement, [{ field: 'ud-reason', message: reason ? 'سبب الإيقاف قصير جدًا (3 أحرف على الأقل)' : 'سبب الإيقاف مطلوب (3 أحرف على الأقل)' }]); return; }
		if (!this.guard.enter()) return;
		this.busy.set(true);
		this.usersService.updateUserStatus(u.id, suspend ? 'SUSPENDED' : 'ACTIVE', suspend ? reason : undefined).subscribe({
			next: () => { this.done(suspend ? 'تم إيقاف الحساب وتسجيل الإجراء' : 'تم تفعيل الحساب وتسجيل الإجراء'); this.retry(); },
			error: (err) => this.fail(err, 'تعذر تغيير حالة الحساب', { reason: 'ud-reason' })
		});
	}

	confirmRoles(): void {
		const u = this.user();
		if (!u || this.busy()) return;
		this.modalError.set('');
		if (this.rolePick().length === 0) { void reportAdminProblems(this.host.nativeElement, [{ field: 'ud-roles', message: 'يجب أن يحتفظ الحساب بدور واحد على الأقل' }]); return; }
		if (!this.guard.enter()) return;
		this.busy.set(true);
		this.usersService.updateUserRoles(u.id, this.rolePick(), this.activeRolePick() || undefined).subscribe({
			next: () => { this.done('تم تحديث أدوار الحساب وتسجيل الإجراء'); this.retry(); },
			error: (err) => this.fail(err, 'تعذر تحديث الأدوار', { roles: 'ud-roles', activeRole: 'ud-active-role' })
		});
	}

	confirmDelete(): void {
		const u = this.user();
		if (!u || this.busy() || !this.guard.enter()) return;
		this.modalError.set('');
		this.busy.set(true);
		this.usersService.deleteUser(u.id).subscribe({
			next: () => { this.guard.release(); this.busy.set(false); this.modal.set(null); this.router.navigate(['/supper-admin-overview/users']); },
			error: (err) => this.fail(err, 'تعذر حذف الحساب')
		});
	}

	onNotifySent(): void {
		this.notifyOpen.set(false);
		this.notify.success('تم إرسال الرسالة وتسجيلها في سجل التدقيق');
		this.retry();
	}

	readonly statusLabels: Record<string, string> = { OPEN: 'مفتوح', IN_PROGRESS: 'جارٍ', COMPLETED: 'مكتمل', CANCELLED: 'ملغى', DRAFT: 'مسودة', PENDING_SIGNATURE: 'بانتظار التوقيع', UNDER_REVIEW: 'قيد المراجعة', RESOLVED: 'محسوم', REJECTED: 'مرفوض', ACTIVE: 'ساري', PENDING_PAYMENT: 'بانتظار الدفع', PENDING_CLIENT_SIGNATURE: 'بانتظار توقيع العميل', PENDING_PROVIDER_SIGNATURE: 'بانتظار توقيع المزود', DISPUTED: 'متنازع عليه', PAID: 'مدفوع', PENDING: 'معلق', FAILED: 'فشل', CLOSED: 'مغلق', AWAITING_CUSTOMER: 'بانتظار العميل' };
	readonly roleLabels: Record<string, string> = { CLIENT: 'طالب خدمة', PROVIDER: 'مقدم خدمة', AFFILIATE: 'وسيط تسويقي', ADMIN: 'إداري', SUPER_ADMIN: 'مدير عام' };
	readonly kycLabels: Record<string, string> = { UNVERIFIED: 'غير موثّق', PENDING: 'قيد المراجعة', VERIFIED: 'موثّق', REJECTED: 'مرفوض', APPROVED: 'معتمد' };
	label(map: Record<string, string>, key: string | null | undefined): string { return key ? (map[key] ?? key) : '—'; }

	goBack(): void {
		this.router.navigate(['/supper-admin-overview/users']);
	}
}
