import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ProjectModificationsComponent } from './project-modifications.component';
import { AuthStore } from '../../../../core/store/auth.store';

// Effective amendments (client side): approving a provider request APPLIES it, an increase needs the payment code (OTP), nothing is shown as done before the API answered.
const AM = (o: Record<string, unknown> = {}) => ({
  id: 'amend-1', projectId: 'project-1', projectTitle: 'مشروع', contractId: 'contract-abcdef123', contractRef: 'CT-ABCDEF', providerId: 'provider-1', providerName: 'نورة',
  requestedByRole: 'PROVIDER', type: 'BUDGET', title: 'زيادة الميزانية', description: null, budgetDelta: 5, durationDeltaDays: null, status: 'PENDING_OTHER_PARTY',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', respondedAt: null, conversationId: 'conv-1',
  effect: 'PENDING', effectNote: 'لن يتغيّر العقد أو الضمان أو المحفظة قبل موافقة الطرف الآخر، وعند الموافقة يُطبَّق التعديل فورًا.',
  needsClientPayment: true, fundingAuthorized: false, contractPrice: 20, contractDurationDays: 14, ...o
});

describe('ProjectModificationsComponent: effective amendments', () => {
  let fixture: ComponentFixture<ProjectModificationsComponent>;
  let component: ProjectModificationsComponent;
  let get: ReturnType<typeof vi.fn>;
  let post: ReturnType<typeof vi.fn>;
  const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const click = (id: string) => { (q(id) as HTMLButtonElement).click(); fixture.detectChanges(); };

  async function setup(list: any[], postImpl: (url: string, body: any) => any = () => of({ success: true, data: {} })) {
    get = vi.fn(() => of({ success: true, data: list }));
    post = vi.fn((url: string, body: any) => postImpl(url, body));
    await TestBed.configureTestingModule({
      imports: [ProjectModificationsComponent],
      providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post } }, { provide: AuthStore, useValue: { currentUser: () => null } }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectModificationsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  }
  afterEach(() => TestBed.resetTestingModule());

  it('approving a provider INCREASE shows the financial effect first (amount, new price, new stage), then the code step; nothing is posted before the code', async () => {
    await setup([AM()]);
    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click(); fixture.detectChanges();
    const lines = q('am-effect-lines')!.textContent!.replace(/\s+/g, ' ');
    expect(lines).toContain('يُخصم من محفظة العميل'); expect(lines).toContain('5 $');
    expect(lines).toContain('20 $ ← 25 $');
    expect(lines).toContain('مرحلة جديدة في آخر العقد');
    expect(q('am-confirm')!.textContent).toContain('بعد إدخال رمز التحقق');
    expect(q('am-confirm-yes')!.textContent).toContain('متابعة إلى اعتماد الدفع');
    click('am-confirm-yes');
    expect(q('amendment-otp')).not.toBeNull();
    expect(post).not.toHaveBeenCalled(); // no respond, no OTP request until the user asks for the code
  });

  it('the full approve path: code requested, then the approval is posted WITH the code once; the list reloads from the server', async () => {
    let posts = 0;
    await setup([AM()], (url) => (url.includes('/payment-otp') ? of({ success: true, data: { otpSentTo: 'c***@x.com', expiresAt: new Date(Date.now() + 120000).toISOString(), amount: 5 } }) : (posts++, of({ success: true, data: {} }))));
    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click(); fixture.detectChanges();
    click('am-confirm-yes');
    click('amendment-otp-send');
    expect(String(post.mock.calls[0][0])).toContain('/client/projects/amendments/amend-1/payment-otp');
    expect(q('amendment-otp-sent')!.textContent).toContain('c***@x.com');
    const input = q('amendment-otp-input') as HTMLInputElement;
    input.value = '123456'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    click('amendment-otp-confirm');
    await fixture.whenStable(); fixture.detectChanges();
    const respond = post.mock.calls.find(c => String(c[0]).includes('/respond'))!;
    expect(respond[0]).toContain('/client/projects/amendments/amend-1/respond');
    expect(respond[1]).toEqual({ decision: 'approve', otpCode: '123456' });
    expect(posts).toBe(1);
    expect(get).toHaveBeenCalledTimes(2); // reload after success, never a locally faked status
  });

  it('a wrong code / a short wallet keep the step open with the real message; the wallet shortfall offers the deposit link; no success is shown', async () => {
    await setup([AM()], (url) => (url.includes('/payment-otp') ? of({ success: true, data: { otpSentTo: 'c***@x.com', expiresAt: new Date(Date.now() + 120000).toISOString(), amount: 5 } })
      : throwError(() => ({ status: 409, error: { message: 'رصيد المحفظة غير كافٍ لتمويل زيادة الميزانية', errors: [{ required: 5, available: 2, shortfall: 3 }] } }))));
    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click(); fixture.detectChanges();
    click('am-confirm-yes'); click('amendment-otp-send');
    const input = q('amendment-otp-input') as HTMLInputElement;
    input.value = '123456'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    click('amendment-otp-confirm');
    await fixture.whenStable(); fixture.detectChanges();
    expect(q('amendment-otp-insufficient')!.textContent).toContain('الناقص 3 $');
    expect((q('amendment-otp-deposit') as HTMLAnchorElement).getAttribute('href')).toContain('/client-overview/finance/wallet');
    expect(get).toHaveBeenCalledTimes(1);
    expect(component.amendments()[0].status).toBe('PENDING_OTHER_PARTY');
  });

  it('the code input only accepts 6 digits; confirm with an incomplete code sends nothing and says why under the box', async () => {
    await setup([AM()], () => of({ success: true, data: { otpSentTo: 'c***@x.com', expiresAt: new Date(Date.now() + 120000).toISOString(), amount: 5 } }));
    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click(); fixture.detectChanges();
    click('am-confirm-yes'); click('amendment-otp-send');
    const input = q('amendment-otp-input') as HTMLInputElement;
    input.value = '12ab34'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    // the button is never silently dead: pressing it with a short code explains under the box and sends nothing
    expect((q('amendment-otp-confirm') as HTMLButtonElement).disabled).toBe(false);
    (q('amendment-otp-confirm') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(q('amendment-otp-code-error')!.textContent).toContain('6 أرقام');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    input.value = '1234567'; input.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(component).toBeTruthy();
    expect((q('amendment-otp-confirm') as HTMLButtonElement).disabled).toBe(false);
  });

  it('approving a NON-money amendment (duration) needs no code: it shows the effect and posts the plain decision', async () => {
    await setup([AM({ type: 'DURATION', budgetDelta: null, durationDeltaDays: 3, needsClientPayment: false })]);
    (fixture.nativeElement.querySelector('.dp-appr-btn') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(q('am-effect-lines')!.textContent).toContain('14 ← 17 يومًا');
    click('am-confirm-yes');
    expect(q('amendment-otp')).toBeNull();
    expect(post.mock.calls[0][1]).toEqual({ decision: 'approve' });
  });

  it('rejecting says nothing changes and posts only the decision', async () => {
    await setup([AM()]);
    (fixture.nativeElement.querySelector('.dp-rej-btn') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(q('am-confirm')!.textContent).toContain('ولن يتغير شيء في العقد أو المحفظة');
    expect(q('am-effect-lines')).toBeNull();
    click('am-confirm-yes');
    expect(post.mock.calls[0][1]).toEqual({ decision: 'reject' });
  });

  it('a client-raised INCREASE: the card says the provider cannot approve before the payment authorization, offers it, and offers cancel (no hidden buttons)', async () => {
    await setup([AM({ requestedByRole: 'CLIENT' })]);
    expect(q('am-funding-needed')!.textContent).toContain('لا يُخصم شيء الآن');
    expect(q('am-authorize')).not.toBeNull();
    expect(q('am-cancel')).not.toBeNull();
    click('am-authorize');
    expect(q('amendment-otp-intro')!.textContent).toContain('لا يُخصم شيء الآن');
    expect(post).not.toHaveBeenCalled();
  });

  it('authorized client-raised increase: shows that nothing is charged before the provider approves; cancel posts to the cancel endpoint', async () => {
    await setup([AM({ requestedByRole: 'CLIENT', fundingAuthorized: true })]);
    expect(q('am-funding-ok')!.textContent).toContain('لا يُخصم شيء من محفظتك قبل موافقة مقدم الخدمة');
    expect(q('am-authorize')).toBeNull();
    click('am-cancel');
    expect(String(post.mock.calls[0][0])).toContain('/client/projects/amendments/amend-1/cancel');
  });

  it('an APPLIED row reads «طُبّق على العقد» (never the record-only wording) and a LEGACY approved row keeps the record-only wording', async () => {
    await setup([
      AM({ id: 'a', createdAt: '2026-01-03T00:00:00Z', status: 'APPROVED', effect: 'APPLIED', effectNote: 'طُبّق التعديل على العقد والضمان والمراحل.', appliedAt: '2026-02-01T00:00:00Z' }),
      AM({ id: 'b', status: 'APPROVED', effect: 'RECORD_ONLY', effectNote: 'القرار يُسجَّل للمتابعة فقط ولا يغيّر سعر العقد أو مدته أو الضمان حاليًا.', needsClientPayment: false })
    ]);
    const cards = Array.from(fixture.nativeElement.querySelectorAll('.dp-card')) as HTMLElement[];
    expect(cards[0].textContent).toContain('طُبّق على العقد');
    expect(cards[0].textContent).not.toContain('للمتابعة فقط');
    expect(cards[1].textContent).toContain('مُسجَّل — لا يغيّر العقد');
    expect(cards[1].textContent).toContain('للمتابعة فقط');
    expect(component.timelineSteps(component.amendments()[0]).map(s => s.label)[2]).toBe('طُبّق على العقد');
  });

  it('static: no screen hardcodes the record-only claim any more; the legacy wording only comes from the shared helper', () => {
    const html = readFileSync(join(__dirname, 'project-modifications.component.html'), 'utf8');
    const ts = readFileSync(join(__dirname, 'project-modifications.component.ts'), 'utf8');
    expect(html).not.toContain('يُسجَّل هنا فقط');
    expect(ts).not.toContain('AMENDMENT_CONFIRM_TEXT');
    expect(ts).not.toContain('AMENDMENT_RECORDED_BADGE');
  });
});
