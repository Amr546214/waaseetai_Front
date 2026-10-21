import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { CreateRequest } from './create-request';

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

  it('network loss: the message sits beside the button and says repeating is safe', () => {
    c.currentStep.set(6); render();
    (c as any).handlePublishError({ status: 0, error: null });
    render();
    expect((c as any).publishError()).toContain('بأمان');
    const box = fixture.nativeElement.querySelector('[data-testid="publish-error"]') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.textContent).toContain('بأمان');
    expect(box.textContent).toContain('نسخة ثانية');
  });

  it('a refusal that is not a lost answer shows its own reason without the "safe to repeat" line', () => {
    c.currentStep.set(6); render();
    (c as any).handlePublishError({ status: 403, error: { success: false, message: 'غير مصرح لك بنشر طلب' } });
    render();
    const box = fixture.nativeElement.querySelector('[data-testid="publish-error"]') as HTMLElement;
    expect(box.textContent).not.toContain('بأمان');
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
});
