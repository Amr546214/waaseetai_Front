import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-client-ai-assistant',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	template: `
	<div class="w-full relative z-10 pb-10">
		<!-- Header -->
		<div class="mb-4">
			<h1 class="text-xl font-black text-[var(--txt)] mb-1">المساعد الذكي</h1>
			<p class="text-xs text-[var(--txt-3)]">واجهة محادثة قيد التطوير للإجابة على أسئلتك</p>
		</div>

		<!-- Disclosure -->
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
				<div class="text-[10px] font-extrabold text-[var(--ai-txt,#A56BE0)] tracking-wider mb-0.5">وسيط، المساعد الذكي</div>
				<p class="text-[13px] text-[var(--txt-2,#A8B2D1)]">هذه الميزة قيد التطوير حالياً. لن تُشارَك بياناتك الحسّاسة، والقرار النهائي والإجراءات المالية تبقى بيدك أو لدى الفريق المختص</p>
			</div>
		</div>

		<!-- Chat placeholder -->
		<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-6 text-center">
			<div class="w-16 h-16 rounded-2xl bg-[rgba(123,47,190,.10)] border border-[rgba(123,47,190,.22)] flex items-center justify-center mx-auto mb-4 text-[var(--ai-txt,#A56BE0)]">
				<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="12" cy="12" r="2" /><circle cx="4" cy="6" r="1.5" /><circle cx="20" cy="6" r="1.5" />
					<circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="18" r="1.5" /><circle cx="12" cy="3" r="1.5" />
					<circle cx="12" cy="21" r="1.5" />
					<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5" />
				</svg>
			</div>
			<div class="text-base font-extrabold text-[var(--txt)] mb-1.5">المساعد الذكي</div>
			<div class="text-sm text-[var(--txt-3)] mb-4">واجهة المحادثة الكاملة قيد التطوير وفق التصميم المرجعي P-SK-024-المساعد الذكي</div>
			<a routerLink="/client-overview/help" class="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#7B2FBE] to-[#A56BE0] rounded-full text-white font-extrabold text-[13px] no-underline hover:opacity-90 transition-opacity">
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
export class AiAssistantComponent {
	isLoading = signal<boolean>(false);
}
