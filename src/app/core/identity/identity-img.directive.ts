import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import { SiteIdentityService } from './site-identity.service';

/**
 * `<img [wsIdentityImg]="'logo.mark'" src="/images/waseet-mark.png" ...>` — an attribute directive, NOT a replacement element: the template keeps its own `src`
 * (the built-in default, exactly as before) and every other attribute / class / style. Only while the key has a published custom version is `src` swapped, and the original
 * `src` is put back the moment it is not (rollback, unpublished, asset 404). A failed custom image falls back to the default at once (no broken image).
 */
@Directive({ selector: 'img[wsIdentityImg]', standalone: true })
export class IdentityImgDirective {
	readonly wsIdentityImg = input.required<string>();
	private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
	private readonly renderer = inject(Renderer2);
	private readonly identity = inject(SiteIdentityService);
	private original: string | null = null;

	constructor() {
		this.el.addEventListener('error', () => {
			const cur = this.el.getAttribute('src') ?? '';
			if (this.original !== null && cur !== this.original) this.identity.reportBroken(cur);
		});
		effect(() => {
			const custom = this.identity.customUrl(this.wsIdentityImg());
			if (this.original === null) this.original = this.el.getAttribute('src') ?? '';
			const want = custom ?? this.original;
			if ((this.el.getAttribute('src') ?? '') !== want) this.renderer.setAttribute(this.el, 'src', want);
		});
	}
}
