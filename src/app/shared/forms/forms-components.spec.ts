import { ChangeDetectorRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { UiNotificationService } from '../../core/services/ui-notification.service';
import { NotificationHostComponent } from './notification-host.component';
import { FormSummaryComponent } from './form-summary.component';
import { SubmitButtonComponent } from './submit-button.component';

describe('NotificationHostComponent', () => {
	it('renders toasts and the banner from the service, with alert/status roles and a dismiss button', () => {
		const f = TestBed.configureTestingModule({ imports: [NotificationHostComponent] }).createComponent(NotificationHostComponent);
		const svc = TestBed.inject(UiNotificationService);
		svc.error('فشل الحفظ', { duration: 0 });
		svc.success('تم', { duration: 0 });
		svc.showBanner('warning', 'قيد المراجعة', { title: 'تنبيه' });
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		const toasts = el.querySelectorAll('[data-testid="ui-toast"]');
		expect(toasts.length).toBe(2);
		expect(toasts[0].getAttribute('role')).toBe('alert');
		expect(toasts[1].getAttribute('role')).toBe('status');
		expect(el.querySelector('[data-testid="ui-banner"]')?.textContent).toContain('قيد المراجعة');

		(toasts[0].querySelector('button') as HTMLButtonElement).click();
		f.detectChanges();
		expect(el.querySelectorAll('[data-testid="ui-toast"]').length).toBe(1);
		svc.clearAll();
	});
});

describe('FormSummaryComponent', () => {
	it('is empty with no items; lists label + reason and emits the clicked item', () => {
		const f = TestBed.configureTestingModule({ imports: [FormSummaryComponent] }).createComponent(FormSummaryComponent);
		f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid="form-summary"]')).toBeNull();

		const picked = vi.fn();
		f.componentInstance.select.subscribe(picked);
		const item = { path: 'a', label: 'الاسم', message: 'الاسم مطلوب' };
		f.componentRef.setInput('items', [item]);
		f.detectChanges();
		const box = f.nativeElement.querySelector('[data-testid="form-summary"]') as HTMLElement;
		expect(box.getAttribute('role')).toBe('alert');
		expect(box.textContent).toContain('أكمل الحقول التالية');
		expect(box.textContent).toContain('الاسم مطلوب');
		(box.querySelector('li button') as HTMLButtonElement).click();
		expect(picked).toHaveBeenCalledWith(item);
	});
});

@Component({
	standalone: true,
	imports: [SubmitButtonComponent],
	template: `<ws-submit-button label="حفظ" [submitting]="submitting()" [disabledReason]="reason()" />`,
})
class SubmitHost {
	submitting = signal(false);
	reason = signal<string | null>(null);
}

describe('SubmitButtonComponent (never silently disabled)', () => {
	const setup = () => {
		const f = TestBed.configureTestingModule({ imports: [SubmitHost] }).createComponent(SubmitHost);
		f.detectChanges();
		const q = () => f.nativeElement.querySelector('button') as HTMLButtonElement;
		const reason = () => f.nativeElement.querySelector('[data-testid="disabled-reason"]') as HTMLElement | null;
		return { f, q, reason };
	};

	it('is enabled by default and shows no reason (an invalid form is not a reason to disable)', () => {
		const { q, reason } = setup();
		expect(q().disabled).toBe(false);
		expect(q().textContent?.trim()).toBe('حفظ');
		expect(reason()).toBeNull();
	});

	it('while submitting: disabled, busy, and the label changes', () => {
		const { f, q } = setup();
		f.componentInstance.submitting.set(true);
		f.detectChanges();
		expect(q().disabled).toBe(true);
		expect(q().getAttribute('aria-busy')).toBe('true');
		expect(q().textContent?.trim()).toBe('جارٍ الإرسال...');
	});

	it('with a disabledReason: disabled AND the reason is visible and linked via aria-describedby', () => {
		const { f, q, reason } = setup();
		f.componentInstance.reason.set('بانتظار مراجعة طلبك السابق');
		f.detectChanges();
		expect(q().disabled).toBe(true);
		expect(reason()?.textContent).toContain('بانتظار مراجعة');
		expect(q().getAttribute('aria-describedby')).toBe(reason()!.id);
	});
});

import { FormControl, Validators } from '@angular/forms';
import { FieldErrorComponent } from './field-error.component';

describe('FieldErrorComponent', () => {
	const setup = (control: FormControl, inputs: Record<string, any> = {}) => {
		TestBed.resetTestingModule();
		const f = TestBed.configureTestingModule({ imports: [FieldErrorComponent] }).createComponent(FieldErrorComponent);
		f.componentRef.setInput('control', control);
		for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
		f.detectChanges();
		return { f, el: () => f.nativeElement.querySelector('[data-testid="field-error"]') as HTMLElement | null };
	};

	it('shows nothing while pristine/untouched, even if invalid', () => {
		const { el } = setup(new FormControl('', Validators.required), { label: 'الاسم' });
		expect(el()).toBeNull();
	});

	it('shows the Arabic message once touched and invalid, and hides it when fixed', () => {
		const c = new FormControl('', Validators.required);
		const { f, el } = setup(c, { label: 'الاسم' });
		c.markAsTouched();
		f.componentRef.injector.get(ChangeDetectorRef).markForCheck(); f.detectChanges();
		expect(el()?.textContent).toContain('الاسم مطلوب');
		expect(el()?.getAttribute('role')).toBe('alert');
		c.setValue('x');
		f.componentRef.injector.get(ChangeDetectorRef).markForCheck(); f.detectChanges();
		expect(el()).toBeNull();
	});

	it('per-key custom messages win; a server error wins over validators', () => {
		const c = new FormControl(false, Validators.requiredTrue);
		c.markAsTouched();
		const { el } = setup(c, { messages: { required: 'يجب الموافقة للمتابعة' } });
		expect(el()?.textContent).toContain('يجب الموافقة للمتابعة');
		const s = new FormControl('x'); s.setErrors({ server: 'مستخدم مسبقًا' }); s.markAsTouched();
		const { el: el2 } = setup(s);
		expect(el2()?.textContent).toContain('مستخدم مسبقًا');
	});
});
