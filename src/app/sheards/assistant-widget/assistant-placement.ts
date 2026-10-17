export interface AssistantViewport {
	width: number;
	height: number;
	left: number;
	top: number;
}

export interface AssistantAnchor {
	x: number;
	y: number;
	size: number;
}

/** Keep the dock on the visible floor, independently of the avatar's drag height. */
export function dockPlacement(
	viewport: AssistantViewport,
	anchor: AssistantAnchor,
	lift = 0,
	width = 348,
): Record<string, string> {
	const padding = Math.min(12, viewport.width / 4);
	const actualWidth = Math.min(width, viewport.width - padding * 2);
	const left = Math.max(viewport.left + padding, Math.min(
		viewport.left + viewport.width - actualWidth - padding,
		anchor.x + anchor.size / 2 - actualWidth / 2,
	));
	const floorOffset = Math.min(12 + Math.max(0, lift), Math.max(12, viewport.height - 48));
	return {
		position: 'fixed', left: `${left}px`, top: 'auto', right: 'auto',
		bottom: `calc(100dvh - ${viewport.top + viewport.height}px + ${floorOffset}px)`,
		width: `${actualWidth}px`,
	};
}

/** Prefer above the avatar; use the space below when dragging near the top edge. */
export function popupPlacement(
	viewport: AssistantViewport,
	anchor: AssistantAnchor,
	width = 360,
	maximumHeight = 460,
): Record<string, string> {
	const padding = Math.min(12, viewport.width / 4, viewport.height / 4);
	const actualWidth = Math.min(width, viewport.width - padding * 2);
	const left = Math.max(viewport.left + padding, Math.min(
		viewport.left + viewport.width - actualWidth - padding,
		anchor.x + anchor.size / 2 - actualWidth / 2,
	));
	const ceiling = viewport.top + padding;
	const floor = viewport.top + viewport.height - padding;
	const aboveEnd = Math.max(ceiling, Math.min(floor, anchor.y - 8));
	const belowStart = Math.max(ceiling, Math.min(floor, anchor.y + anchor.size + 8));
	const above = aboveEnd - ceiling;
	const below = floor - belowStart;
	const useAbove = above >= Math.min(180, maximumHeight) || above >= below;
	const height = Math.max(1, Math.min(maximumHeight, useAbove ? above : below));
	return {
		position: 'fixed', left: `${left}px`, right: 'auto', width: `${actualWidth}px`, maxHeight: `${height}px`,
		...(useAbove ? { top: 'auto', bottom: `calc(100dvh - ${aboveEnd}px)` } : { top: `${belowStart}px`, bottom: 'auto' }),
	};
}
