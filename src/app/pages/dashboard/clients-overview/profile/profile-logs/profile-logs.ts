import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccountLogsService, AccountAuditLog } from '../../../../../core/services/account-logs.service';

export interface RequestLog {
  id: string;
  type: string;
  title: string;
  date: string;
  status: 'pending' | 'review' | 'approved' | 'rejected' | 'completed';
  statusText: string;
  statusHint?: string;
  actionText?: string;
  actionLink?: string;
  iconBg: string;
  iconColor: string;
  iconSvg: string;
}

@Component({
	selector: 'app-profile-logs',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './profile-logs.html',
	styles: [`
    @keyframes ws-fade {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes skel-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .state-card {
      background: var(--crd-bg, linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,.01)));
      backdrop-filter: blur(12px);
      border: 1px solid var(--sec-bd, rgba(255,255,255,.08));
      border-radius: 16px;
      padding: 24px;
    }
    .active-tab {
      color: var(--teal-txt, #2BD4C7) !important;
      border-bottom-color: var(--teal-txt, #2BD4C7) !important;
    }
    :host-context([data-theme='light']) .active-tab {
      color: #0F8A7F !important;
      border-bottom-color: #0F8A7F !important;
    }
    :host-context([data-theme='light']) .req-card:hover {
      border-color: rgba(43, 212, 199, 0.4) !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileLogs implements OnInit {
	private accountLogsService = inject(AccountLogsService);

	activeTab = signal<'add' | 'complete' | 'security'>('add');
	state = signal<'loading' | 'error' | 'default'>('loading');
	showToast = signal(false);

	addRequests = signal<RequestLog[]>([]);
	completeRequests = signal<RequestLog[]>([]);
	securityRequests = signal<RequestLog[]>([]);

	ngOnInit() {
		this.accountLogsService.getUserLogs().subscribe({
			next: (res) => {
				if (res?.success) {
					const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
					this.mapLogsToState(items);
					this.state.set('default');
				} else {
					this.state.set('error');
				}
			},
			error: (err) => {
				console.error(err);
				this.state.set('error');
			}
		});
	}

	private mapLogsToState(logs: AccountAuditLog[]) {
		const addReqs: RequestLog[] = [];
		const compReqs: RequestLog[] = [];
		const secReqs: RequestLog[] = [];

		if (!Array.isArray(logs)) {
			this.addRequests.set([]);
			this.completeRequests.set([]);
			this.securityRequests.set([]);
			return;
		}

		logs.forEach(log => {
			let uiStatus: RequestLog['status'] = 'review';
			if (log.status === 'APPROVED') uiStatus = 'approved';
			if (log.status === 'REJECTED') uiStatus = 'rejected';
			if (log.status === 'COMPLETED') uiStatus = 'completed';

			let iconBg = 'rgba(43,127,255,.12)';
			let iconColor = '#5DA0FF';
			let iconSvg = '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>';

			if (log.category === 'SECURITY_CHANGE') {
				iconBg = 'rgba(43,212,199,.12)';
				iconColor = '#2BD4C7';
				iconSvg = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
			} else if (uiStatus === 'approved' || uiStatus === 'completed') {
				iconBg = 'rgba(43,212,199,.08)';
				iconColor = '#2BD4C7';
				iconSvg = '<circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>';
			} else if (uiStatus === 'rejected') {
				iconBg = 'rgba(255,140,105,.10)';
				iconColor = '#FF8C69';
				iconSvg = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
			}

			const formattedLog: RequestLog = {
				id: log.id,
				type: log.title || 'إجراء في الحساب',
				title: log.summary || log.actionText || 'تفاصيل العملية',
				date: new Date(log.occurredAt || log.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
				status: uiStatus,
				statusText: log.statusText || (log.category === 'SECURITY_CHANGE' ? 'مكتمل بنجاح' : (uiStatus === 'review' ? 'قيد المراجعة' : uiStatus)),
				statusHint: log.canResubmit ? 'يمكنك التعديل وإعادة التقديم' : undefined,
				actionText: log.canResubmit ? 'إعادة التقديم' : (uiStatus === 'approved' || uiStatus === 'completed' ? 'عرض التفاصيل' : undefined),
				actionLink: '#',
				iconBg,
				iconColor,
				iconSvg
			};

			if (log.category === 'ROLE_ADDITION') {
				addReqs.push(formattedLog);
			} else if (log.category === 'PROFILE_COMPLETION') {
				compReqs.push(formattedLog);
			} else if (log.category === 'SECURITY_CHANGE' || log.category === 'SYSTEM_AUDIT') {
				secReqs.push(formattedLog);
			}
		});

		this.addRequests.set(addReqs);
		this.completeRequests.set(compReqs);
		this.securityRequests.set(secReqs);

		// If addRequests is empty but security has items, switch to security tab automatically
		if (addReqs.length === 0 && compReqs.length === 0 && secReqs.length > 0) {
			this.activeTab.set('security');
		}
	}

	setTab(tab: 'add' | 'complete' | 'security') {
		this.activeTab.set(tab);
	}

	triggerToast() {
		this.showToast.set(true);
		setTimeout(() => this.showToast.set(false), 3000);
	}
}
