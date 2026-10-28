import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** The number of questions of EVERY specialty test (backend: constants/specialty-test.ts). Only used for copy that appears before the backend reports its own count. */
export const SPECIALTY_TEST_QUESTION_COUNT = 15;
export const SPECIALTY_TEST_TIME_LIMIT_MINUTES = 15;
export const SPECIALTY_TEST_PASS_SCORE = 25;

export type SpecialtyTestPhase = 'generating' | 'active' | 'submitting' | 'result' | 'error';
export type SpecialtyTestTone = 'ok' | 'wait' | 'bad';

export interface SpecialtyTestQuestion { text: string; options: string[]; tag?: string | null }
export interface SpecialtyTestStat { label: string; value: string | number; tone?: 'teal' | 'coral' | 'amber' | null }
export interface SpecialtyTestResult {
	score: number;
	passed: boolean;
	headline: string;
	subline: string;
	/** A level / badge pill under the score (optional). */
	pill?: { label: string; tone: 'beginner' | 'mid' | 'expert' | 'wait' } | null;
	stats: SpecialtyTestStat[];
	feedback?: string | null;
	strengths?: string[];
	weaknesses?: string[];
	/** The one button under the result; null hides it. */
	primaryLabel: string | null;
}

/**
 * THE specialty test screen, used by the setup (registration) test and by the later specialty test: one question card, one progress bar + timer, one set of
 * buttons, one result screen, one error / generating / submitting state. The two flows only differ in what they pass in (data, copy, whether the user may go back
 * and change answers) and in what they do on the outputs; the markup and the behaviour of the screen are this component's.
 *
 * `allowReview`: false = answering moves on at once (the setup test is server-driven, forward only); true = previous / next / finish buttons and answers can be
 * changed before finishing (the later test submits all answers at the end).
 */
@Component({
	selector: 'ws-specialty-test',
	standalone: true,
	imports: [DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	styleUrl: './specialty-test.component.css',
	template: `
	<div class="test-active" data-testid="specialty-test" [attr.data-phase]="phase()">
		@switch (phase()) {
			@case ('generating') {
				<div class="wst-status" role="status" data-testid="specialty-test-generating">
					<div class="wst-spin" aria-hidden="true"></div>
					<h3>{{ statusTitle() || 'جاري توليد الاختبار بالذكاء الاصطناعي...' }}</h3>
					<p>يرجى الانتظار ولا تغادر هذه الصفحة</p>
				</div>
			}
			@case ('submitting') {
				<div class="wst-status" role="status" data-testid="specialty-test-submitting">
					<div class="wst-spin" aria-hidden="true"></div>
					<h3>جاري معالجة الإجابات والتقييم الذكي...</h3>
					<p>يتم الآن مطابقة إجاباتك واحتساب النسبة المئوية وتسجيل النتيجة.</p>
				</div>
			}
			@case ('error') {
				<div class="wst-status wst-error" role="alert" data-testid="specialty-test-error">
					<h3>تعذر إكمال التقييم الفني</h3>
					<p>{{ errorMessage() }}</p>
					@if (errorRetryable()) {
						<button type="button" class="wst-btn" (click)="retry.emit()" data-testid="specialty-test-retry">إعادة المحاولة</button>
					} @else {
						<button type="button" class="wst-btn wst-btn--ghost" (click)="back.emit()" data-testid="specialty-test-back">{{ backLabel() }}</button>
					}
				</div>
			}
			@case ('result') {
				@if (result(); as r) {
				<div class="result-screen" data-testid="specialty-test-result">
					<div class="result-card">
						<div class="result-score-wrap">
							<div class="result-score-circle" [class.failed]="!r.passed" [style.--score-deg]="(r.score || 0) * 3.6 + 'deg'" aria-hidden="true">
								<div class="result-score-inner">
									<span class="result-score-num">{{ r.score | number:'1.0-1' }}%</span>
									<span class="result-score-lbl">النتيجة</span>
								</div>
							</div>
							<h2 class="result-headline" data-testid="specialty-test-headline">{{ r.headline }}</h2>
							@if (r.pill; as p) {
								<div class="result-level-pill" [class.beginner]="p.tone === 'beginner'" [class.mid]="p.tone === 'mid' || p.tone === 'wait'" [class.expert]="p.tone === 'expert'">{{ p.label }}</div>
							}
							<div class="result-desc" data-testid="specialty-test-subline">{{ r.subline }}</div>
						</div>
						@if (r.stats.length) {
						<div class="stats-row">
							@for (s of r.stats; track s.label) {
								<div class="stat-box"><div class="stat-box-val" [class.txt-teal]="s.tone === 'teal'" [class.txt-coral]="s.tone === 'coral'" [class.txt-amber]="s.tone === 'amber'">{{ s.value }}</div><div class="stat-box-lbl">{{ s.label }}</div></div>
							}
						</div>
						}
						@if (r.feedback) {
						<div class="result-feedback" data-testid="specialty-test-feedback">
							<div class="fb-ttl txt-purple"><svg width="10" height="10" aria-hidden="true"><use href="#i-ai"></use></svg> تقييم محرك Waseet AI والتحليل الفني الذكي</div>
							<p>{{ r.feedback }}</p>
							@if (r.strengths?.length) { <div class="fb-ttl txt-teal">✓ أبرز نقاط القوة:</div><ul>@for (s of r.strengths; track s) { <li>{{ s }}</li> }</ul> }
							@if (r.weaknesses?.length) { <div class="fb-ttl txt-amber">⚠ مجالات التحسين:</div><ul>@for (w of r.weaknesses; track w) { <li>{{ w }}</li> }</ul> }
						</div>
						}
						@if (r.primaryLabel) {
						<div class="result-actions">
							<button type="button" class="btn-to-profile" (click)="primary.emit()" data-testid="specialty-test-primary">{{ r.primaryLabel }}</button>
						</div>
						}
					</div>
				</div>
				}
			}
			@default {
				<div class="test-header">
					<div class="test-progress-wrap">
						<div class="test-progress-lbl">
							<span>التقدم في الاختبار</span>
							<span data-testid="specialty-test-progress">{{ answeredCount() }} / {{ total() || 1 }}</span>
						</div>
						<div class="test-progress-bar"><div class="test-progress-fill" [style.width.%]="progressPercent()"></div></div>
					</div>
					<div class="timer-wrap" [class.critical]="timerCritical()" aria-live="polite" aria-label="الوقت المتبقي">
						<svg class="timer-ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
						<span class="timer-display" data-testid="specialty-test-timer">{{ timeLabel() }}</span>
					</div>
				</div>

				@if (streaming(); as st) {
					<div class="wst-stream" role="status" data-testid="specialty-test-streaming">
						<span>{{ st.message }}</span>
						<strong>{{ st.count }} / {{ st.total ?? '—' }}</strong>
					</div>
				}

				@if (question(); as q) {
					<div class="question-card" role="region" aria-labelledby="q-text">
						<div class="q-meta">
							<span class="q-num">السؤال {{ index() + 1 }}</span>
							@if (total()) { <span class="q-tag">من {{ total() }}</span> }
							@if (q.tag) { <span class="q-tag">{{ q.tag }}</span> }
						</div>
						<div class="q-text" id="q-text" data-testid="specialty-test-question">{{ q.text }}</div>
						<div class="q-options" role="radiogroup" aria-labelledby="q-text">
							@for (opt of q.options; track $index; let oi = $index) {
								<div class="q-option" [class.selected]="selectedIndex() === oi" (click)="answer.emit(oi)" (keydown.enter)="answer.emit(oi)" (keydown.space)="answer.emit(oi); $event.preventDefault()" role="radio" [attr.aria-checked]="selectedIndex() === oi" tabindex="0" data-testid="specialty-test-option">
									<div class="q-radio" aria-hidden="true"></div>
									<div class="q-option-letter">{{ oi + 1 }}</div>
									<span class="q-option-txt">{{ opt }}</span>
								</div>
							}
						</div>
					</div>

					@if (allowReview()) {
						<div class="test-nav" data-testid="specialty-test-nav">
							<button type="button" class="btn-prev" (click)="prev.emit()" [disabled]="index() === 0" data-testid="specialty-test-prev">
								<svg data-ws-icon="ws-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
								السابق
							</button>
							@if (isLast()) {
								<button type="button" class="btn-finish" (click)="finish.emit()" [disabled]="finishDisabled()" data-testid="specialty-test-finish">{{ finishLabel() }}</button>
							} @else {
								<button type="button" class="btn-next" (click)="next.emit()" data-testid="specialty-test-next">
									التالي
									<svg data-ws-icon="ws-chevron-l" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
								</button>
							}
						</div>
					}
				} @else {
					<div style="padding: 40px; text-align: center" class="txt-muted">جاري تحميل السؤال التالي...</div>
				}
			}
		}
	</div>
	`,
})
export class SpecialtyTestComponent {
	readonly phase = input<SpecialtyTestPhase>('active');
	readonly statusTitle = input<string | null>(null);
	readonly errorMessage = input<string | null>(null);
	readonly errorRetryable = input(false);
	readonly backLabel = input('العودة إلى لوحة التخصصات');

	readonly question = input<SpecialtyTestQuestion | null>(null);
	readonly index = input(0);
	readonly total = input<number | null>(null);
	readonly selectedIndex = input<number | null>(null);
	readonly answeredCount = input(0);

	readonly timeLabel = input('15:00');
	readonly timerCritical = input(false);

	readonly allowReview = input(false);
	readonly finishLabel = input('إنهاء الاختبار');
	readonly finishDisabled = input(false);
	readonly streaming = input<{ message: string; count: number; total: number | null } | null>(null);

	readonly result = input<SpecialtyTestResult | null>(null);

	readonly answer = output<number>();
	readonly prev = output<void>();
	readonly next = output<void>();
	readonly finish = output<void>();
	readonly retry = output<void>();
	readonly back = output<void>();
	readonly primary = output<void>();

	protected readonly isLast = computed(() => !!this.total() && this.index() >= (this.total() as number) - 1);
	protected readonly progressPercent = computed(() => Math.min(100, ((this.answeredCount() || 0) / (this.total() || 1)) * 100));
}
