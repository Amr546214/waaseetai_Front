import {
	CUSTOM_ELEMENTS_SCHEMA,
	ChangeDetectionStrategy,
	Component,
	DOCUMENT,
	ElementRef,
	OnDestroy,
	PLATFORM_ID,
	afterNextRender,
	effect,
	inject,
	input,
	output,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { AvatarState, BeboCommand } from '../../core/store/assistant.store';
import { BeboPose, CuteRobotElement, loadBebo } from './bebo-loader';
import type { BeboAction } from './bebo-commands';

/**
 * Bebo v4 pixel avatar — presentation/interaction layer only.
 *
 * Hosts the handoff's own `<cute-robot>` web component (public/bebo/robot.js,
 * unmodified): sprite atlases, pose timings, blink, drag + gravity + landing,
 * walk, hover/ArrowUp jump, click wave, keyboard walking, reduced-motion,
 * off-screen (IntersectionObserver) and hidden-tab pauses all come from the
 * handoff engine itself, not from a re-implementation.
 *
 * No AI, network or audio logic lives here. The component only maps the real
 * assistant state (AssistantStore) to Bebo poses — the same mapping as the
 * handoff's bebo-chat.js `mode()`:
 *   thinking / listening / speaking → play(state, {loop:true})
 *   idle  → play('idle'), but only when Bebo is still in an assistant pose,
 *           so user-driven antics (wave, jump, walk…) are not cut off
 *   error → one head-scratch ('scratch'), then Bebo returns to idle
 *   celebrate tick (a completed answer) → one 'happy' while idle
 * Speech loudness for the mouth is pushed in via setSpeechLevel().
 */
const ASSISTANT_POSES: readonly BeboPose[] = ['thinking', 'listening', 'speaking'];
/** Bebo suppresses its own click-wave for 450 ms after a drop; so do we. */
const DROP_CLICK_GUARD_MS = 450;
/** Handoff execute(): these command poses loop until something else plays. */
const LOOPING_ACTIONS: readonly BeboAction[] = ['typing', 'sleep', 'rest', 'idle'];

@Component({
	selector: 'app-bebo-avatar',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'bebo-avatar',
		'[attr.data-state]': 'state()',
		'[attr.data-ready]': 'ready() ? "" : null',
		'[attr.data-active]': 'active() ? "" : null',
	},
	template: `
		<cute-robot
			#robot
			interactive
			[attr.floating]="floating() ? '' : null"
			[attr.size]="size()"
			[attr.floor-offset]="floorOffset()"
			[attr.home-x]="homeX()"
			[attr.label]="label()"
			(click)="onRobotClick()"
			(robotdrop)="onRobotDrop()"
			(robotwalkend)="reapplyAssistantPose()"
		></cute-robot>
		@if (loadFailed()) {
			<button type="button" class="bebo-avatar__fallback" (click)="activate.emit()">{{ label() }}</button>
		}
	`,
	styles: [`
		:host { display: inline-block; line-height: 0; }
		cute-robot { pointer-events: auto; }
		/* Launcher pad. In floating mode robot.js positions <cute-robot> itself
		   (position: fixed on the viewport floor via its :host([floating]) rule);
		   position, transform, will-change and contain stay owned by the engine.
		   Only paint is added here, on the element robot.js moves, so the pad
		   travels with Bebo (drag, walk, landing) and Bebo reads as the
		   assistant's launcher button, not a bare sprite over the page cards. */
		cute-robot[floating] {
			border-radius: 50%;
			background: radial-gradient(circle at 50% 42%, rgba(165,107,224,.32), rgba(9,18,48,.92) 68%);
			box-shadow: 0 0 0 1.5px rgba(165,107,224,.55), 0 0 22px rgba(123,47,190,.35), 0 10px 26px rgba(0,0,0,.45);
			transition: box-shadow .2s ease;
		}
		/* Assistant panel open: a brighter ring ties Bebo to the panel above it. */
		:host([data-active]) cute-robot[floating] {
			box-shadow: 0 0 0 2px rgba(43,212,199,.75), 0 0 26px rgba(43,212,199,.35), 0 10px 26px rgba(0,0,0,.45);
		}
		@media (prefers-reduced-motion: reduce) { cute-robot[floating] { transition: none; } }
		.bebo-avatar__fallback { pointer-events: auto; padding: 10px 14px; border-radius: 999px; border: 0; font: inherit; font-size: 13px; font-weight: 800; line-height: 1.4; color: #fff; background: linear-gradient(135deg, #7B2FBE, #A56BE0); cursor: pointer; }
	`],
})
export class BeboAvatarComponent implements OnDestroy {
	/** Real assistant state; the only thing that drives assistant poses. */
	readonly state = input<AvatarState>('idle');
	/** Monotonic counter; each increment is one successful answer → 'happy'. */
	readonly celebrate = input(0);
	readonly size = input(96);
	/** Handoff embed mode: fixed to the viewport, draggable, walks the floor. */
	readonly floating = input(true);
	readonly floorOffset = input(0);
	readonly homeX = input<number | null>(null);
	readonly label = input('بيبو — المساعد الذكي');
	/** The assistant panel Bebo launches is open (visual accent only). */
	readonly active = input(false);
	/** Local motion command (AssistantStore.beboCommand); each new seq runs once. */
	readonly command = input<BeboCommand | null>(null);

	/** Click on Bebo (not the end of a drag). */
	readonly activate = output<void>();

	readonly ready = signal(false);
	readonly loadFailed = signal(false);

	private readonly robotRef = viewChild.required<ElementRef<CuteRobotElement>>('robot');
	private readonly robot = signal<CuteRobotElement | null>(null);
	private readonly doc = inject(DOCUMENT);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private destroyed = false;
	private lastState: AvatarState | null = null;
	private lastCelebrate: number | null = null;
	private lastDropAt = -Infinity;
	private lastCommandSeq: number | undefined;

	constructor() {
		afterNextRender(() => {
			if (!this.isBrowser) return;
			loadBebo(this.doc).then(
				() => {
					if (this.destroyed) return;
					this.robot.set(this.robotRef().nativeElement);
					this.ready.set(true);
				},
				() => { if (!this.destroyed) this.loadFailed.set(true); },
			);
		});

		effect(() => {
			const state = this.state();
			const celebrate = this.celebrate();
			const robot = this.robot();
			if (robot) untracked(() => this.sync(robot, state, celebrate));
		});

		effect(() => {
			const command = this.command();
			const robot = this.robot();
			if (!robot) return;
			// A command already present when Bebo (re)mounts is not replayed.
			if (this.lastCommandSeq === undefined) {
				this.lastCommandSeq = command?.seq ?? 0;
				return;
			}
			if (!command || command.seq === this.lastCommandSeq) return;
			this.lastCommandSeq = command.seq;
			untracked(() => this.execute(robot, command.action));
		});
	}

	/**
	 * Runs one local Bebo command on the real robot — the handoff's
	 * bebo-chat.js `execute()` mapping. Roaming is never toggled here
	 * (autonomous roaming stays disabled pending browser QA).
	 */
	private execute(robot: CuteRobotElement, action: BeboAction): void {
		if (action === 'roam_on' || action === 'roam_off') return;
		robot.paused = false;
		if (action === 'reset') robot.resetPosition();
		else if (action === 'stop') {
			if (ASSISTANT_POSES.includes(robot.state)) robot.play('idle');
		} else robot.play(action as BeboPose, { loop: LOOPING_ACTIONS.includes(action) });
	}

	/** Mouth animation input: 0–1 loudness of the playing answer audio, or null. */
	setSpeechLevel(level: number | null): void {
		this.robot()?.setSpeechLevel?.(level);
	}

	/**
	 * Floating mode only: if Bebo was dragged / walked away from its home spot
	 * (the launcher corner under the assistant panel), put it back there with
	 * the engine's own resetPosition(). A no-op when Bebo is already home, so
	 * the click-wave that opened the panel is not cut off.
	 */
	returnHome(): void {
		const robot = this.robot();
		if (!robot || !this.floating()) return;
		// Mirrors robot.js floating _limits()/_layout(): 12px viewport padding,
		// home x = clamp(home-x || minX, minX, maxX).
		const pad = 12;
		const size = robot.getBoundingClientRect().width || this.size();
		const maxX = Math.max(pad, this.doc.documentElement.clientWidth - size - pad);
		const home = Math.min(Math.max(this.homeX() || pad, pad), maxX);
		if (Math.abs(robot.position.x - home) < 1) return;
		robot.resetPosition();
		this.reapplyAssistantPose();
	}

	onRobotDrop(): void {
		this.lastDropAt = performance.now();
	}

	onRobotClick(): void {
		if (performance.now() - this.lastDropAt < DROP_CLICK_GUARD_MS) return;
		this.activate.emit();
	}

	/** A drag interrupts assistant poses; restore the real one once Bebo settles. */
	reapplyAssistantPose(): void {
		const robot = this.robot();
		const state = this.state();
		if (robot && ASSISTANT_POSES.includes(state as BeboPose) && robot.state !== state) {
			robot.play(state as BeboPose, { loop: true });
		}
	}

	ngOnDestroy(): void {
		this.destroyed = true;
		this.robot()?.setSpeechLevel?.(null);
		this.robot.set(null);
		// Detach explicitly (not only when a parent view's DOM is dropped) so
		// Bebo's own disconnectedCallback always runs: it cancels its rAF loop,
		// disconnects its Intersection/ResizeObservers and removes its
		// window/document/matchMedia listeners.
		this.robotRef().nativeElement.remove();
	}

	private sync(robot: CuteRobotElement, state: AvatarState, celebrate: number): void {
		const celebrateNow = this.lastCelebrate !== null && celebrate > this.lastCelebrate;
		this.lastCelebrate = celebrate;
		if (state !== this.lastState) {
			this.lastState = state;
			this.applyState(robot, state);
		}
		if (celebrateNow && state === 'idle') robot.play('happy');
	}

	private applyState(robot: CuteRobotElement, state: AvatarState): void {
		switch (state) {
			case 'thinking':
			case 'listening':
			case 'speaking':
				robot.play(state, { loop: true });
				break;
			case 'error':
				robot.play('scratch');
				break;
			case 'idle':
				if (ASSISTANT_POSES.includes(robot.state)) robot.play('idle');
				break;
		}
	}
}
