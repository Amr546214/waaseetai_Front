import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TicketApiService, SupportTicket } from '../../../../../core/services/ticket-api.service';

interface Ticket {
	id: string;
	code: string;
	title: string;
	category: string;
	timestamp: string;
	status: 'review' | 'wait' | 'open' | 'solved' | 'closed';
	statusLabel: string;
	icon: 'check' | 'doc' | 'list';
}

function formatRelative(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return 'الآن';
	if (mins < 60) return `قبل ${mins} دقيقة`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `قبل ${hours} ساعة`;
	const days = Math.floor(hours / 24);
	if (days === 1) return 'أمس';
	if (days < 7) return `قبل ${days} أيام`;
	return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function mapTicket(t: SupportTicket): Ticket {
	const map: Record<SupportTicket['status'], { status: Ticket['status']; label: string; icon: Ticket['icon'] }> = {
		OPEN: { status: 'open', label: 'مفتوحة', icon: 'list' },
		IN_PROGRESS: { status: 'review', label: 'قيد المراجعة', icon: 'list' },
		AWAITING_CUSTOMER: { status: 'wait', label: 'بانتظار ردّك', icon: 'list' },
		RESOLVED: { status: 'solved', label: 'محلولة', icon: 'check' },
		CLOSED: { status: 'closed', label: 'مغلقة', icon: 'doc' },
	};
	const m = map[t.status];
	return {
		id: t.id,
		code: t.ticketNumber,
		title: t.subject,
		category: t.category,
		timestamp: formatRelative(t.createdAt),
		status: m.status,
		statusLabel: m.label,
		icon: m.icon,
	};
}

@Component({
	selector: 'app-client-tickets',
	standalone: true,
	imports: [CommonModule, RouterModule],
	template: `
	<div class="w-full relative z-10 pb-10">
		<!-- Header -->
		<div class="flex items-start justify-between gap-3 flex-wrap mb-4">
			<div>
				<h1 class="text-xl font-black text-[var(--txt)] mb-1">تذاكر الدعم</h1>
				<p class="text-xs text-[var(--txt-3)]">طلبات دعم متتبَّعة برقم وحالة، يتابعها فريق الدعم</p>
			</div>
			<a routerLink="/client-overview/help/tickets/new"
				class="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2BD4C7] to-[#2B7FFF] rounded-full text-[#070D24] font-extrabold text-[13px] no-underline hover:opacity-90 transition-opacity">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				فتح تذكرة
			</a>
		</div>

		<!-- Stats -->
		<div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--blue-txt,#5DA0FF)]">{{ stats().openCount }}</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">مفتوحة وقيد المعالجة</div>
			</div>
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--kahr,#D98A0B)]">{{ stats().waitCount }}</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">بانتظار ردّك</div>
			</div>
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--green,#0FA99A)]">{{ stats().solvedCount }}</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">محلولة</div>
			</div>
		</div>

		<!-- Filter chips -->
		<div class="flex flex-wrap gap-2 mb-5">
			<button *ngFor="let f of filters()" type="button"
				(click)="setFilter(f.key)"
				[class]="filter() === f.key ? 'filter-chip active' : 'filter-chip'">
				{{ f.label }}<span class="fc-count">{{ f.count }}</span>
			</button>
		</div>

		<!-- Tickets list -->
		<div *ngIf="!isLoading()">
			<a *ngFor="let t of filteredTickets()" [routerLink]="['/client-overview/help/tickets', t.id]" class="tk-card">
				<div class="tk-ico" [class.b]="t.icon === 'doc'">
					<svg class="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<ng-container [ngSwitch]="t.icon">
							<ng-container *ngSwitchCase="'list'"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></ng-container>
							<polyline *ngSwitchCase="'check'" points="20 6 9 17 4 12" />
							<path *ngSwitchCase="'doc'" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline *ngSwitchCase="'doc'" points="14 2 14 8 20 8" />
						</ng-container>
					</svg>
				</div>
				<div class="tk-body">
					<div class="tk-ttl">{{ t.title }}</div>
					<div class="tk-meta">
						<span class="tk-id">{{ t.code }}</span>
						<span class="dot"></span>
						<span>{{ t.category }}</span>
						<span class="dot"></span>
						<span>{{ t.timestamp }}</span>
					</div>
				</div>
				<span class="tk-status" [class]="statusClass(t.status)">
					<span class="dot"></span>{{ t.statusLabel }}
				</span>
			</a>
		</div>

		<div *ngIf="isLoading()" class="text-center p-10 bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl">
			<div class="text-xs text-[var(--txt-3)]">جارٍ التحميل...</div>
		</div>

		<div *ngIf="!isLoading() && hasError()" class="text-center p-10 bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl">
			<div class="text-base font-extrabold text-[var(--txt)] mb-1.5">تعذر تحميل التذاكر</div>
			<div class="text-xs text-[var(--txt-3)]">حاول تحديث الصفحة أو المحاولة لاحقًا</div>
		</div>

		<div *ngIf="!isLoading() && !hasError() && filteredTickets().length === 0" class="text-center p-10 bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl">
			<div class="text-base font-extrabold text-[var(--txt)] mb-1.5">لا توجد تذاكر في هذه الحالة</div>
			<div class="text-xs text-[var(--txt-3)]">غيّر التصفية، أو افتح تذكرة جديدة ليتولّاها الفريق المختص</div>
		</div>
	</div>
	`,
	styles: [`
		:host { display: block; width: 100%; animation: ws-fade 0.2s ease forwards; }
		@keyframes ws-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

		.filter-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.10); border-radius: 20px; font-size: 12px; font-weight: 700; color: var(--txt-2,#A8B2D1); cursor: pointer; font-family: inherit; transition: all .15s; }
		.filter-chip:hover { background: rgba(43,212,199,.08); border-color: rgba(43,212,199,.22); color: var(--teal-txt,#2BD4C7); }
		.filter-chip.active { background: rgba(43,212,199,.14); border-color: rgba(43,212,199,.30); color: var(--teal-txt,#2BD4C7); }
		.fc-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 5px; background: rgba(255,255,255,.08); border-radius: 10px; font-size: 10px; font-weight: 800; }
		.filter-chip.active .fc-count { background: rgba(43,212,199,.20); color: var(--teal-txt,#2BD4C7); }

		.tk-card { display: flex; align-items: center; gap: 14px; background: linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01)); border: 1px solid rgba(255,255,255,.08); border-radius: 13px; padding: 15px 18px; margin-bottom: 10px; transition: border-color .15s; cursor: pointer; text-decoration: none; }
		.tk-card:hover { border-color: rgba(43,212,199,.18); }
		:host-context(body.light-theme) .tk-card,
		:host-context(body.theme-light) .tk-card,
		:host-context(.light-theme) .tk-card,
		:host-context(.theme-light) .tk-card { background: #fff; border-color: #E7EAF1; }
		:host-context(body.light-theme) .tk-card:hover,
		:host-context(body.theme-light) .tk-card:hover,
		:host-context(.light-theme) .tk-card:hover,
		:host-context(.theme-light) .tk-card:hover { border-color: rgba(43,212,199,.30); }

		.tk-ico { width: 38px; height: 38px; border-radius: 10px; background: rgba(43,127,255,.10); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--blue-txt,#5DA0FF); }
		.tk-ico.b { background: rgba(43,212,199,.10); color: var(--teal-txt,#2BD4C7); }

		.tk-body { flex: 1; min-width: 0; }
		.tk-ttl { font-size: 13.5px; font-weight: 800; color: var(--txt,#fff); margin-bottom: 3px; }
		.tk-meta { font-size: 11px; color: var(--txt-3,#6B7699); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
		.tk-meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--txt-3,#4A5568); }
		.tk-id { direction: ltr; font-style: italic; }

		.tk-status { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; flex-shrink: 0; white-space: nowrap; }
		.tk-status::before { content: ''; width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
		.tk-status .dot { display: none; }
		.tks-review { background: rgba(255,180,0,.10); color: var(--kahr,#D98A0B); border: 1px solid rgba(255,180,0,.26); }
		.tks-review::before { background: #FFB400; }
		.tks-wait { background: rgba(255,255,255,.05); color: var(--txt-2,#A8B2D1); border: 1px solid rgba(255,255,255,.12); }
		.tks-wait::before { background: var(--txt-3,#6B7699); }
		.tks-open { background: rgba(43,127,255,.10); color: var(--blue-txt,#5DA0FF); border: 1px solid rgba(43,127,255,.26); }
		.tks-open::before { background: var(--blue-txt,#5DA0FF); }
		.tks-solved { background: rgba(15,169,154,.10); color: var(--green,#0FA99A); border: 1px solid rgba(15,169,154,.24); }
		.tks-solved::before { background: var(--green,#0FA99A); }
		.tks-closed { background: rgba(255,255,255,.04); color: var(--txt-3,#6B7699); border: 1px solid rgba(255,255,255,.10); }
		.tks-closed::before { background: var(--txt-3,#6B7699); }

		:host-context(body.light-theme) .filter-chip,
		:host-context(body.theme-light) .filter-chip,
		:host-context(.light-theme) .filter-chip,
		:host-context(.theme-light) .filter-chip { background: #F3F5FA; border-color: #D8DFEC; color: #475569; }
		:host-context(body.light-theme) .filter-chip:hover,
		:host-context(body.theme-light) .filter-chip:hover,
		:host-context(.light-theme) .filter-chip:hover,
		:host-context(.theme-light) .filter-chip:hover { background: #E6FDFB; border-color: #A3ECE5; color: #0A6F64; }
		:host-context(body.light-theme) .filter-chip.active,
		:host-context(body.theme-light) .filter-chip.active,
		:host-context(.light-theme) .filter-chip.active,
		:host-context(.theme-light) .filter-chip.active { background: rgba(43,212,199,.15); border-color: rgba(43,212,199,.40); color: #0F172A; }
		:host-context(body.light-theme) .fc-count,
		:host-context(body.theme-light) .fc-count,
		:host-context(.light-theme) .fc-count,
		:host-context(.theme-light) .fc-count { background: #E7EAF1; color: #64748B; }
		:host-context(body.light-theme) .filter-chip.active .fc-count,
		:host-context(body.theme-light) .filter-chip.active .fc-count,
		:host-context(.light-theme) .filter-chip.active .fc-count,
		:host-context(.theme-light) .filter-chip.active .fc-count { background: rgba(43,212,199,.25); color: #0F172A; }
	`],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketsComponent implements OnInit {
	private ticketApi = inject(TicketApiService);

	filter = signal<string>('all');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);

	tickets = signal<Ticket[]>([]);

	filters = computed(() => {
		const all = this.tickets();
		const count = (pred: (t: Ticket) => boolean) => all.filter(pred).length;
		return [
			{ key: 'all', label: 'الكل', count: all.length },
			{ key: 'open', label: 'مفتوحة', count: count(x => x.status === 'open') },
			{ key: 'review', label: 'قيد المراجعة', count: count(x => x.status === 'review') },
			{ key: 'wait', label: 'بانتظار ردّك', count: count(x => x.status === 'wait') },
			{ key: 'solved', label: 'محلولة', count: count(x => x.status === 'solved') },
			{ key: 'closed', label: 'مغلقة', count: count(x => x.status === 'closed') }
		];
	});

	ngOnInit() {
		this.loadTickets();
	}

	loadTickets() {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.ticketApi.listTickets('client').subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success) {
					this.tickets.set((res.data?.items || []).map(mapTicket));
				} else {
					this.hasError.set(true);
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	filteredTickets = computed(() => {
		const f = this.filter();
		const all = this.tickets();
		if (f === 'all') return all;
		return all.filter(t => t.status === f);
	});

	setFilter(key: string) {
		this.filter.set(key);
	}

	stats = computed(() => {
		const all = this.tickets();
		return {
			openCount: all.filter(t => t.status === 'open' || t.status === 'review').length,
			waitCount: all.filter(t => t.status === 'wait').length,
			solvedCount: all.filter(t => t.status === 'solved').length,
		};
	});

	statusClass(status: string): string {
		return `tks-${status}`;
	}
}
