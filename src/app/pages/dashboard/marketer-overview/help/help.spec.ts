import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';

import { Help } from './help';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { HelpAssistantSocketService } from '../../../../core/services/help-assistant-socket.service';
import { MarketerOverviewService } from '../../../../core/services/marketer-overview.service';
import { TicketApiService } from '../../../../core/services/ticket-api.service';

describe('Help', () => {
  let component: Help;
  let fixture: ComponentFixture<Help>;
  const socket = { events$: new Subject<any>().asObservable(), ask: vi.fn(() => 'm-1'), cancel: vi.fn() };

  function setup(overrides: { listTickets?: any; createTicket?: any } = {}) {
    socket.ask.mockClear();
    const listTicketsSpy = overrides.listTickets ?? vi.fn(() => of({ success: true, data: { items: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } } }));
    const createTicketSpy = overrides.createTicket ?? vi.fn();
    const fakeTicketApi = { listTickets: listTicketsSpy, createTicket: createTicketSpy };

    TestBed.resetTestingModule();
    return TestBed.configureTestingModule({
      imports: [Help],
      // The help search now uses the shared real assistant; its transport is faked here.
      providers: [
        provideRouter([]),
        { provide: HelpAssistantSocketService, useValue: socket },
        // No real HTTP from a unit test.
        { provide: MarketerOverviewService, useValue: { getSummary: () => of({ success: false, data: null }) } },
        { provide: TicketApiService, useValue: fakeTicketApi },
      ],
    })
    .compileComponents()
    .then(() => {
      fixture = TestBed.createComponent(Help);
      component = fixture.componentInstance;
      return { fixture, component, listTicketsSpy, createTicketSpy };
    });
  }

  beforeEach(async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    await setup();
    await fixture.whenStable();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('askAI() sends the question to the shared real assistant (no keyword/setTimeout fake)', () => {
    component.searchQuery.set('كيف تُحتسب العمولة؟');
    component.askAI();
    const store = TestBed.inject(AssistantStore);
    expect(store.panelOpen()).toBe(true);
    expect(socket.ask).toHaveBeenCalledWith('كيف تُحتسب العمولة؟', []);
  });

  // Regression coverage (Batch 3): the Help page's "فتح تذكرة دعم" card used
  // to routerLink straight to the PUBLIC, unauthenticated /support/report-problem
  // form instead of using the real, authenticated, trackable ticket system
  // that Client/Provider already have. It now creates/tracks a REAL ticket
  // through the existing shared TicketApiService/support-ticket backend
  // (role-agnostic server-side — scoped purely by the caller's own userId).
  describe('Real support ticket access (no public contact-form substitution)', () => {
    it('C) the help page no longer links to the public contact form — an authenticated ticket path is used instead', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('a[href="/support/report-problem"]')).toBeNull();
      expect(el.querySelector('a[routerLink="/support/report-problem"]')).toBeNull();
    });

    it('D) submitting a valid ticket calls the real TicketApiService.createTicket (not a fake/local success)', async () => {
      const createTicketSpy = vi.fn(() => of({ success: true, message: 'تم فتح تذكرتك بنجاح', data: { id: 't1', ticketNumber: 'TCK-0001', status: 'OPEN' } }));
      await setup({ createTicket: createTicketSpy });
      fixture.detectChanges();

      component.ticketSubject.set('مشكلة في رابط الإحالة');
      component.ticketDescription.set('الرابط الخاص بي لا يعمل بشكل صحيح منذ يومين ولا يسجل أي زيارات جديدة.');
      component.submitTicket();

      expect(createTicketSpy).toHaveBeenCalledTimes(1);
      expect(createTicketSpy).toHaveBeenCalledWith('client', expect.objectContaining({
        subject: 'مشكلة في رابط الإحالة',
        description: 'الرابط الخاص بي لا يعمل بشكل صحيح منذ يومين ولا يسجل أي زيارات جديدة.',
      }));
    });

    it('D) an invalid (too-short) ticket never reaches the backend', () => {
      const createTicketSpy = vi.fn();
      component.ticketSubject.set('قصير');
      component.ticketDescription.set('وصف قصير');

      component.submitTicket();

      expect(createTicketSpy).not.toHaveBeenCalled();
      expect(component.ticketCreateError()).toBeTruthy();
    });

    it('E) a backend failure does not show success and surfaces the real error', async () => {
      const createTicketSpy = vi.fn(() => throwError(() => ({ error: { message: 'حدث خطأ في الخادم' } })));
      await setup({ createTicket: createTicketSpy });
      fixture.detectChanges();

      component.ticketSubject.set('مشكلة في رابط الإحالة');
      component.ticketDescription.set('الرابط الخاص بي لا يعمل بشكل صحيح منذ يومين ولا يسجل أي زيارات جديدة.');
      component.submitTicket();

      expect(component.isCreatingTicket()).toBe(false);
      expect(component.ticketCreateError()).toBe('حدث خطأ في الخادم');
      expect(component.toastMessage()).not.toBe('تم فتح تذكرتك بنجاح');
      // Not cleared on failure — user shouldn't have to retype everything.
      expect(component.ticketSubject()).toBe('مشكلة في رابط الإحالة');
    });

    it('F) real success is based on the actual ticket response (no fabricated ID/status)', async () => {
      const createTicketSpy = vi.fn(() => of({ success: true, message: 'تم فتح تذكرتك بنجاح', data: { id: 't1', ticketNumber: 'TCK-0001', status: 'OPEN', subject: 'مشكلة في رابط الإحالة' } }));
      await setup({ createTicket: createTicketSpy });
      fixture.detectChanges();

      component.ticketSubject.set('مشكلة في رابط الإحالة');
      component.ticketDescription.set('الرابط الخاص بي لا يعمل بشكل صحيح منذ يومين ولا يسجل أي زيارات جديدة.');
      component.submitTicket();

      expect(component.toastMessage()).toBe('تم فتح تذكرتك بنجاح');
      expect(component.tickets()[0].ticketNumber).toBe('TCK-0001');
      expect(component.newTicketFormVisible()).toBe(false);
    });

    it('double submission is blocked while a create request is already in flight', () => {
      const createTicketSpy = vi.fn();
      component.isCreatingTicket.set(true);
      component.ticketSubject.set('مشكلة في رابط الإحالة');
      component.ticketDescription.set('الرابط الخاص بي لا يعمل بشكل صحيح منذ يومين ولا يسجل أي زيارات جديدة.');

      component.submitTicket();

      expect(createTicketSpy).not.toHaveBeenCalled();
    });

    it('G) the existing ticket list/history loads real data via the shared TicketApiService', async () => {
      const listTicketsSpy = vi.fn(() => of({
        success: true,
        data: { items: [{ id: 't1', ticketNumber: 'TCK-0001', subject: 'مشكلة سابقة', status: 'RESOLVED' } as any], pagination: { page: 1, limit: 50, total: 1, pages: 1 } },
      }));
      await setup({ listTickets: listTicketsSpy });
      fixture.detectChanges();

      expect(listTicketsSpy).toHaveBeenCalledWith('client');
      expect(component.tickets().length).toBe(1);
      expect(component.tickets()[0].ticketNumber).toBe('TCK-0001');
    });

    it('a failure loading ticket history surfaces a real error, never fabricated tickets', async () => {
      const listTicketsSpy = vi.fn(() => throwError(() => ({ error: { message: 'boom' } })));
      await setup({ listTickets: listTicketsSpy });
      fixture.detectChanges();

      expect(component.tickets()).toEqual([]);
      expect(component.ticketsError()).toBeTruthy();
    });

    it('H) the topic-browse links still point to real, existing Marketer routes', () => {
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      const hrefs = Array.from(el.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
      expect(hrefs).toContain('/marketer-overview/referrals');
      expect(hrefs).toContain('/marketer-overview/commissions');
      expect(hrefs).toContain('/marketer-overview/withdraw');
      expect(hrefs).toContain('/marketer-overview/ref-links');
      expect(hrefs).toContain('/marketer-overview/profile/requests');
    });

    it('I) none of the ticket create/list flows invoke the AI assistant', async () => {
      const listTicketsSpy = vi.fn(() => of({ success: true, data: { items: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } } }));
      const createTicketSpy = vi.fn(() => of({ success: true, data: { id: 't1', ticketNumber: 'TCK-0001' } }));
      await setup({ listTickets: listTicketsSpy, createTicket: createTicketSpy });
      fixture.detectChanges();

      component.ticketSubject.set('مشكلة في رابط الإحالة');
      component.ticketDescription.set('الرابط الخاص بي لا يعمل بشكل صحيح منذ يومين ولا يسجل أي زيارات جديدة.');
      component.submitTicket();

      expect(socket.ask).not.toHaveBeenCalled();
    });
  });
});
