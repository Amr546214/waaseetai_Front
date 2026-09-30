import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AssistantChatComponent } from '../../../../../sheards/assistant-chat/assistant-chat';

// Provider "AI assistant" page. Previously a client-side keyword match over a
// fixed FAQ list behind a setTimeout, with a hard-coded "متصل" badge. It now
// renders the ONE shared, real Help assistant (AssistantStore → authenticated
// socket → backend → WaseetAI AI-21) — the same conversation as the
// floating dashboard Avatar.

@Component({
	selector: 'app-provider-ai-assistant',
	standalone: true,
	imports: [RouterModule, AssistantChatComponent],
	template: `
	<div class="w-full relative z-10 pb-10">
		<!-- Header -->
		<div class="mb-4 flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h1 class="text-xl font-black text-[var(--txt)] mb-1 flex items-center gap-2">
					المساعد الذكي
				</h1>
				<p class="text-xs text-[var(--txt-3)]">اسأل عن العروض، التسليم، الضمان، النزاعات، وسحب أرباحك</p>
			</div>
			<a routerLink="/provider-overview/help/live-support" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-lg text-[var(--txt)] text-xs font-bold no-underline shrink-0 hover:opacity-80 transition-opacity">
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>
				تحويل لموظف
			</a>
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
				<p class="text-[13px] text-[var(--txt-2,#A8B2D1)]">هذه محادثة مع المساعد الذكي لوسيط، يجيب من قاعدة المعرفة الموثّقة عن المنصة. لا تُشارَك بياناتك الحسّاسة، والقرار النهائي والإجراءات المالية تبقى بيدك أو لدى الفريق المختص</p>
			</div>
		</div>

		<!-- Chat: the shared, real Help assistant (same conversation as the dashboard Avatar) -->
		<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4">
			<app-assistant-chat />
		</div>
	</div>
	`,
	styles: [`
		:host { display: block; width: 100%; animation: ws-fade 0.2s ease forwards; }
		@keyframes ws-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderAiAssistantComponent {}
