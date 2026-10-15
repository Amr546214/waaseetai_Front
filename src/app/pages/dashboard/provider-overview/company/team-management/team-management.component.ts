import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CompanyTeamService } from '../../../../../core/services/company-team.service';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { FieldProblem, SubmitGuard, reportBackendError, reportProblems } from '../../../../../shared/forms/form-error-focus';
import { genericBanner } from '../../../../../shared/forms/submit-feedback';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import {
	CompanyTeamMember,
	CreateTeamMemberPayload,
	TeamMemberStatus,
	TeamMemberType,
} from '../../../../../core/models/company-team.model';

type TeamTab = 'providers' | 'employees' | 'pending' | 'inactive';

const AVATAR_GRADIENTS = [
	'linear-gradient(135deg,#A56BE0,#7B2FBE)',
	'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
	'linear-gradient(135deg,#0FA99A,#0D8A7E)',
	'linear-gradient(135deg,#FFB400,#D98A0B)',
	'linear-gradient(135deg,#E05B6B,#C0394A)',
	'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
];

const STATUS_LABELS: Record<TeamMemberStatus, string> = {
	ACTIVE: 'نشط',
	PENDING: 'دعوة معلقة',
	INACTIVE: 'غير نشط',
};

const TYPE_LABELS: Record<TeamMemberType, string> = {
	PROVIDER: 'مقدم خدمة',
	EMPLOYEE: 'موظف',
};

/** Keyword match against the member's real `jobTitle` (no separate specialty field exists). */
const SPEC_KEYWORDS: Record<string, string[]> = {
	design: ['تصميم', 'مصمم', 'UI', 'UX', 'هوية'],
	web: ['ويب', 'web', 'Laravel', 'Vue', 'Node', 'backend', 'frontend'],
	app: ['تطبيق', 'app', 'mobile', 'React Native', 'Flutter'],
	content: ['محتوى', 'كاتب', 'تسويق', 'content'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyForm(): CreateTeamMemberPayload {
	return { name: '', email: '', phone: '', jobTitle: '', memberType: 'PROVIDER', status: 'PENDING' };
}

@Component({
	selector: 'app-company-team-management',
	standalone: true,
	imports: [CommonModule, RouterModule, FormsModule],
	templateUrl: './team-management.component.html',
	styleUrls: ['./team-management.component.css']
})
export class CompanyTeamManagementComponent implements OnInit {
	private teamApi = inject(CompanyTeamService);
	private confirmModal = inject(ConfirmModalService);
	private destroyRef = inject(DestroyRef);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private guard = new SubmitGuard();

	readonly statusLabels = STATUS_LABELS;
	readonly typeLabels = TYPE_LABELS;

	members = signal<CompanyTeamMember[]>([]);
	loading = signal<boolean>(true);
	loadError = signal<string | null>(null);

	activeTab = signal<TeamTab>('providers');
	searchQuery = signal<string>('');
	specFilter = signal<string>('all');

	showForm = signal<boolean>(false);
	saving = signal<boolean>(false);
	formError = signal<string | null>(null);
	form: CreateTeamMemberPayload = emptyForm();
	busyId = signal<string | null>(null);

	specOptions = [
		{ id: 'all', label: 'الكل' },
		{ id: 'design', label: 'تصميم' },
		{ id: 'web', label: 'ويب' },
		{ id: 'app', label: 'تطبيقات' },
		{ id: 'content', label: 'محتوى' },
	];

	counts = computed(() => {
		const list = this.members();
		return {
			providers: list.filter(m => m.memberType === 'PROVIDER' && m.status === 'ACTIVE').length,
			employees: list.filter(m => m.memberType === 'EMPLOYEE' && m.status === 'ACTIVE').length,
			pending: list.filter(m => m.status === 'PENDING').length,
			inactive: list.filter(m => m.status === 'INACTIVE').length,
			totalProviders: list.filter(m => m.memberType === 'PROVIDER').length,
		};
	});

	tabs = computed(() => {
		const c = this.counts();
		return [
			{ id: 'providers' as TeamTab, label: 'مقدمو الخدمات', count: c.providers },
			{ id: 'employees' as TeamTab, label: 'الموظفون', count: c.employees },
			{ id: 'pending' as TeamTab, label: 'دعوات معلقة', count: c.pending },
			{ id: 'inactive' as TeamTab, label: 'غير نشط', count: c.inactive },
		];
	});

	filteredMembers = computed(() => {
		const tab = this.activeTab();
		let list = this.members().filter(m => {
			if (tab === 'providers') return m.memberType === 'PROVIDER' && m.status === 'ACTIVE';
			if (tab === 'employees') return m.memberType === 'EMPLOYEE' && m.status === 'ACTIVE';
			if (tab === 'pending') return m.status === 'PENDING';
			return m.status === 'INACTIVE';
		});
		if (this.specFilter() !== 'all') {
			const keywords = (SPEC_KEYWORDS[this.specFilter()] || []).map(k => k.toLowerCase());
			list = list.filter(m => keywords.some(k => m.jobTitle.toLowerCase().includes(k)));
		}
		const q = this.searchQuery().trim().toLowerCase();
		if (q) {
			list = list.filter(m =>
				m.name.toLowerCase().includes(q) ||
				m.jobTitle.toLowerCase().includes(q) ||
				m.email.toLowerCase().includes(q));
		}
		return list;
	});

	ngOnInit(): void {
		this.loadMembers();
	}

	loadMembers(): void {
		this.loading.set(true);
		this.loadError.set(null);
		this.teamApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: res => {
				this.members.set(res.data ?? []);
				this.loading.set(false);
			},
			error: (err: HttpErrorResponse) => {
				this.loadError.set(err.error?.message || 'تعذر تحميل أعضاء الفريق');
				this.loading.set(false);
			},
		});
	}

	setTab(tab: TeamTab) { this.activeTab.set(tab); }
	setSpec(id: string) { this.specFilter.set(id); }
	onSearch(event: Event) { this.searchQuery.set((event.target as HTMLInputElement).value); }

	initials(name: string): string {
		const parts = name.trim().split(/\s+/).filter(Boolean);
		if (parts.length >= 2) return parts[0][0] + parts[1][0];
		return name.trim().slice(0, 2);
	}

	avatarBg(id: string): string {
		let hash = 0;
		for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
		return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
	}

	toggleForm(): void {
		this.showForm.update(v => !v);
		this.formError.set(null);
		if (!this.showForm()) this.form = emptyForm();
	}

	async submitForm(): Promise<void> {
		if (this.saving() || this.guard.busy) return;
		const payload: CreateTeamMemberPayload = {
			name: this.form.name.trim(),
			email: this.form.email.trim(),
			phone: this.form.phone?.trim() || null,
			jobTitle: this.form.jobTitle.trim(),
			memberType: this.form.memberType,
			status: this.form.status,
		};
		const root = this.host.nativeElement;
		const problems: FieldProblem[] = [];
		if (!payload.name) problems.push({ field: 'tm-name', message: 'الاسم مطلوب', label: 'الاسم' });
		if (!payload.email) problems.push({ field: 'tm-email', message: 'البريد الإلكتروني مطلوب', label: 'البريد الإلكتروني' });
		else if (!EMAIL_RE.test(payload.email)) problems.push({ field: 'tm-email', message: 'البريد الإلكتروني غير صالح، مثال على الصيغة: name@company.com', label: 'البريد الإلكتروني' });
		if (!payload.jobTitle) problems.push({ field: 'tm-jobTitle', message: 'المسمى الوظيفي مطلوب', label: 'المسمى الوظيفي' });
		if (problems.length) {
			// Each message sits under its field; the banner only summarises and never replaces them.
			this.formError.set(problems.length > 1 ? 'أكمل الحقول المحددة بالأحمر ثم احفظ' : null);
			await reportProblems(root, problems);
			return;
		}
		if (!this.guard.enter()) return;
		this.saving.set(true);
		this.formError.set(null);
		this.teamApi.create(payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: res => {
				this.members.update(list => [res.data, ...list]);
				this.saving.set(false);
				this.guard.release();
				this.showForm.set(false);
				this.form = emptyForm();
			},
			error: async (err: HttpErrorResponse) => {
				this.saving.set(false);
				this.guard.release();
				const mapped = mapHttpError(err, { fallback: 'تعذر إضافة عضو الفريق' });
				const gen = genericBanner(mapped);
				if (gen !== null) { this.formError.set(gen); return; }
				const res = await reportBackendError(root, mapped, { resolve: { name: 'tm-name', email: 'tm-email', phone: 'tm-phone', jobTitle: 'tm-jobTitle' } });
				// Network / 429 / 5xx / 403 / 409 (and a 400 naming no field) stay one honest generic message, never a field mark.
				this.formError.set(res.handled && Object.keys(res.unresolved).length === 0 ? null : mapped.message);
			},
		});
	}

	setStatus(member: CompanyTeamMember, status: TeamMemberStatus): void {
		if (this.busyId()) return;
		this.busyId.set(member.id);
		this.teamApi.update(member.id, { status }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: res => {
				this.members.update(list => list.map(m => (m.id === member.id ? res.data : m)));
				this.busyId.set(null);
			},
			error: (err: HttpErrorResponse) => {
				this.busyId.set(null);
				this.confirmModal.notify('تعذر التحديث', err.error?.message || 'تعذر تحديث حالة العضو', 'danger');
			},
		});
	}

	async removeMember(member: CompanyTeamMember): Promise<void> {
		if (this.busyId()) return;
		const ok = await this.confirmModal.confirm({
			title: 'حذف عضو الفريق',
			message: `هل تريد حذف ${member.name} من الفريق نهائيًا؟`,
			type: 'danger',
			confirmText: 'حذف',
			cancelText: 'إلغاء',
		});
		if (!ok) return;
		this.busyId.set(member.id);
		this.teamApi.remove(member.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
			next: () => {
				this.members.update(list => list.filter(m => m.id !== member.id));
				this.busyId.set(null);
			},
			error: (err: HttpErrorResponse) => {
				this.busyId.set(null);
				this.confirmModal.notify('تعذر الحذف', err.error?.message || 'تعذر حذف العضو', 'danger');
			},
		});
	}
}
