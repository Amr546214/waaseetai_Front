import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CreateRequest } from './create-request';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

// Publishing a request: a failure is explained NEXT TO the publish button; a lost answer says that repeating is safe (the server never creates a second copy).
describe('create-request: publish outcome messages', () => {
  let fixture: ComponentFixture<CreateRequest>;
  let c: CreateRequest;
  const render = () => { fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck(); fixture.detectChanges(); };
  beforeEach(async () => {
    localStorage.clear(); sessionStorage.clear();
    await TestBed.configureTestingModule({ imports: [CreateRequest], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    fixture = TestBed.createComponent(CreateRequest);
    c = fixture.componentInstance;
    document.body.appendChild(fixture.nativeElement);
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); localStorage.clear(); });

  it('network loss: the message sits beside the button and marks the outcome as uncertain', () => {
    c.currentStep.set(6); render();
    (c as any).handlePublishError({ status: 0, error: null });
    render();
    expect((c as any).publishError()).toContain('نتيجة النشر غير مؤكدة');
    const box = fixture.nativeElement.querySelector('[data-testid="publish-error"]') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.textContent).toContain('نتيجة النشر غير مؤكدة');
    expect(box.textContent).toContain('نتحقق أولًا');
  });

  it('a refusal that is not a lost answer shows its own reason without the "safe to repeat" line', () => {
    c.currentStep.set(6); render();
    (c as any).handlePublishError({ status: 403, error: { success: false, message: 'غير مصرح لك بنشر طلب' } });
    render();
    const box = fixture.nativeElement.querySelector('[data-testid="publish-error"]') as HTMLElement;
    expect(box.textContent).not.toContain('غير مؤكدة');
    expect(box.textContent!.length).toBeGreaterThan(5);
  });

  it('the server answered with the request that already existed: the success screen says it was already saved and links to it', () => {
    (c as any).alreadyPublishedId.set('req-123');
    c.showSuccessOverlay.set(true); render();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="already-published"]')!.textContent).toContain('بالفعل');
    expect(el.textContent).toContain('لم ننشئ نسخة ثانية');
    expect(el.querySelector('[data-testid="open-existing"]')!.getAttribute('href')).toContain('/client-overview/my-requests/req-123');
  });

  it('a normal first publish keeps the normal success screen', () => {
    c.showSuccessOverlay.set(true); render();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="already-published"]')).toBeNull();
    expect(el.textContent).toContain('تم نشر الطلب بنجاح');
  });

  describe('uncertain outcome gate', () => {
    const lose = () => {
      const api = (c as any).projectApi;
      const create = vi.spyOn(api, 'createProject').mockReturnValue(throwError(() => ({ status: 0, error: null })));
      const mine = vi.spyOn(api, 'getMyRequests');
      void c.submitRequest();
      return { api, create, mine };
    };
    const flush = () => new Promise<void>(r => setTimeout(r, 0));

    it('a lost answer keeps the uncertain state (also in storage)', async () => {
      const { create } = lose(); await flush();
      expect(create).toHaveBeenCalledTimes(1);
      expect(c.uncertainSince()).not.toBeNull();
      expect(localStorage.getItem('ws:publish-uncertain:v1')).toBeTruthy();
    });

    it('pressing publish again with a request created since: NOTHING is created, the existing one is offered first - even after the title was edited', async () => {
      const { create, mine } = lose(); await flush();
      c.title.set('عنوان معدّل بعد ضياع الرد');
      mine.mockReturnValue(of([{ id: 'r-9', title: 'العنوان الأصلي', createdAt: new Date().toISOString() }, { id: 'old', title: 'قديم', createdAt: '2020-01-01T00:00:00Z' }]) as any);
      await c.submitRequest(); await flush();
      expect(create).toHaveBeenCalledTimes(1);
      expect(c.publishCandidates()!.map(r => r.id)).toEqual(['r-9']);
    });

    it('the gate does not expire with the 5-minute window: an attempt marked an hour ago still checks first', async () => {
      const { create, mine } = lose(); await flush();
      (c as any).setUncertain(Date.now() - 60 * 60 * 1000);
      mine.mockReturnValue(of([{ id: 'r-8', title: 'x', createdAt: new Date(Date.now() - 59 * 60 * 1000).toISOString() }]) as any);
      await c.submitRequest(); await flush();
      expect(create).toHaveBeenCalledTimes(1);
      expect(c.publishCandidates()!.length).toBe(1);
    });

    it('nothing created since: the lost publish never arrived, so the next press creates it', async () => {
      const { create, mine } = lose(); await flush();
      mine.mockReturnValue(of([]) as any);
      create.mockReturnValue(of({ success: true, data: { id: 'new' } }) as any);
      await c.submitRequest(); await flush();
      expect(create).toHaveBeenCalledTimes(2);
      expect(c.uncertainSince()).toBeNull();
    });

    it('the check itself fails: nothing is created and the user is told to look at «طلباتي» first', async () => {
      const { create, mine } = lose(); await flush();
      mine.mockReturnValue(throwError(() => ({ status: 0 })) as any);
      await c.submitRequest(); await flush();
      expect(create).toHaveBeenCalledTimes(1);
      expect(c.publishError()).toContain('لن ننشئ طلبًا جديدًا');
    });

    it('«ليس أيٌّ منها طلبي» is the explicit choice that creates', async () => {
      const { create, mine } = lose(); await flush();
      mine.mockReturnValue(of([{ id: 'r-9', title: 't', createdAt: new Date().toISOString() }]) as any);
      await c.submitRequest(); await flush();
      create.mockReturnValue(of({ success: true, data: { id: 'new' } }) as any);
      c.publishAnyway(); await flush();
      expect(create).toHaveBeenCalledTimes(2);
    });
  });
});
