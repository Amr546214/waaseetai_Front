import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Ticket {
	id: string;
	title: string;
	category: string;
	timestamp: string;
	status: 'review' | 'wait' | 'ai' | 'open' | 'solved' | 'closed';
	statusLabel: string;
	icon: 'escrow' | 'wallet' | 'ai' | 'list' | 'check' | 'doc';
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
				<p class="text-xs text-[var(--txt-3)]">طلبات دعم متتبَّعة برقم وحالة، يصنّفها الذكاء ويتابعها الفريق المختص</p>
			</div>
			<a routerLink="/client-overview/help/tickets/new"
				class="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-[#2BD4C7] to-[#2B7FFF] rounded-full text-[#070D24] font-extrabold text-[13px] no-underline hover:opacity-90 transition-opacity">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
				</svg>
				فتح تذكرة
			</a>
		</div>

		<!-- AI Disclosure -->
		<div class="flex items-center gap-3 p-3.5 bg-gradient-to-br from-[rgba(123,47,190,.09)] to-[rgba(43,127,255,.06)] backdrop-blur-md border border-[rgba(123,47,190,.22)] rounded-2xl mb-5">
			<div class="w-[30px] h-[30px] rounded-lg bg-[rgba(123,47,190,.16)] flex items-center justify-center shrink-0 text-[var(--ai-txt,#7B2FBE)]">
				<svg class="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="12" cy="12" r="2" /><circle cx="4" cy="6" r="1.5" /><circle cx="20" cy="6" r="1.5" />
					<circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="18" r="1.5" /><circle cx="12" cy="3" r="1.5" />
					<circle cx="12" cy="21" r="1.5" />
					<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5" />
				</svg>
			</div>
			<div class="flex-1">
				<div class="text-[10px] font-extrabold text-[var(--ai-txt,#A56BE0)] tracking-wider mb-0.5">وسيط AI، فرز التذاكر</div>
				<p class="text-[13px] text-[var(--txt-2,#A8B2D1)]">يصنّف الذكاء كل تذكرة حسب موضوعها ويوجّهها للقسم المختص ويقترح حلولًا فورية <span class="bg-[rgba(123,47,190,.16)] border border-[rgba(123,47,190,.28)] rounded px-1.5 py-px text-[10px] font-bold text-[var(--ai-txt,#A56BE0)]">دقة 95%</span> القرار في الحالات الحسّاسة لفريق الدعم البشري</p>
			</div>
		</div>

		<!-- Stats -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--blue-txt,#5DA0FF)]">2</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">مفتوحة وقيد المعالجة</div>
			</div>
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--kahr,#D98A0B)]">1</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">بانتظار ردّك</div>
			</div>
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--green,#0FA99A)]">2</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">محلولة</div>
			</div>
			<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 text-center">
				<div class="text-2xl font-black text-[var(--txt)]">4س</div>
				<div class="text-[11px] text-[var(--txt-3)] font-bold mt-1">متوسط زمن الرد</div>
			</div>
		</div>

		<!-- Filter chips -->
		<div class="flex flex-wrap gap-2 mb-5">
			<button *ngFor="let f of filters" type="button"
				(click)="setFilter(f.key)"
				[class]="filter() === f.key ? 'filter-chip active' : 'filter-chip'">
				{{ f.label }}<span class="fc-count">{{ f.count }}</span>
			</button>
		</div>

		<!-- Tickets list -->
		<div>
			<a *ngFor="let t of filteredTickets()" [routerLink]="['/client-overview/help/tickets', t.id]" class="tk-card">
				<div class="tk-ico" [class.ai]="t.icon === 'ai'" [class.b]="t.icon === 'wallet' || t.icon === 'list' || t.icon === 'doc'">
					<svg class="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<ng-container [ngSwitch]="t.icon">
							<rect *ngSwitchCase="'escrow'" x="3" y="11" width="18" height="11" rx="2" /><path *ngSwitchCase="'escrow'" d="M7 11V7a5 5 0 0 1 10 0v4" /><circle *ngSwitchCase="'escrow'" cx="12" cy="17" r="1.5" fill="currentColor" />
							<path *ngSwitchCase="'wallet'" d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><circle *ngSwitchCase="'wallet'" cx="16" cy="14" r="1.5" fill="currentColor" />
							<circle *ngSwitchCase="'ai'" cx="12" cy="12" r="2" /><circle *ngSwitchCase="'ai'" cx="4" cy="6" r="1.5" /><circle *ngSwitchCase="'ai'" cx="20" cy="6" r="1.5" /><circle *ngSwitchCase="'ai'" cx="4" cy="18" r="1.5" /><circle *ngSwitchCase="'ai'" cx="20" cy="18" r="1.5" /><circle *ngSwitchCase="'ai'" cx="12" cy="3" r="1.5" /><circle *ngSwitchCase="'ai'" cx="12" cy="21" r="1.5" /><path *ngSwitchCase="'ai'" d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5" />
							<ng-container *ngSwitchCase="'list'"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></ng-container>
							<polyline *ngSwitchCase="'check'" points="20 6 9 17 4 12" />
							<path *ngSwitchCase="'doc'" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline *ngSwitchCase="'doc'" points="14 2 14 8 20 8" />
						</ng-container>
					</svg>
				</div>
				<div class="tk-body">
					<div class="tk-ttl">{{ t.title }}</div>
					<div class="tk-meta">
						<span class="tk-id">{{ t.id }}</span>
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

		<div *ngIf="filteredTickets().length === 0" class="text-center p-10 bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl">
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
		:host-context([data-theme='light']) .tk-card,
		:host-context(body.light) .tk-card,
		:host-context(.light-theme) .tk-card,
		:host-context(.theme-light) .tk-card { background: #fff; border-color: #E7EAF1; }
		:host-context([data-theme='light']) .tk-card:hover,
		:host-context(body.light) .tk-card:hover,
		:host-context(.light-theme) .tk-card:hover,
		:host-context(.theme-light) .tk-card:hover { border-color: rgba(43,212,199,.30); }

		.tk-ico { width: 38px; height: 38px; border-radius: 10px; background: rgba(43,127,255,.10); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--blue-txt,#5DA0FF); }
		.tk-ico.ai { background: rgba(123,47,190,.12); color: var(--ai-txt,#A56BE0); }
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
		.tks-ai { background: rgba(123,47,190,.12); color: var(--ai-txt,#A56BE0); border: 1px solid rgba(123,47,190,.26); }
		.tks-ai::before { background: #A56BE0; }
		.tks-open { background: rgba(43,127,255,.10); color: var(--blue-txt,#5DA0FF); border: 1px solid rgba(43,127,255,.26); }
		.tks-open::before { background: var(--blue-txt,#5DA0FF); }
		.tks-solved { background: rgba(15,169,154,.10); color: var(--green,#0FA99A); border: 1px solid rgba(15,169,154,.24); }
		.tks-solved::before { background: var(--green,#0FA99A); }
		.tks-closed { background: rgba(255,255,255,.04); color: var(--txt-3,#6B7699); border: 1px solid rgba(255,255,255,.10); }
		.tks-closed::before { background: var(--txt-3,#6B7699); }

		:host-context([data-theme='light']) .filter-chip,
		:host-context(body.light) .filter-chip,
		:host-context(.light-theme) .filter-chip,
		:host-context(.theme-light) .filter-chip { background: #F3F5FA; border-color: #D8DFEC; color: #475569; }
		:host-context([data-theme='light']) .filter-chip:hover,
		:host-context(body.light) .filter-chip:hover,
		:host-context(.light-theme) .filter-chip:hover,
		:host-context(.theme-light) .filter-chip:hover { background: #E6FDFB; border-color: #A3ECE5; color: #0A6F64; }
		:host-context([data-theme='light']) .filter-chip.active,
		:host-context(body.light) .filter-chip.active,
		:host-context(.light-theme) .filter-chip.active,
		:host-context(.theme-light) .filter-chip.active { background: rgba(43,212,199,.15); border-color: rgba(43,212,199,.40); color: #0F172A; }
		:host-context([data-theme='light']) .fc-count,
		:host-context(body.light) .fc-count,
		:host-context(.light-theme) .fc-count,
		:host-context(.theme-light) .fc-count { background: #E7EAF1; color: #64748B; }
		:host-context([data-theme='light']) .filter-chip.active .fc-count,
		:host-context(body.light) .filter-chip.active .fc-count,
		:host-context(.light-theme) .filter-chip.active .fc-count,
		:host-context(.theme-light) .filter-chip.active .fc-count { background: rgba(43,212,199,.25); color: #0F172A; }
	`],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketsComponent {
	filter = signal<string>('all');

	filters = [
		{ key: 'all', label: 'الكل', count: 6 },
		{ key: 'open', label: 'مفتوحة', count: 1 },
		{ key: 'review', label: 'قيد المراجعة', count: 2 },
		{ key: 'wait', label: 'بانتظار ردّك', count: 1 },
		{ key: 'solved', label: 'محلولة', count: 1 },
		{ key: 'closed', label: 'مغلقة', count: 1 }
	];

	tickets: Ticket[] = [
		{ id: 'TK-4821', title: 'تأخر الإفراج عن مبلغ الضمان', category: 'العقود والضمان', timestamp: 'قبل ساعتين', status: 'review', statusLabel: 'لدى فريق الدعم', icon: 'escrow' },
		{ id: 'TK-4815', title: 'توضيح مطلوب لإكمال طلب الاسترداد', category: 'المدفوعات', timestamp: 'أمس', status: 'wait', statusLabel: 'بانتظار ردّك', icon: 'wallet' },
		{ id: 'TK-4805', title: 'استفسار عن طريقة احتساب الكاش باك', category: 'المدفوعات', timestamp: 'أمس', status: 'ai', statusLabel: 'يعالجها المساعد الذكي', icon: 'ai' },
		{ id: 'TK-4799', title: 'طلب تعديل وصف الطلب قبل العرض', category: 'الطلبات', timestamp: 'اليوم', status: 'open', statusLabel: 'مفتوحة', icon: 'list' },
		{ id: 'TK-4790', title: 'تعذّر رفع ملف في الطلب', category: 'الطلبات', timestamp: 'حُلَّت قبل 3 أيام', status: 'solved', statusLabel: 'محلولة', icon: 'check' },
		{ id: 'TK-4772', title: 'استفسار عن فاتورة رسمية', category: 'الفواتير', timestamp: 'مغلقة قبل أسبوع', status: 'closed', statusLabel: 'مغلقة', icon: 'doc' }
	];

	filteredTickets() {
		const f = this.filter();
		if (f === 'all') return this.tickets;
		return this.tickets.filter(t => {
			if (f === 'review') return t.status === 'review' || t.status === 'ai';
			return t.status === f;
		});
	}

	setFilter(key: string) {
		this.filter.set(key);
	}

	statusClass(status: string): string {
		return `tks-${status}`;
	}
}
