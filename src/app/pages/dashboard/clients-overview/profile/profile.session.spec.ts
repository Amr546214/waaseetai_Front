import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { Profile } from './profile';
import { ProfileApiService } from '../../../../core/services/profile-api.service';
import { AuthStore } from '../../../../core/store/auth.store';

function mount() {
	const user = signal<any>({ id: 'account-a', firstName: 'Cached', lastName: 'Account', avatarUrl: 'https://example.com/old-avatar.png', createdAt: '2020-01-01', accountType: 'PROVIDER_INDIVIDUAL', profileCompletionPercent: 90 });
	const token = signal('token-a');
	const requests: Subject<any>[] = [];
	const getMyProfile = vi.fn(() => { const request = new Subject<any>(); requests.push(request); return request.asObservable(); });
	const authenticate = vi.fn();
	TestBed.configureTestingModule({ imports: [Profile], providers: [provideRouter([]),
		{ provide: ProfileApiService, useValue: { getMyProfile } },
		{ provide: AuthStore, useValue: { currentUser: user, token, authenticate } },
	] });
	const fixture = TestBed.createComponent(Profile);
	fixture.detectChanges();
	const respond = (index: number, data: any) => { requests[index].next({ success: true, data: { currentProfileData: data } }); fixture.detectChanges(); };
	return { fixture, component: fixture.componentInstance, user, token, requests, getMyProfile, authenticate, respond };
}

describe('client profile: endpoint data belongs to the current session', () => {
	it('never fills missing endpoint fields with cached account identity or invented zeroes', () => {
		const s = mount();
		s.respond(0, { firstName: 'Current', lastName: '', avatarUrl: null, createdAt: null, accountType: 'CLIENT_INDIVIDUAL', phoneNumber: '5551234' });
		expect(s.component.getFullName()).toBe('Current');
		expect(s.component.getAvatar()).toBeNull();
		expect(s.component.getMemberSince()).toBe('');
		expect(s.component.completionPercent).toBeNull();
		const el = s.fixture.nativeElement as HTMLElement;
		expect(Array.from(el.querySelectorAll('.stat-num')).map(el => el.textContent?.trim())).toEqual(['—', '—', '—', '—']);
		expect(el.textContent).not.toContain('+966');
	});

	it('clears the old profile and fetches again when a second account becomes active', () => {
		const s = mount();
		s.respond(0, { firstName: 'First', totalRequests: 7 });
		s.user.set({ id: 'account-b', firstName: 'Second', accountType: 'CLIENT_INDIVIDUAL' });
		s.token.set('token-b');
		s.fixture.detectChanges();
		expect(s.getMyProfile).toHaveBeenCalledTimes(2);
		expect(s.component.profileData()).toBeNull();
		expect(s.fixture.nativeElement.textContent).not.toContain('First');
		s.respond(1, { firstName: 'Second', lastName: 'Person', totalRequests: 2 });
		expect(s.component.getFullName()).toBe('Second Person');
		expect(s.component.profileData().totalRequests).toBe(2);
	});

	it('ignores a response from the previous account even before the reload effect runs', () => {
		const s = mount();
		s.user.set({ id: 'account-b', firstName: 'Second', accountType: 'CLIENT_INDIVIDUAL' });
		s.token.set('token-b');
		s.requests[0].next({ success: true, data: { firstName: 'First', profileCompletionPercent: 80 } });
		expect(s.component.profileData()).toBeNull();
		expect(s.authenticate).not.toHaveBeenCalled();
		s.fixture.detectChanges();
		s.respond(1, { firstName: 'Second', profileCompletionPercent: 0 });
		expect(s.component.getFullName()).toBe('Second');
		expect(s.component.completionPercent).toBe(0);
	});
});
