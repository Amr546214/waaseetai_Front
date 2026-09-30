// Loads the Bebo v4 web component (`<cute-robot>`, public/bebo/robot.js —
// copied verbatim from the Bebo v4 handoff) exactly once per document.
//
// robot.js resolves its six sprite atlases relative to
// `document.currentScript.src`, so it MUST be loaded as a classic <script>
// tag (a dynamic import() has no currentScript and would fall back to the
// page URL). The atlases therefore live next to it in /bebo/.

/** Every pose the Bebo v4 engine supports (robot.js `poses`). */
export const BEBO_POSES = [
	'idle', 'blink', 'wave', 'happy', 'thinking', 'listening', 'speaking', 'sleep',
	'walk', 'typing', 'jump', 'land', 'drag', 'rest', 'scratch', 'dance',
	'fly', 'catch', 'chew', 'laugh', 'cry', 'plead', 'chase', 'catrest',
] as const;
export type BeboPose = (typeof BEBO_POSES)[number];

export interface BeboPlayOptions {
	loop?: boolean;
	duration?: number;
	resume?: BeboPose;
}

/** Public API of the `<cute-robot>` element defined by robot.js. */
export interface CuteRobotElement extends HTMLElement {
	readonly state: BeboPose;
	paused: boolean;
	play(state: BeboPose, options?: BeboPlayOptions): CuteRobotElement;
	/** 0–1 loudness of the audio being spoken, or null to cycle speech frames. */
	setSpeechLevel(level: number | null): void;
	jump(): CuteRobotElement;
	walkTo(x: number): CuteRobotElement;
	resetPosition(): CuteRobotElement;
}

export const BEBO_TAG = 'cute-robot';
export const BEBO_SCRIPT_PATH = 'bebo/robot.js';
const SCRIPT_MARKER = 'data-bebo-robot';

let pending: Promise<void> | null = null;

/**
 * Resolves once `<cute-robot>` is defined. Injects the script only if the
 * element is not defined yet and no Bebo script tag exists; concurrent and
 * repeated calls share one load. A failed load can be retried.
 */
export function loadBebo(doc: Document): Promise<void> {
	const registry = doc.defaultView?.customElements;
	if (!registry) return Promise.reject(new Error('Custom elements are not supported'));
	if (registry.get(BEBO_TAG)) return Promise.resolve();
	if (pending) return pending;

	pending = new Promise<void>((resolve, reject) => {
		let script = doc.querySelector<HTMLScriptElement>(`script[${SCRIPT_MARKER}]`);
		if (!script) {
			script = doc.createElement('script');
			script.src = new URL(BEBO_SCRIPT_PATH, doc.baseURI).href;
			script.async = true;
			script.setAttribute(SCRIPT_MARKER, '');
			doc.head.appendChild(script);
		}
		const failed = script;
		failed.addEventListener(
			'error',
			() => {
				pending = null;
				failed.remove();
				reject(new Error('Failed to load the Bebo avatar'));
			},
			{ once: true },
		);
		registry.whenDefined(BEBO_TAG).then(() => resolve());
	});
	return pending;
}

/** Test hook: forget a shared in-flight load. */
export function resetBeboLoaderForTests(): void {
	pending = null;
}
