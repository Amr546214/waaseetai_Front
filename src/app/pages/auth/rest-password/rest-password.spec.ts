import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RestPassword } from './rest-password';

describe('RestPassword', () => {
  let component: RestPassword;
  let fixture: ComponentFixture<RestPassword>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestPassword]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RestPassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('credential semantics: new + confirm are new-password inside one form with a username field; nothing read-only', () => {
    component.currentStep = 3;
    component.recoveryForm.patchValue({ email: 'a@example.com' });
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const np = el.querySelector('#new-password') as HTMLInputElement;
    const cp = el.querySelector('#confirm-password') as HTMLInputElement;
    const user = el.querySelector('#reset-username') as HTMLInputElement;
    const form = np.closest('form')!;
    expect(np.getAttribute('autocomplete')).toBe('new-password');
    expect(cp.getAttribute('autocomplete')).toBe('new-password');
    expect(user.getAttribute('autocomplete')).toBe('username');
    expect(user.value).toBe('a@example.com');
    for (const i of [np, cp, user]) { expect(form.contains(i)).toBe(true); expect(i.hasAttribute('readonly')).toBe(false); }
    expect(form.querySelector('button[type=submit]')).not.toBeNull();
  });
});
