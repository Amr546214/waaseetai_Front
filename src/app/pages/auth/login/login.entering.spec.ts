import { installMemoryStorage } from '../../../core/wait/memory-storage.testkit';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { Login } from './login';
import { AuthStore } from '../../../core/store/auth.store';

// A signed-in answer opens the dashboard through a lazy chunk: the form stays locked until that navigation ends; a failed navigation unlocks it with a message.
let restore: () => void = () => undefined;
beforeEach(() => { restore = installMemoryStorage(); });
afterEach(() => { restore(); vi.restoreAllMocks(); TestBed.resetTestingModule(); });

function mount() {
	const post = vi.fn(() => of({ success: true, data: { verified: true, token: 't', user: { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT' } } }));
	TestBed.configureTestingModule({
		imports: [Login],
		providers: [provideRouter([]), { provide: HttpClient, useValue: { post } },
			{ provide: AuthStore, useValue: { currentUser: signal<any>(null), authenticate: vi.fn(), setPendingVerification: vi.fn() } },
			{ provide: SocialAuthService, useValue: { authState: new Subject<any>(), initState: of(undefined) } }],
	});
	const f = TestBed.createComponent(Login);
	const nav = new Subject<boolean>();
	vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockReturnValue(new Promise<boolean>(r => nav.subscribe(r)));
	f.detectChanges();
	const c: any = f.componentInstance;
	c.loginForm.patchValue({ email: 'a@b.co', password: 'Secret#123' });
	return { f, c, post, nav, btn: () => (f.nativeElement as HTMLElement).querySelector('#btn-login') as HTMLButtonElement };
}

describe('login: locked while the dashboard opens', () => {
	it('stays submitting until the navigation ends and ignores a second submit', async () => {
		const { f, c, post, nav, btn } = mount();
		c.onSubmit(); f.detectChanges();
		expect(c.isSubmitting).toBe(true);
		expect(btn().disabled).toBe(true);
		c.onSubmit();
		expect(post).toHaveBeenCalledTimes(1);
		nav.next(true); await Promise.resolve(); await Promise.resolve();
	});
	it('a navigation that does not happen shows «إعادة فتح لوحتي» (navigation only; no second login request)', async () => {
		const { f, c, post, nav } = mount();
		const el = f.nativeElement as HTMLElement;
		c.onSubmit(); f.detectChanges();
		nav.next(false); await Promise.resolve(); await Promise.resolve(); f.detectChanges();
		expect(el.querySelector('#login-form')).toBeNull();
		expect(c.errorMessage).toContain('تعذر فتح لوحتك');
		const navigate = TestBed.inject(Router).navigateByUrl as any;
		const before = navigate.mock.calls.length;
		(el.querySelector('[data-testid="reopen-dashboard"]') as HTMLButtonElement).click(); f.detectChanges();
		expect(navigate.mock.calls.length).toBe(before + 1);
		expect(post).toHaveBeenCalledTimes(1);
	});
});
