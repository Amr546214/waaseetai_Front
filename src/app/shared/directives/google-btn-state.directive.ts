import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * The Google sign-in control is an invisible cross-origin iframe laid over the visible button, so the
 * parent document never gets :hover / :focus-within / pointer events for it. This mirrors those states
 * onto the wrapper as `is-hover` / `is-focus` classes, using only signals the parent does receive:
 * pointer geometry (last parent pointermove before the iframe takes over) and document.activeElement.
 */
@Directive({ selector: '.google-btn-wrapper', standalone: true })
export class GoogleBtnStateDirective implements OnInit, OnDestroy {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
	private readonly zone = inject(NgZone);
	private static readonly PAD = 6;
	private rafId = 0;
	private cleanups: Array<() => void> = [];

	ngOnInit(): void {
		this.zone.runOutsideAngular(() => {
			const on = (t: EventTarget, type: string, fn: (e: any) => void, capture = false) => {
				t.addEventListener(type, fn, { passive: true, capture });
				this.cleanups.push(() => t.removeEventListener(type, fn, { capture }));
			};
			on(document, 'pointermove', (e: PointerEvent) => this.onMove(e));
			on(document, 'mousemove', (e: MouseEvent) => this.onMove(e));
			on(document.documentElement, 'mouseleave', () => this.setHover(false));
			on(document, 'mouseleave', () => this.setHover(false));
			// Window blur is NOT a hover signal (a click into the iframe blurs the window): only re-check focus.
			for (const t of [document, window] as EventTarget[]) {
				for (const type of ['focusin', 'focusout', 'focus', 'blur']) on(t, type, () => this.checkFocus(), true);
			}
		});
	}

	ngOnDestroy(): void {
		this.cleanups.forEach(c => c());
		this.cleanups = [];
		if (this.rafId) cancelAnimationFrame(this.rafId);
	}

	private onMove(e: { clientX: number; clientY: number }): void {
		const r = this.host.getBoundingClientRect();
		const p = GoogleBtnStateDirective.PAD;
		this.setHover(e.clientX >= r.left - p && e.clientX <= r.right + p && e.clientY >= r.top - p && e.clientY <= r.bottom + p);
	}

	private setHover(on: boolean): void {
		this.host.classList.toggle('is-hover', on);
	}

	private checkFocus(): void {
		this.applyFocus();
		if (this.rafId) cancelAnimationFrame(this.rafId);
		this.rafId = requestAnimationFrame(() => { this.rafId = 0; this.applyFocus(); });
	}

	private applyFocus(): void {
		const a = document.activeElement;
		this.host.classList.toggle('is-focus', !!a && a !== document.body && this.host.contains(a));
	}
}
