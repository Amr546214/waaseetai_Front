import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { avatarMovementBounds, cleanAssistantPosition, DEFAULT_ASSISTANT_POSITION } from './assistant-position';
import { AssistantPositionService } from './assistant-position.service';

describe('assistant movement boundaries', () => {
	it('preserves the original home and floor with default settings', () => {
		expect(avatarMovementBounds({ width: 1280, height: 800, left: 0, top: 0 }, 96, { ...DEFAULT_ASSISTANT_POSITION }, 96)).toEqual({ minX: 12, maxX: 1172, minY: 12, maxY: 542 });
	});

	it.each([
		{ width: 320, height: 568, left: 0, top: 0 },
		{ width: 360, height: 240, left: 20, top: 80 },
		{ width: 110, height: 110, left: 0, top: 0 },
	])('keeps excessive margins and a lifted floor inside viewport %j', viewport => {
		const bounds = avatarMovementBounds(viewport, 96, { verticalOffset: 0, top: 240, bottom: 240, left: 240, right: 240 }, 300);
		expect(bounds.minX).toBeGreaterThanOrEqual(viewport.left);
		expect(bounds.minY).toBeGreaterThanOrEqual(viewport.top);
		expect(bounds.maxX).toBeGreaterThanOrEqual(bounds.minX);
		expect(bounds.maxY).toBeGreaterThanOrEqual(bounds.minY);
		expect(bounds.maxX + 96).toBeLessThanOrEqual(viewport.left + viewport.width + .001);
		expect(bounds.maxY + 96).toBeLessThanOrEqual(viewport.top + viewport.height + .001);
	});

	it('rejects non-numeric saved values and clamps every preference', () => {
		expect(cleanAssistantPosition({ verticalOffset: -900, top: -1, bottom: Infinity, left: '80', right: 900 })).toEqual({ verticalOffset: -240, top: 0, bottom: 12, left: 12, right: 240 });
		expect(cleanAssistantPosition(null)).toEqual(DEFAULT_ASSISTANT_POSITION);
	});
});

describe('AssistantPositionService', () => {
	let saved: Map<string, string>;
	let write: ReturnType<typeof vi.fn>;
	beforeEach(() => {
		saved = new Map();
		write = vi.fn((key: string, value: string) => saved.set(key, value));
		vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: write });
	});
	afterEach(() => vi.unstubAllGlobals());

	it('previews without repeated writes, saves the finished gesture, and restores/reset preferences', () => {
		const first = TestBed.inject(AssistantPositionService);
		for (const value of [12, 24, 48]) first.preview('verticalOffset', value);
		first.preview('left', 60);
		expect(write).not.toHaveBeenCalled();
		first.save();
		expect(write).toHaveBeenCalledTimes(1);
		TestBed.resetTestingModule();
		const restored = TestBed.inject(AssistantPositionService);
		expect(restored.preferences().verticalOffset).toBe(48);
		expect(restored.preferences().left).toBe(60);
		restored.reset();
		expect(restored.preferences()).toEqual(DEFAULT_ASSISTANT_POSITION);
		expect(restored.resetTick()).toBe(1);
		expect(JSON.parse(saved.get('waseet_assistant_position')!)).toEqual(DEFAULT_ASSISTANT_POSITION);
	});

	it('handles corrupt or blocked storage without preventing position changes', () => {
		saved.set('waseet_assistant_position', '{broken json');
		const position = TestBed.inject(AssistantPositionService);
		expect(position.preferences()).toEqual(DEFAULT_ASSISTANT_POSITION);
		write.mockImplementation(() => { throw new Error('blocked'); });
		position.preview('right', 36);
		expect(() => position.save()).not.toThrow();
		expect(position.preferences().right).toBe(36);
	});
});
