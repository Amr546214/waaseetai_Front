import { ChangeDetectorRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProfileSetup } from './profile-setup';
import { MarketerProfileService } from '../../../../../core/services/marketer-profile.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FormA11ySyncService } from '../../../../../shared/forms/form-a11y-sync.service';
import { marketingChannelProblem } from '../../../../../core/utils/marketing-channel';

// Marketer setup (owner decision): the bio is REQUIRED and at least ONE VALID marketing channel is required (no platform forced, one is enough). Red Arabic message under
// the bio and under the channel control, first error focused, no visible aggregate box, aria on the real control, text kept, errors clear on correction. PayPal stays optional.
describe('marketer setup: bio and one valid channel are required', () => {
  let fixture: ComponentFixture<ProfileSetup>;
  let c: ProfileSetup;
  let svc: { getProfile: any; updateMarketingInfo: any; addChannel: any; updatePaypalPayout: any };
  const profile = (over: any = {}) => ({ success: true, data: { marketingChannels: [], completionPercentage: 0, bio: '', user: {}, ...over } });

  async function mount(p = profile()) {
    svc = { getProfile: vi.fn(() => of(p)), updateMarketingInfo: vi.fn(() => of({ success: true })), addChannel: vi.fn(() => of({ success: true })), updatePaypalPayout: vi.fn(() => of({ success: true })) };
    await TestBed.configureTestingModule({ imports: [ProfileSetup], providers: [provideRouter([]), { provide: MarketerProfileService, useValue: svc }] }).compileComponents();
    fixture = TestBed.createComponent(ProfileSetup);
    c = fixture.componentInstance;
    fixture.detectChanges();
  }
  afterEach(() => { TestBed.inject(UiNotificationService).clearAll(); fixture?.destroy(); TestBed.resetTestingModule(); });
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  const el = () => fixture.nativeElement as HTMLElement;
  const errors = () => Array.from(el().querySelectorAll('[data-testid="field-error"]')).map(e => e.textContent?.trim() || '');
  const visibleBox = () => { const s = el().querySelector('[data-testid="form-summary"]') as HTMLElement | null; return !!s && getComputedStyle(s).position !== 'absolute' && s.offsetHeight > 0 && getComputedStyle(s).clip !== 'rect(0px, 0px, 0px, 0px)'; };

  it('bio step: empty and whitespace-only are refused under the bio with aria, nothing is sent, the focus is on the bio, no visible summary box', async () => {
    await mount();
    document.body.appendChild(el());
    TestBed.inject(FormA11ySyncService).start(document); // the app root starts it (aria-invalid / describedby for every invalid control)
    c.currentStep.set(2); render();
    for (const value of ['', '   ', ' ​']) {
      c.marketingForm.get('bio')!.setValue(value);
      c.saveBio(); render();
      expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
      expect(errors()).toContain('الوصف التسويقي مطلوب');
    }
    TestBed.inject(FormA11ySyncService).sync(document);
    const bio = el().querySelector('#ps-bio') as HTMLTextAreaElement;
    expect(bio.getAttribute('aria-required')).toBe('true');
    expect(bio.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(bio);
    expect(el().querySelector('label[for="ps-bio"] .ws-req')).not.toBeNull();
    expect(visibleBox()).toBe(false);
    el().remove();
  });

  it('bio step: typing a bio clears the message and keeps the text; the save sends it with setup:true', async () => {
    await mount();
    c.currentStep.set(2); render();
    c.saveBio(); render();
    expect(errors().length).toBe(1);
    c.marketingForm.get('bio')!.setValue('وصف تسويقي مختصر'); render();
    expect(errors()).toEqual([]);
    c.saveBio();
    expect(svc.updateMarketingInfo).toHaveBeenCalledWith({ bio: 'وصف تسويقي مختصر', setup: true });
  });

  it('«التالي» and the bar cannot pass the bio step without a SAVED bio; typed-but-unsaved says to save it; with a saved bio they pass', async () => {
    await mount();
    c.currentStep.set(2); render();
    c.skipNext(); render();
    expect(c.currentStep()).toBe(2);
    expect(errors()).toContain('الوصف التسويقي مطلوب');
    c.marketingForm.get('bio')!.setValue('نص مكتوب غير محفوظ'); render();
    c.skipNext(); render();
    expect(c.currentStep()).toBe(2);
    expect(errors().some(t => t.includes('اضغط «حفظ ومتابعة»'))).toBe(true);
    c.currentStep.set(1);
    c.setStep(4); render();
    expect(c.currentStep()).toBe(2);               // the bar stops at the first required step
    c.profile.set({ ...(c.profile() as any), bio: 'محفوظ' });
    c.setStep(3); render();
    expect(c.currentStep()).toBe(3);
    expect(svc.updateMarketingInfo).not.toHaveBeenCalled();
  });

  it('channel step with no channel: «التالي» shows the message under the channel control (red box, aria-describedby, focus on the platform), nothing is sent', async () => {
    await mount(profile({ bio: 'وصف' }));
    document.body.appendChild(el());
    c.currentStep.set(3); render();
    c.skipNext(); render();
    expect(c.currentStep()).toBe(3);
    expect(el().querySelector('[data-testid="channel-required"]')?.textContent).toContain('أضف قناة تسويق واحدة صالحة على الأقل');
    expect(el().querySelector('#ps-channels')!.classList.contains('has-error')).toBe(true);
    const select = el().querySelector('select[formcontrolname="platform"]') as HTMLSelectElement;
    expect(select.getAttribute('aria-describedby')).toBe('ps-channel-required');
    expect(document.activeElement).toBe(select);
    expect(svc.addChannel).not.toHaveBeenCalled();
    // choosing a platform / typing clears the group message
    c.channelForm.patchValue({ platform: 'TIKTOK' }); render();
    expect(el().querySelector('[data-testid="channel-required"]')).toBeNull();
    el().remove();
  });

  it('one channel already saved: «التالي» passes without adding another (one is enough, no platform forced)', async () => {
    await mount(profile({ bio: 'وصف', marketingChannels: [{ id: 'c1', platform: 'WHATSAPP', handle: '+966500000000' }] }));
    c.currentStep.set(3); render();
    c.skipNext(); render();
    expect(c.currentStep()).toBe(4);
  });

  it('channel validity (same rule as the server): invalid values get a specific message under the handle and are not sent; valid ones of ANY platform are sent with setup:true', async () => {
    await mount(profile({ bio: 'وصف' }));
    c.currentStep.set(3); render();
    const cases: [string, string, string][] = [['INSTAGRAM', 'two words', 'مسافات'], ['YOUTUBE', 'https://evil.example/x', 'لا يخص'], ['WHATSAPP', 'abc', 'واتساب'], ['TIKTOK', 'javascript:alert(1)', 'غير صالح'], ['TWITTER', '', 'أدخل معرّف القناة']];
    for (const [platform, handle, part] of cases) {
      c.channelForm.setValue({ platform, handle }); c.addChannel(); render();
      expect(svc.addChannel, `${platform} ${handle}`).not.toHaveBeenCalled();
      expect(errors().some(t => t.includes(part)), `${platform} ${handle}: ${errors().join('|')}`).toBe(true);
    }
    // a different platform re-judges the typed value
    c.channelForm.setValue({ platform: 'INSTAGRAM', handle: 'https://x.com/amr' }); render();
    expect(c.channelForm.get('handle')!.invalid).toBe(true);
    c.channelForm.get('platform')!.setValue('TWITTER');
    expect(c.channelForm.get('handle')!.valid).toBe(true);
    c.addChannel();
    expect(svc.addChannel).toHaveBeenCalledWith({ platform: 'TWITTER', handle: 'https://x.com/amr', setup: true });
  });

  it('server errors land under the right place: bio on the bio, handle on the channel handle; a 500 is a general message that marks no healthy field', async () => {
    await mount();
    c.currentStep.set(2); render();
    c.marketingForm.get('bio')!.setValue('وصف تسويقي');
    svc.updateMarketingInfo.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'x', errors: [{ field: 'bio', path: 'bio', message: 'الوصف التسويقي مطلوب' }] } })));
    c.saveBio(); render();
    expect(c.marketingForm.get('bio')!.errors?.['server']).toBeTruthy();
    expect(errors()).toContain('الوصف التسويقي مطلوب');
    c.currentStep.set(3); render();
    c.channelForm.setValue({ platform: 'INSTAGRAM', handle: '@amr' });
    svc.addChannel.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'x', errors: [{ field: 'handle', path: 'handle', message: 'معرّف القناة غير صالح' }] } })));
    c.addChannel(); render();
    expect(c.channelForm.get('handle')!.errors?.['server']).toBeTruthy();
    // a 500: one general toast, no healthy field is marked
    svc.addChannel.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Internal Server Error' } })));
    c.channelForm.setValue({ platform: 'TIKTOK', handle: 'okname' });
    c.addChannel(); render();
    expect(TestBed.inject(UiNotificationService).toasts().length).toBeGreaterThan(0);
    expect(c.channelForm.get('handle')!.invalid).toBe(false);
    expect(c.channelForm.get('platform')!.invalid).toBe(false);
  });

  it('finishing needs the two required items: without them it goes to the step and shows the message; PayPal is not required', async () => {
    await mount();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    c.currentStep.set(5);
    c.finish(); render();
    expect(c.currentStep()).toBe(2);
    expect(nav).not.toHaveBeenCalled();
    c.profile.set({ ...(c.profile() as any), bio: 'محفوظ' });
    c.finish(); render();
    expect(c.currentStep()).toBe(3);
    expect(el().querySelector('[data-testid="channel-required"]')).not.toBeNull();
  });

  it('marketingChannelProblem is one rule (null = valid)', () => {
    expect(marketingChannelProblem('INSTAGRAM', '@ok')).toBeNull();
    expect(marketingChannelProblem('WHATSAPP', '+966500000000')).toBeNull();
    expect(marketingChannelProblem('YOUTUBE', 'youtu.be/abc')).toBeNull();
    expect(marketingChannelProblem('INSTAGRAM', '')).not.toBeNull();
    expect(marketingChannelProblem('ANY', 'x')).toBeNull();
  });
});
