import { AssistantViewport } from './assistant-placement';

export interface AssistantPositionPreferences {
	verticalOffset: number;
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export interface AssistantMovementBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export const DEFAULT_ASSISTANT_POSITION: Readonly<AssistantPositionPreferences> = {
	verticalOffset: 0, top: 12, bottom: 12, left: 12, right: 12,
};

export function cleanAssistantPosition(value: unknown): AssistantPositionPreferences {
	const source = value && typeof value === 'object' ? value as Partial<AssistantPositionPreferences> : {};
	const number = (field: keyof AssistantPositionPreferences, minimum: number) => {
		const candidate = source[field];
		return typeof candidate === 'number' && Number.isFinite(candidate)
			? Math.round(Math.max(minimum, Math.min(240, candidate)))
			: DEFAULT_ASSISTANT_POSITION[field];
	};
	return { verticalOffset: number('verticalOffset', -240), top: number('top', 0), bottom: number('bottom', 0), left: number('left', 0), right: number('right', 0) };
}

/** Scale excessive margins together so the character always has a valid visible area. */
export function avatarMovementBounds(viewport: AssistantViewport, size: number, preferences: AssistantPositionPreferences, floorOffset = 0): AssistantMovementBounds {
	const prefs = cleanAssistantPosition(preferences);
	const width = Math.max(0, viewport.width - size);
	const height = Math.max(0, viewport.height - size);
	const horizontalScale = Math.min(1, width / Math.max(1, prefs.left + prefs.right));
	const lowerSpace = prefs.bottom + 54 + Math.max(0, floorOffset);
	const verticalScale = Math.min(1, height / Math.max(1, prefs.top + lowerSpace));
	const minX = viewport.left + prefs.left * horizontalScale;
	const minY = viewport.top + prefs.top * verticalScale;
	return {
		minX, maxX: Math.max(minX, viewport.left + width - prefs.right * horizontalScale),
		minY, maxY: Math.max(minY, viewport.top + height - lowerSpace * verticalScale),
	};
}
