import { Component, ElementRef, computed, inject, signal } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { CompanyTeamService } from '../../../../core/services/company-team.service';
import { CompanyTeamMember, TeamMemberStatus, TeamMemberType } from '../../../../core/models/company-team.model';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { mapHttpError } from '../../../../core/forms/http-error';
import { FieldProblem, SubmitGuard, reportBackendError, reportProblems } from '../../../../shared/forms/form-error-focus';
import { genericBanner } from '../../../../shared/forms/submit-feedback';

type MainTab = 'emp' | 'prov' | 'specs' | 'tasks' | 'assign' | 'log';
type ModalId = 'member-form' | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sections whose backend model does not exist yet: shown with an honest empty state, never with static data. */
const UNBACKED_TABS: Partial<Record<MainTab, { title: string; hint: string }>> = {
	specs: { title: 'تخصصات الشركة', hint: 'لا يوجد بعد تخصصات مسجلة على مستوى الشركة' },
	tasks: { title: 'المهام والصلاحيات', hint: 'لا توجد مهام أو صلاحيات مسجلة بعد' },
	assign: { title: 'الإسناد', hint: 'لا توجد إسنادات مسجلة بعد' },
	log: { title: 'السجل والرقابة', hint: 'لا توجد سجلات نشاط بعد' }
};

@Component({
	selector: 'app-provider-hr',
	standalone: true,
	imports: [WsDatePipe, CommonModule, FormsModule, RouterModule],
	templateUrl: './provider-hr.component.html',
	styleUrls: ['./provider-hr.component.css']
})
export class ProviderHrComponent {
	private confirmModal = inject(ConfirmModalService);
	private teamApi = inject(CompanyTeamService);
	private notify = inject(UiNotificationService);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private saveGuard = new SubmitGuard();

	/* ---------------- tabs ---------------- */
	activeTab = signal<MainTab>('emp');
	tabs: { id: MainTab; label: string }[] = [
		{ id: 'emp', label: 'الموظفون الإداريون' },
		{ id: 'prov', label: 'مقدمو الخدمات التابعون' },
		{ id: 'specs', label: 'تخصصات الشركة' },
		{ id: 'tasks', label: 'المهام والصلاحيات' },
		{ id: 'assign', label: 'الإسناد' },
		{ id: 'log', label: 'السجل والرقابة' }
	];
	setTab(tab: MainTab) { this.activeTab.set(tab); }
	unbacked = computed(() => UNBACKED_TABS[this.activeTab()] ?? null);


	/* ---------------- roster (GET /provider/company/team) ---------------- */
	members = signal<CompanyTeamMember[]>([]);
	isLoading = signal(true);
	loadError = signal('');
	busy = signal(false);

	constructor() { this.load(); }

	load() {
		this.isLoading.set(true);
		this.loadError.set('');
		this.teamApi.list().subscribe({
			next: res => { this.members.set(res?.data ?? []); this.isLoading.set(false); },
			error: err => {
				this.isLoading.set(false);
				this.loadError.set(err?.error?.message || 'تعذّر تحميل بيانات الفريق. حاول مرة أخرى');
			}
		});
	}

	employees = computed(() => this.members().filter(m => m.memberType === 'EMPLOYEE'));
	providers = computed(() => this.members().filter(m => m.memberType === 'PROVIDER'));
	activeCount(list: CompanyTeamMember[]): number { return list.filter(m => m.status === 'ACTIVE').length; }
	pendingCount(list: CompanyTeamMember[]): number { return list.filter(m => m.status === 'PENDING').length; }

	statusLabel(m: CompanyTeamMember): string {
		if (m.status === 'ACTIVE') return 'نشط';
		if (m.status === 'PENDING') return 'دعوة معلقة';
		return 'موقوف';
	}
	initials(m: CompanyTeamMember): string {
		const parts = (m.name || '').trim().split(/\s+/).filter(Boolean);
		return parts.slice(0, 2).map(p => p[0]).join('') || '—';
	}

	/* ---------------- filters ---------------- */
	empSearch = signal('');
	empStatusFilter = signal('');
	provSearch = signal('');
	provStatusFilter = signal('');

	private filterList(list: CompanyTeamMember[], q: string, status: string): CompanyTeamMember[] {
		const needle = q.trim().toLowerCase();
		return list.filter(m => {
			if (needle && !m.name.toLowerCase().includes(needle) && !m.email.toLowerCase().includes(needle) && !(m.jobTitle || '').toLowerCase().includes(needle)) return false;
			if (status && this.statusLabel(m) !== status) return false;
			return true;
		});
	}
	filteredEmployees = computed(() => this.filterList(this.employees(), this.empSearch(), this.empStatusFilter()));
	filteredProviders = computed(() => this.filterList(this.providers(), this.provSearch(), this.provStatusFilter()));

	/* ---------------- modal (create / edit) ---------------- */
	activeModal = signal<ModalId>(null);
	editing = signal<CompanyTeamMember | null>(null);
	formType = signal<TeamMemberType>('EMPLOYEE');
	formName = signal('');
	formEmail = signal('');
	formPhone = signal('');
	formJob = signal('');

	openCreate(type: TeamMemberType) {
		this.editing.set(null);
		this.formType.set(type);
		this.formName.set(''); this.formEmail.set(''); this.formPhone.set(''); this.formJob.set('');
		this.activeModal.set('member-form');
	}
	openEdit(m: CompanyTeamMember) {
		this.editing.set(m);
		this.formType.set(m.memberType);
		this.formName.set(m.name); this.formEmail.set(m.email); this.formPhone.set(m.phone ?? ''); this.formJob.set(m.jobTitle ?? '');
		this.activeModal.set('member-form');
	}
	closeModal() { this.activeModal.set(null); }

	private errMsg(err: any, fallback: string): string { return err?.error?.message || fallback; }

	async saveForm() {
		if (this.busy() || this.saveGuard.busy) return;
		const name = this.formName().trim();
		const email = this.formEmail().trim();
		const jobTitle = this.formJob().trim();
		const root = this.host.nativeElement;
		const problems: FieldProblem[] = [];
		if (!name) problems.push({ field: 'hr-name', message: 'الاسم الكامل مطلوب', label: 'الاسم الكامل' });
		if (!jobTitle) problems.push({ field: 'hr-job', message: 'المسمى الوظيفي مطلوب', label: 'المسمى الوظيفي' });
		if (!email) problems.push({ field: 'hr-email', message: 'البريد الإلكتروني مطلوب', label: 'البريد الإلكتروني' });
		else if (!EMAIL_RE.test(email)) problems.push({ field: 'hr-email', message: 'البريد الإلكتروني غير صالح، مثال على الصيغة: name@company.com', label: 'البريد الإلكتروني' });
		if (problems.length) {
			// The explanation sits at each field (the modal stays open with what was typed); no toast-only warning.
			await reportProblems(root, problems);
			return;
		}
		if (!this.saveGuard.enter()) return;
		const phone = this.formPhone().trim() || null;
		const target = this.editing();
		this.busy.set(true);
		const req$ = target
			? this.teamApi.update(target.id, { name, email, phone, jobTitle })
			: this.teamApi.create({ name, email, phone, jobTitle, memberType: this.formType(), status: 'PENDING' });
		req$.subscribe({
			next: res => {
				this.busy.set(false);
				this.saveGuard.release();
				const saved = res?.data;
				if (saved) this.members.update(list => target ? list.map(m => m.id === saved.id ? saved : m) : [...list, saved]);
				this.closeModal();
				this.notify.success(target ? 'تم حفظ التعديلات' : 'تمت إضافة العضو إلى الفريق');
			},
			error: async err => {
				this.busy.set(false);
				this.saveGuard.release();
				const mapped = mapHttpError(err, { fallback: 'تعذّر حفظ البيانات. حاول مرة أخرى' });
				const gen = genericBanner(mapped);
				if (gen !== null) { this.notify.error(gen); return; }
				const res = await reportBackendError(root, mapped, { resolve: { name: 'hr-name', email: 'hr-email', phone: 'hr-phone', jobTitle: 'hr-job' } });
				// Network / 429 / 5xx / 403 / 409 (and a 400 naming no field) stay one honest generic message, never a field mark.
				if (!res.handled || Object.keys(res.unresolved).length) this.notify.error(mapped.message);
			}
		});
	}

	private setStatus(m: CompanyTeamMember, status: TeamMemberStatus, okMsg: string) {
		this.busy.set(true);
		this.teamApi.update(m.id, { status }).subscribe({
			next: res => {
				this.busy.set(false);
				const saved = res?.data;
				if (saved) this.members.update(list => list.map(x => x.id === saved.id ? saved : x));
				this.notify.success(okMsg);
			},
			error: err => { this.busy.set(false); this.notify.error(this.errMsg(err, 'تعذّر تحديث الحالة. حاول مرة أخرى')); }
		});
	}

	async pauseOrResume(m: CompanyTeamMember) {
		if (m.status === 'INACTIVE') { this.setStatus(m, 'ACTIVE', `تم تفعيل ${m.name}`); return; }
		const ok = await this.confirmModal.confirm({ title: 'إيقاف مؤقت', message: `هل أنت متأكد من إيقاف ${m.name} مؤقتاً؟`, type: 'warning' });
		if (ok) this.setStatus(m, 'INACTIVE', `تم إيقاف ${m.name} مؤقتاً`);
	}

	async remove(m: CompanyTeamMember, title = 'حذف') {
		const ok = await this.confirmModal.confirm({ title, message: `هل أنت متأكد من ${title === 'إلغاء دعوة' ? 'إلغاء دعوة' : 'حذف'} ${m.name}؟`, type: 'danger' });
		if (!ok) return;
		this.busy.set(true);
		this.teamApi.remove(m.id).subscribe({
			next: () => { this.busy.set(false); this.members.update(list => list.filter(x => x.id !== m.id)); this.notify.success(`تم حذف ${m.name}`); },
			error: err => { this.busy.set(false); this.notify.error(this.errMsg(err, 'تعذّر الحذف. حاول مرة أخرى')); }
		});
	}
	cancelInvite(m: CompanyTeamMember) { return this.remove(m, 'إلغاء دعوة'); }
}
