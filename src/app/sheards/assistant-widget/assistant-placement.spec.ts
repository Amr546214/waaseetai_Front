import { dockPlacement, popupPlacement, type AssistantViewport } from './assistant-placement';

describe('floating assistant viewport placement', () => {
	const desktop: AssistantViewport = { width: 1280, height: 800, left: 0, top: 0 };

	it('places a popup immediately above a floor avatar without exceeding the ceiling', () => {
		const style = popupPlacement(desktop, { x: 600, y: 638, size: 96 });
		expect(style['bottom']).toBe('calc(100dvh - 630px)');
		expect(Number.parseFloat(style['maxHeight'])).toBeLessThanOrEqual(630 - 12);
	});

	it('uses the space below a top-edge drag rather than putting a popup off screen', () => {
		const style = popupPlacement(desktop, { x: 600, y: 12, size: 96 });
		expect(style['top']).toBe('116px');
		expect(116 + Number.parseFloat(style['maxHeight'])).toBeLessThanOrEqual(788);
	});

	it.each([0, 260, 1000])('fits a narrow mobile viewport at avatar x=%s', (x) => {
		const viewport = { width: 320, height: 568, left: 0, top: 0 };
		for (const style of [popupPlacement(viewport, { x, y: 330, size: 72 }), dockPlacement(viewport, { x, y: 330, size: 72 })]) {
			const left = Number.parseFloat(style['left']);
			expect(left).toBeGreaterThanOrEqual(12);
			expect(left + Number.parseFloat(style['width'])).toBeLessThanOrEqual(308);
		}
	});

	it('keeps the input dock on the floor when the avatar is dragged upwards', () => {
		const low = dockPlacement(desktop, { x: 600, y: 638, size: 96 });
		const high = dockPlacement(desktop, { x: 600, y: 12, size: 96 });
		expect(high).toEqual(low);
	});

	it('uses only the visible space when a mobile keyboard shrinks and shifts the viewport', () => {
		const viewport = { width: 360, height: 300, left: 20, top: 80 };
		const style = popupPlacement(viewport, { x: 350, y: 620, size: 72 });
		expect(style['bottom']).toBe('calc(100dvh - 368px)');
		expect(Number.parseFloat(style['maxHeight'])).toBeLessThanOrEqual(276);
		expect(Number.parseFloat(style['left'])).toBeGreaterThanOrEqual(32);
		expect(dockPlacement(viewport, { x: 20, y: 620, size: 72 })['bottom']).toBe('calc(100dvh - 380px + 12px)');
	});
});
