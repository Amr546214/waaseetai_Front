import { installMemoryStorage } from '../../core/wait/memory-storage.testkit';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AmendmentPaymentOtpComponent } from './amendment-payment-otp.component';

// emailSent:false from the backend = the mail server did not take the code: no code box, no "sent", an honest message, and asking again works.
let restore: () => void = () => undefined;
beforeEach(() => { restore = installMemoryStorage(); });
afterEach(() => { restore(); TestBed.resetTestingModule(); });

it('a known mail failure shows the message and keeps the screen on the send step', async () => {
	const answers = [{ success: true, data: { otpSentTo: 'a***@x.com', expiresAt: new Date(Date.now() + 120000).toISOString(), amount: 5, emailSent: false } },
		{ success: true, data: { otpSentTo: 'a***@x.com', expiresAt: new Date(Date.now() + 120000).toISOString(), amount: 5, emailSent: true } }];
	const http = { post: vi.fn(() => of(answers.shift())), get: vi.fn() };
	await TestBed.configureTestingModule({ imports: [AmendmentPaymentOtpComponent], providers: [provideRouter([]), { provide: HttpClient, useValue: http }] }).compileComponents();
	const f = TestBed.createComponent(AmendmentPaymentOtpComponent);
	f.componentRef.setInput('amendmentId', 'am-1'); f.componentRef.setInput('mode', 'respond'); f.componentRef.setInput('amount', 5);
	f.detectChanges();
	const q = (id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	(q('amendment-otp-send') as HTMLButtonElement).click(); f.detectChanges();
	expect(q('amendment-otp-input')).toBeNull();
	expect(f.nativeElement.textContent).toContain('تعذر إرسال رمز التحقق إلى بريدك الآن');
	(q('amendment-otp-send') as HTMLButtonElement).click(); f.detectChanges();
	expect(q('amendment-otp-input')).not.toBeNull();
});
