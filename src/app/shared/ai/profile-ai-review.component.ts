import { Component, computed, input } from '@angular/core';
import { CLIENT_PASSWORD_CHANGE_CATEGORY, ProfileAiReview, isRealAi } from '../../core/models/ai-result.model';

const OPEN_STATUSES = ['PENDING_OTP', 'IN_AI_REVIEW', 'PENDING_HUMAN_REVIEW'];

/**
 * The AI pre-review block of a governed profile-change request, driven ONLY by `aiReview`.
 * READY (Gemini / WaseetAI): official AI mark + summary + recommendation + observations + an "advisory" note.
 * FAILED / null / NOT_ENOUGH_DATA / PENDING: a neutral icon and honest text, only while the request is still open.
 * Password-change requests never show this block. No score and no confidence is ever rendered.
 */
@Component({
	selector: 'ws-profile-ai-review',
	standalone: true,
	template: `
		@switch (mode()) {
			@case ('ai') {
				<div class="ws-air ws-air-ai" data-testid="ai-review-ready">
					<span class="ws-air-ico" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/>
							<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/>
						</svg>
					</span>
					<div class="ws-air-body">
						<div class="ws-air-ttl">فحص أولي بالذكاء الاصطناعي</div>
						@if (review()?.summary) { <p class="ws-air-txt" data-testid="ai-review-summary">{{ review()?.summary }}</p> }
						@if (review()?.recommendation) { <p class="ws-air-txt" data-testid="ai-review-recommendation">{{ review()?.recommendation }}</p> }
						@if (review()?.observations?.length) {
							<ul class="ws-air-list" data-testid="ai-review-observations">
								@for (o of review()!.observations; track $index) { <li>{{ o }}</li> }
							</ul>
						}
						<div class="ws-air-note">استشاري، القرار للمراجع</div>
					</div>
				</div>
			}
			@case ('failed') {
				<div class="ws-air" data-testid="ai-review-failed">
					<span class="ws-air-ico ws-air-neutral" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8v5M12 16h.01"/></svg>
					</span>
					<div class="ws-air-body"><p class="ws-air-txt">تعذر تشغيل الفحص الأولي حاليًا. الطلب بانتظار مراجعة الفريق</p></div>
				</div>
			}
			@case ('waiting') {
				<div class="ws-air" data-testid="ai-review-waiting">
					<span class="ws-air-ico ws-air-neutral" aria-hidden="true">
						<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
					</span>
					<div class="ws-air-body"><p class="ws-air-txt">بانتظار مراجعة الفريق</p></div>
				</div>
			}
		}
	`,
	styles: [`
		:host { display: block; }
		.ws-air { display: flex; gap: 10px; padding: 12px; border-radius: 10px; margin-bottom: 12px; background: rgba(123,47,190,.08); border: 1px solid rgba(123,47,190,.2); }
		.ws-air-ico { width: 26px; height: 26px; border-radius: 7px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(123,47,190,.15); color: #A56BE0; }
		.ws-air-neutral { background: rgba(255,255,255,.06); color: var(--txt-3, #8892b0); }
		.ws-air-body { flex: 1; min-width: 0; }
		.ws-air-ttl { font-size: 10.5px; font-weight: 900; letter-spacing: .04em; color: #A56BE0; margin-bottom: 4px; }
		.ws-air-txt { margin: 0 0 4px; font-size: 12px; line-height: 1.7; color: var(--txt-3, #8892b0); }
		.ws-air-list { margin: 4px 0; padding-inline-start: 18px; font-size: 12px; line-height: 1.7; color: var(--txt-3, #8892b0); list-style: disc; }
		.ws-air-note { font-size: 10.5px; font-weight: 700; color: var(--txt-3, #8892b0); opacity: .8; }
	`],
})
export class ProfileAiReviewComponent {
	readonly review = input<ProfileAiReview | null | undefined>(null);
	readonly status = input<string | null | undefined>(null);
	readonly category = input<string | null | undefined>(null);

	protected readonly mode = computed<'none' | 'ai' | 'failed' | 'waiting'>(() => {
		if (this.category() === CLIENT_PASSWORD_CHANGE_CATEGORY) return 'none';
		const r = this.review();
		if (isRealAi(r)) return 'ai';
		const open = OPEN_STATUSES.includes(this.status() ?? '');
		if (!open) return 'none';
		return r?.status === 'FAILED' ? 'failed' : 'waiting';
	});
}
