import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, Injector, PLATFORM_ID, effect, inject } from '@angular/core';
import { SiteIdentityService } from './site-identity.service';

const KEY = 'favicon.tab';

/**
 * Updates the tab icon from the manifest. With no custom `favicon.tab` NOTHING happens: index.html's own <link rel="icon" type="image/png" href="assets/brand/waseet-mark.png"> stays
 * exactly as shipped. While a custom one is published the same <link> element gets the new href (+ the real mime as `type`); on rollback its original href/type are restored.
 */
@Injectable({ providedIn: 'root' })
export class FaviconRuntime {
	private readonly identity = inject(SiteIdentityService);
	private readonly doc = inject(DOCUMENT);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly injector = inject(Injector);
	private original: { href: string | null; type: string | null } | null = null;

	start(): void {
		if (!this.browser) return;
		effect(() => this.apply(this.identity.item(KEY) ? this.identity.customUrl(KEY) : null, this.identity.item(KEY)?.mime ?? ''), { injector: this.injector });
	}

	apply(customUrl: string | null, mime: string): void {
		const link = this.doc.querySelector<HTMLLinkElement>('link[rel~="icon"]');
		if (!link) return;
		if (customUrl) {
			if (!this.original) this.original = { href: link.getAttribute('href'), type: link.getAttribute('type') };
			if (link.getAttribute('href') !== customUrl) link.setAttribute('href', customUrl);
			if (mime) link.setAttribute('type', mime);
		} else if (this.original) {
			if (this.original.href === null) link.removeAttribute('href'); else link.setAttribute('href', this.original.href);
			if (this.original.type === null) link.removeAttribute('type'); else link.setAttribute('type', this.original.type);
			this.original = null;
		}
	}
}
