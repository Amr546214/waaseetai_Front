import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import { DisputeModal } from './dispute-modal';

describe('DisputeModal server error', () => {
	function setup(errorMessage: string) {
		const fixture = TestBed.createComponent(DisputeModal);
		fixture.componentRef.setInput('open', true);
		fixture.componentRef.setInput('errorMessage', errorMessage);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	it('shows the server rejection message inside the dialog', () => {
		const el = setup('لا تملك صلاحية هذا الطلب');
		const box = el.querySelector('[role="dialog"] [data-testid="dispute-server-error"]');
		expect(box?.textContent?.trim()).toBe('لا تملك صلاحية هذا الطلب');
	});

	it('shows no server error block when there is none', () => {
		const el = setup('');
		expect(el.querySelector('[data-testid="dispute-server-error"]')).toBeNull();
	});
});
