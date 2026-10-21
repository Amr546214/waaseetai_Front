import { Injectable, signal } from '@angular/core';

/**
 * Where the panel's design tokens are applied. The source panel wrote every token (--pg, --txt, --teal ...) on `document.documentElement`, which would recolour the WHOLE platform
 * (the platform defines the same variable names). Here they are written ONLY on the section's own host element (set by the section shell); with no host (not mounted) they go to a
 * detached element, so nothing can ever reach the live site from this panel.
 */
@Injectable({ providedIn: 'root' })
export class SiteControlScope {
	private readonly host = signal<HTMLElement | null>(null);
	private readonly detached: HTMLElement | null = typeof document !== 'undefined' ? document.createElement('div') : null;

	setHost(el: HTMLElement | null): void { this.host.set(el); }

	/** the style object that receives the tokens (the section host, or a detached element) */
	style(): CSSStyleDeclaration {
		return (this.host() ?? this.detached ?? ({ setProperty() { /* no DOM (SSR) */ } } as unknown as HTMLElement)).style;
	}
}
