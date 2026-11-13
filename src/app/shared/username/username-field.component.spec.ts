import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { UsernameFieldComponent } from './username-field.component';
import { UsernameService } from '../../core/services/username.service';

describe('UsernameFieldComponent', () => {
	let fixture: ComponentFixture<UsernameFieldComponent>; let get: ReturnType<typeof vi.fn>, save: ReturnType<typeof vi.fn>;
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const type = (v: string) => { const i = q('username-field-input') as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };
	beforeEach(async () => {
		get = vi.fn(() => of({ success: true, data: { username: 'عمرو', displayName: 'عمرو' } })); save = vi.fn();
		await TestBed.configureTestingModule({ imports: [UsernameFieldComponent], providers: [{ provide: UsernameService, useValue: { get, save } }] }).compileComponents();
		fixture = TestBed.createComponent(UsernameFieldComponent); fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
	});
	it('shows the current username; a one-word username is valid; save is only enabled for a changed, valid value', () => {
		expect((q('username-field-input') as HTMLInputElement).value).toBe('عمرو');
		expect((q('username-save') as HTMLButtonElement).disabled).toBe(true);
		type('عمرو2'); expect((q('username-save') as HTMLButtonElement).disabled).toBe(false);
		type('a@b.com'); expect(q('username-problem')?.textContent).toContain('حروفًا'); expect((q('username-save') as HTMLButtonElement).disabled).toBe(true);
	});
	it('saving sends the cleaned value and tells the page (so a form that still carries the display name stays in step)', () => {
		save.mockReturnValue(of({ success: true, data: { username: 'عمرو م', displayName: 'عمرو م', changed: true } }));
		const out = vi.fn(); fixture.componentInstance.changed.subscribe(out);
		type('  عمرو   م ');
		(q('username-save') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(save).toHaveBeenCalledWith('عمرو م'); expect(out).toHaveBeenCalledWith('عمرو م');
		expect(q('username-note')?.textContent).toContain('تم حفظ');
	});
});
