import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, effect, inject } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { SiteIdentityService } from './site-identity.service';

export const TOKENS_STYLE_ID = 'ws-identity-tokens';

/**
 * Design-token overrides (colours / layout / font of the platform), published through the identity pipeline. The server sends the ready CSS (`tokensCss`, only validated tokens); this applier puts it
 * into ONE <style id="ws-identity-tokens"> at the END of <head> (after the app stylesheet, so the overrides win by specificity without !important) and ONLY while overrides exist:
 * with none the element does not exist and the site is byte-identical to what ships.
 *  - server render: applyNow() runs after the manifest was read, so the style is part of the first HTML (no flash, no dependence on browser storage);
 *  - static host: index.html's boot script injects the remembered CSS before first paint; this applier then takes the same element over;
 *  - failure / unknown state: the service keeps the last good manifest, so the last good CSS stays.
 * The CSS is set as TEXT (never markup) and was re-validated by safeTokensCss().
 */
@Injectable({ providedIn: 'root' })
export class IdentityTokensRuntime {
	private readonly identity = inject(SiteIdentityService);
	private readonly doc = inject(DOCUMENT);
	private readonly injector = inject(Injector);
	private started = false;
	private readonly appRef = inject(ApplicationRef);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

	start(): void {
		if (this.started) return;
		this.started = true;
		this.applyNow();
		effect(() => { this.write(this.identity.tokensCss()); }, { injector: this.injector });
		// component styles are appended to <head> while the app renders: once stable, move the element to the very end again
		if (this.browser) void this.appRef.whenStable().then(() => this.applyNow());
	}

	/** apply the service's current CSS right now (server render, after the manifest was loaded) */
	applyNow(): void { this.write(this.identity.tokensCss()); }

	private write(css: string): void {
		const head = this.doc.head;
		if (!head) return;
		let el = this.doc.getElementById(TOKENS_STYLE_ID);
		if (!css) { el?.remove(); return; }
		if (!el) { el = this.doc.createElement('style'); el.id = TOKENS_STYLE_ID; }
		if (el.textContent !== css) el.textContent = css;
		// always the LAST element of <head>: later-added stylesheets (lazy styles) must not end up after it
		if (el.parentNode !== head || head.lastElementChild !== el) head.appendChild(el);
	}
}
