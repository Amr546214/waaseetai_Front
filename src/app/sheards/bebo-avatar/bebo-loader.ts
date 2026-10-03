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
	/** Current engine position (px; viewport-relative in floating mode). */
	readonly position: { x: number; y: number };
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

/**
 * Sprite atlases robot.js swaps in lazily (via CSS background-image) the first time a pose
 * from that atlas plays. `robot-actions.png` carries jump/walk/drag/land (hover, click, drag) and
 * `robot-speaking.png` the speaking pose. Each is ~1 MB, so the first swap pointed the sprite at a
 * not-yet-fetched image and Bebo went blank until it arrived (disappear, then reappear). Warming
 * them up front, fully decoded, makes the first pose change flicker-free. The base atlas
 * (`robot-sprites.png`) is fetched by robot.js itself; the antics/emotions atlases only serve
 * rare scripted commands and stay on-demand.
 */
export const BEBO_PRELOAD_ATLASES = ['bebo/robot-actions.png', 'bebo/robot-speaking.png'] as const;

const preloaded = new Set<string>();
/** Held so the decoded bitmaps stay alive until robot.js first paints them. */
const keepAlive: HTMLImageElement[] = [];

export function preloadBeboAtlases(doc: Document): void {
	const win = doc.defaultView;
	if (!win || typeof win.Image !== 'function') return;
	for (const path of BEBO_PRELOAD_ATLASES) {
		const href = new URL(path, doc.baseURI).href;
		if (preloaded.has(href)) continue;
		preloaded.add(href);
		const img = new win.Image();
		img.decoding = 'async';
		img.src = href;
		img.decode?.().catch(() => preloaded.delete(href));
		keepAlive.push(img);
	}
}

/** Test hook: forget a shared in-flight load. */
export function resetBeboLoaderForTests(): void {
	pending = null;
	preloaded.clear();
}
