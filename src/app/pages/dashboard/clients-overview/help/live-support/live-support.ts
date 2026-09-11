import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-client-live-support',
	standalone: true,
	imports: [CommonModule, RouterModule],
	template: `
	<div class="w-full relative z-10 pb-10">
		<!-- Header -->
		<div class="mb-4">
			<h1 class="text-xl font-black text-[var(--txt)] mb-1">الدعم المباشر</h1>
			<p class="text-xs text-[var(--txt-3)]">شات مباشر مع موظف دعم بشري · الرد خلال دقائق</p>
		</div>

		<!-- AI Disclosure -->
		<div class="flex items-center gap-3 p-3.5 bg-gradient-to-br from-[rgba(43,212,199,.09)] to-[rgba(43,127,255,.06)] backdrop-blur-md border border-[rgba(43,212,199,.22)] rounded-2xl mb-5">
			<div class="w-[30px] h-[30px] rounded-lg bg-[rgba(43,212,199,.16)] flex items-center justify-center shrink-0 text-[var(--teal-txt,#2BD4C7)]">
				<svg class="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			</div>
			<div class="flex-1">
				<div class="text-[10px] font-extrabold text-[var(--teal-txt,#2BD4C7)] tracking-wider mb-0.5">فريق الدعم البشري</div>
				<p class="text-[13px] text-[var(--txt-2,#A8B2D1)]">محادثة مباشرة مع موظف دعم بشري. للحالات المعقّدة التي يحتاج فيها مراجعة فريق الدعم المختص</p>
			</div>
		</div>

		<!-- Chat placeholder -->
		<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-6 text-center">
			<div class="w-16 h-16 rounded-2xl bg-[rgba(43,212,199,.10)] border border-[rgba(43,212,199,.22)] flex items-center justify-center mx-auto mb-4 text-[var(--teal-txt,#2BD4C7)]">
				<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
				</svg>
			</div>
			<div class="text-base font-extrabold text-[var(--txt)] mb-1.5">الدعم المباشر</div>
			<div class="text-sm text-[var(--txt-3)] mb-4">واجهة المحادثة المباشرة قيد التطوير وفق التصميم المرجعي P-SK-024-الدعم المباشر</div>
			<a routerLink="/client-overview/help" class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#2BD4C7] to-[#2B7FFF] rounded-full text-[#070D24] font-extrabold text-[13px] no-underline hover:opacity-90 transition-opacity">
				العودة لمركز المساعدة
			</a>
		</div>
	</div>
	`,
	styles: [`
		:host { display: block; width: 100%; animation: ws-fade 0.2s ease forwards; }
		@keyframes ws-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
	`],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiveSupportComponent {
	isLoading = signal<boolean>(false);
}
