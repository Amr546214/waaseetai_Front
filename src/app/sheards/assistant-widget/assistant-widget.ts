import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AssistantStore } from '../../core/store/assistant.store';
import { BeboAvatarComponent } from '../bebo-avatar/bebo-avatar';
import { AssistantChatComponent } from '../assistant-chat/assistant-chat';

// Floating dashboard assistant: the Bebo v4 pixel avatar (floating, as in the
// handoff's embed example — draggable, walks the bottom edge, jumps on hover
// or ArrowUp) acts as the launcher; clicking / Enter on Bebo toggles the chat
// panel. Mounted ONCE in the shared dashboard layout (client / provider /
// marketer / admin), so it survives in-dashboard route changes. Uses logical
// CSS properties (inset-inline-end) so the panel sits on the correct side in
// both RTL and LTR; Bebo's home spot is the same corner.
//
// Positioning contract (Bebo launcher): in floating mode robot.js makes
// <cute-robot> position: fixed itself (left/top 0 + translate3d) and places
// it on the viewport floor, 12px from the edge — it does NOT follow this
// host's box. This host is therefore aligned to that same 12px corner and
// reserves Bebo's height + a gap under the panel: closed = Bebo alone in the
// corner (launcher pad from BeboAvatar); open = panel directly above Bebo,
// edges aligned. No ancestor of the widget may get a transform / filter /
// contain / will-change, or Bebo's fixed box would be trapped inside it.
// z-index 950: above the dashboard chrome (main 1, sidebar 85/90, topbar 100)
// and below toasts / global loader / video-call modal (99999+).

const STATE_LABELS = { idle: 'جاهز', thinking: 'يفكّر…', listening: 'يستمع…', speaking: 'يتحدث', error: 'تعذر الرد' } as const;
const BEBO_SIZE = 96;
const BEBO_SIZE_MOBILE = 72;

@Component({
	selector: 'app-assistant-widget',
	standalone: true,
	imports: [BeboAvatarComponent, AssistantChatComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { '(document:keydown.escape)': 'store.close()', '[style.--bebo-size.px]': 'beboSize()' },
	template: `
	<div class="aw" [attr.data-state]="store.state()">
		@if (store.panelOpen()) {
			<section class="aw__panel" role="dialog" aria-modal="false" aria-labelledby="aw-title">
				<header class="aw__head">
					<div>
						<h2 id="aw-title">المساعد الذكي — وسيط</h2>
						<span class="aw__state" aria-live="polite">{{ stateLabel() }}</span>
					</div>
					<button type="button" class="aw__close" (click)="store.close()" aria-label="إغلاق المساعد">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
					</button>
				</header>
				<app-assistant-chat class="aw__chat" [compact]="true" />
			</section>
		}
		<app-bebo-avatar
			class="aw__bebo"
			[state]="store.state()"
			[celebrate]="store.successTick()"
			[command]="store.beboCommand()"
			[size]="beboSize()"
			[homeX]="beboHomeX"
			[label]="beboLabel()"
			(activate)="store.toggle()"
		/>
	</div>
	`,
	styles: [`
		:host { position: fixed; inset-block-end: 12px; inset-inline-end: 12px; z-index: 950; pointer-events: none; }
		/* The panel opens directly above Bebo's home spot (bottom corner, 12px
		   from the viewport edge — robot.js floating padding, matched above), so
		   Bebo never sits under or over the panel / its input. */
		.aw { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; padding-block-end: calc(var(--bebo-size, 96px) + 10px); }
		.aw__bebo { pointer-events: none; }
		.aw__panel { pointer-events: auto; display: flex; flex-direction: column; gap: 10px; width: min(380px, calc(100vw - 32px)); height: min(560px, calc(100dvh - var(--bebo-size, 96px) - 90px));
			padding: 14px; border-radius: 18px; background: rgba(9,18,48,.97); backdrop-filter: blur(14px);
			border: 1px solid rgba(123,47,190,.3); box-shadow: 0 18px 50px rgba(0,0,0,.45); color: #fff;
			/* The panel is always dark: pin the theme tokens the chat uses so the
			   light dashboard theme cannot turn its text dark-on-dark. */
			--txt: #FFFFFF; --txt-2: #A8B2D1; --txt-3: #A8B2D1; --sec-bd: rgba(255,255,255,.16); }
		.aw__panel textarea::placeholder { color: #8892B0; }
		.aw__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
		.aw__head h2 { margin: 0; font-size: 14px; font-weight: 900; color: #fff; }
		.aw__state { font-size: 11px; color: #A8B2D1; }
		.aw__close { width: 30px; height: 30px; padding: 6px; border-radius: 9px; border: 1px solid rgba(255,255,255,.12); background: transparent; color: #A8B2D1; cursor: pointer; }
		.aw__close svg { width: 100%; height: 100%; }
		.aw__chat { flex: 1; min-height: 0; }
		@media (max-width: 640px) {
			.aw__panel { width: calc(100vw - 24px); height: min(70dvh, calc(100dvh - var(--bebo-size, 72px) - 90px)); }
		}
	`],
})
export class AssistantWidgetComponent {
	readonly store = inject(AssistantStore);
	readonly stateLabel = computed(() => (this.store.audioLoading() ? 'يجهّز الصوت…' : STATE_LABELS[this.store.state()]));
	readonly beboLabel = computed(() =>
		`بيبو، المساعد الذكي — ${this.store.panelOpen() ? 'اضغط لإغلاق المحادثة' : 'اضغط لفتح المحادثة'}`,
	);

	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly avatar = viewChild(BeboAvatarComponent);
	private readonly compact = signal(false);
	readonly beboSize = computed(() => (this.compact() ? BEBO_SIZE_MOBILE : BEBO_SIZE));
	/** Bebo's floating home: robot.js defaults to the left edge (the inline
	 *  end in RTL); in LTR an oversized x is clamped to the right edge. */
	readonly beboHomeX: number | null = this.isBrowser && getComputedStyle(document.documentElement).direction === 'ltr' ? 100_000 : null;

	constructor() {
		const destroyRef = inject(DestroyRef);
		// Opening the panel brings a dragged-away Bebo back to its launcher spot
		// under the panel, so the open assistant and Bebo stay together.
		effect(() => {
			if (this.store.panelOpen()) untracked(() => this.avatar()?.returnHome());
		});
		// Real answer-audio loudness → Bebo's mouth (outside the Angular zone).
		const offSpeech = this.store.onSpeechLevel((level) => this.avatar()?.setSpeechLevel(level));
		destroyRef.onDestroy(offSpeech);

		if (this.isBrowser && typeof window.matchMedia === 'function') {
			const mq = window.matchMedia('(max-width: 640px)');
			const onChange = () => this.compact.set(mq.matches);
			onChange();
			mq.addEventListener?.('change', onChange);
			destroyRef.onDestroy(() => mq.removeEventListener?.('change', onChange));
		}
	}
}
