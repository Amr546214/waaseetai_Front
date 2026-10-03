import { AfterViewInit, Directive, DoCheck, ElementRef, HostListener, OnDestroy, PLATFORM_ID, Renderer2, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Shared behaviour of every bio / "نبذة" textarea (all roles, setup and edit screens):
 *  - `dir="auto"` + `unicode-bidi: plaintext` (class `bio-field`) so English text is laid out LTR
 *    (full stop at the end of the sentence, not at the start of the line) and Arabic stays RTL,
 *    without changing the direction of the page;
 *  - a live counter right under the field: "123 / 500 حرف", using the field's real limit.
 *
 * Usage: `<textarea [appBioField]="500" formControlName="bio" maxlength="500"></textarea>`
 * Pass the same number as the Validators.maxLength / maxlength of that field.
 */
@Directive({
	selector: 'textarea[appBioField]',
	standalone: true,
	host: { class: 'bio-field', '[attr.dir]': '"auto"' },
})
export class BioFieldDirective implements AfterViewInit, DoCheck, OnDestroy {
	readonly max = input.required<number>({ alias: 'appBioField' });

	private readonly host = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;
	private readonly renderer = inject(Renderer2);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private counter?: HTMLElement;
	private lastText = '';

	ngAfterViewInit(): void {
		if (!this.isBrowser || !this.host.parentNode) return;
		this.counter = this.renderer.createElement('div') as HTMLElement;
		this.renderer.addClass(this.counter, 'bio-counter');
		this.renderer.setAttribute(this.counter, 'aria-live', 'polite');
		this.renderer.insertBefore(this.host.parentNode, this.counter, this.host.nextSibling);
		this.update();
	}

	// Values also change programmatically (patchValue when a saved profile loads), not only by typing.
	ngDoCheck(): void {
		this.update();
	}

	@HostListener('input')
	onInput(): void {
		this.update();
	}

	ngOnDestroy(): void {
		this.counter?.remove();
	}

	private update(): void {
		const counter = this.counter;
		if (!counter) return;
		const length = this.host.value.length;
		const max = this.max();
		const text = `${length} / ${max} حرف`;
		if (text === this.lastText) return;
		this.lastText = text;
		counter.textContent = text;
		counter.classList.toggle('is-near', length >= max * 0.9 && length <= max);
		counter.classList.toggle('is-over', length > max);
	}
}
