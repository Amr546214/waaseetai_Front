import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { ParsedSvgIcon, paintGroupAttrs } from '../../../../../core/identity/identity-ai-icon';

/**
 * Draws an already-parsed (server-sanitised, client-sanitised again by parseCustomSvg) icon INSIDE an <svg> so `currentColor` follows the text colour exactly like on the site, with the same paint rule (the file's own fill/stroke, nothing invented). An <img> could not:
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
			if (!icon) return;
			svg.setAttribute('viewBox', icon.viewBox);
			// same rule as the site (AiIconRuntime.replace): a <g> that resets the inherited paint to the SVG initial values, then the file's own declarations
			const g = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
			for (const [k, v] of Object.entries(paintGroupAttrs(icon))) g.setAttribute(k, v);
			svg.appendChild(g);
			for (const c of icon.children) g.appendChild(svg.ownerDocument.importNode(c, true));
		});
	}
}
