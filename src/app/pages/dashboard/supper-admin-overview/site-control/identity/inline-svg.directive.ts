import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { ParsedSvgIcon } from '../../../../../core/identity/identity-ai-icon';

/** the paint the site gives the AI mark when the custom file does not set its own (same rule as AiIconRuntime: the symbol keeps its attributes, a custom root attribute wins) */
const DEFAULT_PAINT: Record<string, string> = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };

/**
 * Draws an already-parsed (server-sanitised, client-sanitised again by parseCustomSvg) icon INSIDE an <svg> so it inherits `currentColor` exactly like the site does. An <img> could not:
 * an SVG in an <img> cannot see the page's text colour. Nodes are cloned into the element, never injected as HTML text.
 */
@Directive({ selector: 'svg[scInlineSvg]', standalone: true })
export class InlineSvgDirective {
	private readonly el = inject<ElementRef<SVGElement>>(ElementRef);
	readonly icon = input<ParsedSvgIcon | null>(null, { alias: 'scInlineSvg' });

	constructor() {
		effect(() => {
			const svg = this.el.nativeElement, icon = this.icon();
			svg.replaceChildren();
			for (const a of Object.keys(DEFAULT_PAINT)) svg.removeAttribute(a);
			if (!icon) return;
			svg.setAttribute('viewBox', icon.viewBox);
			for (const [k, v] of Object.entries({ ...DEFAULT_PAINT, ...icon.attrs })) svg.setAttribute(k, v);
			for (const c of icon.children) svg.appendChild(svg.ownerDocument.importNode(c, true));
		});
	}
}
