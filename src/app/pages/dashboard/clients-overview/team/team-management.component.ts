import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ClientCompanyTeamService } from '../../../../core/services/client-company-team.service';
import { ClientCompanyTeamMember } from '../../../../core/models/client-company-team.model';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

// Batch 6 — this page used to render 4 fully hardcoded arrays (employees,
// roles, groups, tasks) with zero backend behind any of them (not even a
// shared mock file — each was a private literal in this component). The
// roster (Employees) is now wired to a REAL backend (client-company-team.
// service, reusing the same CompanyTeamMember table the PROVIDER_COMPANY
// roster already uses — Batch 6 investigation found no schema change was
// needed for this part).
//
// Roles/Groups/Tasks were REMOVED outright for launch (approved product
// decision) rather than left as permanent "backend required" placeholders
// in market-facing UI: no Role/Group/Task model exists anywhere in the
// schema (confirmed via full Prisma schema search), Roles specifically
// conflicts with the already-decided "employees have no WaseetAI login"
// architecture (a real RBAC system presupposes employees who can log in and
// act), and Tasks duplicated data already real elsewhere (CompanyDashboard
// Data's pendingApprovals[]/recentTeamRequests[]). This page is now a single
// real employee roster, not a tabbed shell.
@Component({
	selector: 'app-team-management',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './team-management.component.html',
	styleUrls: ['./team-management.component.css']
})
export class TeamManagementComponent implements OnInit {
	private teamService = inject(ClientCompanyTeamService);
	private authStore = inject(AuthStore);

	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	employees = signal<ClientCompanyTeamMember[]>([]);
	isLoading = signal<boolean>(true);
	loadError = signal<string>('');

	// Only real, backend-derived stats — the mock page also claimed "مهام
	// نشطة"/"مجموعات عمل" (active tasks / work groups), which have no
	// backing model at all (see Roles/Groups/Tasks tabs below) and were
	// dropped rather than shown as a fabricated/always-zero tile.
	totalEmployees = computed(() => this.employees().length);
	activeEmployees = computed(() => this.employees().filter(e => e.status === 'ACTIVE').length);

	// Invite-employee inline form state
	showInviteForm = signal<boolean>(false);
	inviteName = '';
	inviteEmail = '';
	invitePhone = '';
	inviteJobTitle = '';
	isSubmittingInvite = signal<boolean>(false);
	inviteError = signal<string>('');

	// Per-row busy state so a slow status/edit request can't be double-fired
	busyMemberId = signal<string | null>(null);

	ngOnInit(): void {
		if (!this.isCompany()) {
			this.isLoading.set(false);
			return;
		}
		this.fetchEmployees();
	}

	fetchEmployees(): void {
		this.isLoading.set(true);
		this.loadError.set('');
		this.teamService.list().subscribe({
			next: (res) => {
				this.employees.set(res?.data || []);
				this.isLoading.set(false);
			},
			error: () => {
				this.loadError.set('تعذر تحميل بيانات الموظفين. حاول مرة أخرى.');
				this.isLoading.set(false);
			}
		});
	}

	statusLabel(s: ClientCompanyTeamMember['status']): string {
		return s === 'ACTIVE' ? 'نشط' : s === 'PENDING' ? 'بانتظار القبول' : 'موقوف';
	}

	initials(name: string): string {
		return name.split(' ').map(p => p[0] || '').join('').substring(0, 2) || 'م';
	}

	openInviteForm(): void {
		this.inviteName = '';
		this.inviteEmail = '';
		this.invitePhone = '';
		this.inviteJobTitle = '';
		this.inviteError.set('');
		this.showInviteForm.set(true);
	}

	cancelInvite(): void {
		this.showInviteForm.set(false);
	}

	submitInvite(): void {
		if (!this.inviteName.trim() || !this.inviteEmail.trim() || !this.inviteJobTitle.trim()) {
			this.inviteError.set('الاسم والبريد الإلكتروني والمسمى الوظيفي مطلوبة');
			return;
		}
		this.isSubmittingInvite.set(true);
		this.inviteError.set('');
		this.teamService.create({
			name: this.inviteName.trim(),
			email: this.inviteEmail.trim(),
			phone: this.invitePhone.trim() || null,
			jobTitle: this.inviteJobTitle.trim(),
		}).subscribe({
			next: (res) => {
				this.isSubmittingInvite.set(false);
				this.showInviteForm.set(false);
				if (res?.data) {
					this.employees.update(list => [res.data as ClientCompanyTeamMember, ...list]);
				} else {
					// Never show a fake-success state without the real created
					// record — refetch from the backend instead.
					this.fetchEmployees();
				}
			},
			error: (err) => {
				this.isSubmittingInvite.set(false);
				this.inviteError.set(err?.error?.message || 'تعذر دعوة الموظف. حاول مرة أخرى.');
			}
		});
	}

	toggleStatus(emp: ClientCompanyTeamMember): void {
		const nextStatus = emp.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
		this.busyMemberId.set(emp.id);
		this.teamService.update(emp.id, { status: nextStatus }).subscribe({
			next: (res) => {
				this.busyMemberId.set(null);
				if (res?.data) {
					this.employees.update(list => list.map(e => e.id === emp.id ? res.data as ClientCompanyTeamMember : e));
				} else {
					this.fetchEmployees();
				}
			},
			error: () => {
				this.busyMemberId.set(null);
				// Failed mutation — never flip the UI state optimistically; the
				// signal above was never touched, so the card still shows the
				// real (unchanged) status.
			}
		});
	}
}
