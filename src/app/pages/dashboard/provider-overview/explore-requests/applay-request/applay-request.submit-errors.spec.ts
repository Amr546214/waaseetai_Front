import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ApplayRequest } from './applay-request';

// Clear outcomes for "send offer": every refusal says why and what to do; a lost answer is safe to repeat (the server refuses a 2nd copy).
describe('ApplayRequest: submit errors', () => {
  const make = () => {
    TestBed.configureTestingModule({ imports: [ApplayRequest], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const fixture = TestBed.createComponent(ApplayRequest);
    return { c: fixture.componentInstance as any, fixture };
  };
  afterEach(() => TestBed.resetTestingModule());

  it('409 PROPOSAL_ALREADY_SUBMITTED: says the offer already arrived and links to «عروضي»', () => {
    const { c } = make();
    c.handleSubmitError({ status: 409, error: { success: false, code: 'PROPOSAL_ALREADY_SUBMITTED', message: 'عرضك على هذا المشروع وصلنا من قبل، ولا يمكن إرسال أكثر من عرض واحد لنفس المشروع. افتح «عروضي» لمتابعته.' } });
    const e = c.submitError();
    expect(e.code).toBe('PROPOSAL_ALREADY_SUBMITTED');
    expect(e.message).toContain('وصلنا من قبل');
    expect(e.link.url).toEqual(['/provider-overview/offers']);
  });

  it('locked provider: points to the profile data page to finish the missing requirement', () => {
    const { c } = make();
    c.handleSubmitError({ status: 403, error: { success: false, code: 'PROVIDER_DASHBOARD_LOCKED', message: 'أكمل بياناتك أولًا' } });
    expect(c.submitError().link.url).toEqual(['/provider-overview/profile/data']);
  });

  it('milestone percent sum: offers to go back to the milestones step, entries untouched', () => {
    const { c } = make();
    c.activeStep.set(4);
    c.handleSubmitError({ status: 400, error: { success: false, code: 'MILESTONES_PERCENT_SUM', message: 'إجمالي نسب دفعات المراحل يجب أن يساوي 100%', errors: [{ field: 'milestones', message: 'x' }] } });
    expect(c.submitError().backToStep).toBe(2);
    c.goBackToStep(2);
    expect(c.activeStep()).toBe(2);
    expect(c.submitError()).toBeNull();
  });

  it('network loss after sending: the message says it may have arrived and that repeating is safe', () => {
    const { c, fixture } = make();
    c.handleSubmitError({ status: 0, error: null });
    expect(c.submitError().outcomeUnknown).toBe(true);
    c.activeStep.set(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="submit-error-safe-retry"]')).toBeTruthy();
  });
});
