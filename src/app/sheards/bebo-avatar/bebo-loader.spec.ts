import { BEBO_PRELOAD_ATLASES, loadBebo, preloadBeboAtlases, resetBeboLoaderForTests } from './bebo-loader';

// The loader against a fake document: robot.js must be injected as ONE
// classic <script> (it resolves its sprite atlases from currentScript.src),
// shared by concurrent callers, skipped when already defined, retryable.

function fakeDocument(defined = false) {
	let resolveDefined!: () => void;
	const whenDefined = new Promise<void>((r) => (resolveDefined = r));
	const appended: HTMLScriptElement[] = [];
	const registry = { get: (tag: string) => (defined && tag === 'cute-robot' ? class {} : undefined), whenDefined: () => whenDefined };
	const doc = {
		baseURI: 'https://app.example/',
		defaultView: { customElements: registry },
		head: { appendChild: (s: HTMLScriptElement) => { appended.push(s); (s as any).remove = () => appended.splice(appended.indexOf(s), 1); } },
		createElement: (tag: string) => document.createElement(tag),
		querySelector: () => appended[0] ?? null,
	} as unknown as Document;
	return { doc, appended, define: () => resolveDefined() };
}

describe('loadBebo (robot.js loader)', () => {
	beforeEach(() => resetBeboLoaderForTests());

	it('injects robot.js once as a classic script from /bebo/ and resolves when <cute-robot> is defined', async () => {
		const { doc, appended, define } = fakeDocument();
		const a = loadBebo(doc);
		const b = loadBebo(doc);
		expect(a).toBe(b);
		expect(appended.length).toBe(1);
		expect(appended[0].src).toBe('https://app.example/bebo/robot.js');
		expect(appended[0].type).toBe('');
		define();
		await expect(a).resolves.toBeUndefined();
	});

	it('does nothing when the element is already defined', async () => {
		const { doc, appended } = fakeDocument(true);
		await loadBebo(doc);
		expect(appended.length).toBe(0);
	});

	it('a failed load rejects, removes the tag and can be retried', async () => {
		const { doc, appended } = fakeDocument();
		const first = loadBebo(doc);
		appended[0].dispatchEvent(new Event('error'));
		await expect(first).rejects.toThrow();
		expect(appended.length).toBe(0);
		loadBebo(doc);
		expect(appended.length).toBe(1);
	});
});

describe('preloadBeboAtlases (first-click flicker fix)', () => {
	beforeEach(() => resetBeboLoaderForTests());

	function docWithImages() {
		const created: { src: string }[] = [];
		class FakeImage {
			src = '';
			decoding = '';
			constructor() { created.push(this); }
			decode() { return Promise.resolve(); }
		}
		const doc = { baseURI: 'https://app.example/', defaultView: { Image: FakeImage } } as unknown as Document;
		return { doc, created };
	}

	it('fetches the hover/click and speaking atlases from /bebo/ once, even when called repeatedly', () => {
		const { doc, created } = docWithImages();
		preloadBeboAtlases(doc);
		preloadBeboAtlases(doc);
		expect(created.map((i) => i.src)).toEqual(BEBO_PRELOAD_ATLASES.map((p) => 'https://app.example/' + p));
		expect(created.map((i) => i.src)).toContain('https://app.example/bebo/robot-actions.png');
	});

	it('is a no-op without a window (SSR)', () => {
		expect(() => preloadBeboAtlases({ baseURI: 'x', defaultView: null } as unknown as Document)).not.toThrow();
	});
});
