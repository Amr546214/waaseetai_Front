import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { BioFieldDirective } from './bio-field.directive';

@Component({
	standalone: true,
	imports: [BioFieldDirective, FormsModule],
	template: `<div id="wrap"><textarea [appBioField]="500" [ngModel]="value()" (ngModelChange)="value.set($event)"></textarea></div>`,
})
class HostComponent {
	value = signal('');
}

function setup() {
	const fixture = TestBed.createComponent(HostComponent);
	fixture.detectChanges();
	const el: HTMLElement = fixture.nativeElement;
	const textarea = el.querySelector('textarea')!;
	const counter = () => el.querySelector('.bio-counter') as HTMLElement | null;
	return { fixture, textarea, counter };
}

describe('BioFieldDirective', () => {
	it('sets dir="auto" and the shared bidi class on the textarea (page direction untouched)', () => {
		const { textarea } = setup();
		expect(textarea.getAttribute('dir')).toBe('auto');
		expect(textarea.classList.contains('bio-field')).toBe(true);
	});

	it('shows "0 / 500 حرف" under the field and updates while typing', () => {
		const { fixture, textarea, counter } = setup();
		expect(counter()?.textContent).toBe('0 / 500 حرف');
		expect(textarea.nextElementSibling).toBe(counter());
		const text = 'I build intelligent, end-to-end digital products from concept to deployment.';
		textarea.value = text;
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(counter()?.textContent).toBe(`${text.length} / 500 حرف`);
	});

	it('follows programmatic changes too (a saved profile loading)', async () => {
		const { fixture, counter } = setup();
		const text = 'أقدم خدمات تصميم وبرمجة';
		fixture.componentInstance.value.set(text);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		expect(counter()?.textContent).toBe(`${text.length} / 500 حرف`);
	});

	it('warns near the limit and when over it', () => {
		const { fixture, textarea, counter } = setup();
		textarea.value = 'x'.repeat(460);
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(counter()?.classList.contains('is-near')).toBe(true);
		textarea.value = 'x'.repeat(501);
		textarea.dispatchEvent(new Event('input'));
		fixture.detectChanges();
		expect(counter()?.classList.contains('is-over')).toBe(true);
		expect(counter()?.classList.contains('is-near')).toBe(false);
	});
});
