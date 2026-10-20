import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { AuthStore } from './core/store/auth.store';
import { FormA11ySyncService } from './shared/forms/form-a11y-sync.service';

// The a11y sync observes the whole document. Specs run in ONE shared environment (non-isolated), so an App that never stopped it left a live observer for every later
// spec file of the same worker (order-dependent aria-invalid flakes). Destroying the root component now stops it.
describe('App: the a11y sync observer follows the root component\'s life', () => {
	afterEach(() => TestBed.resetTestingModule());
	it('starts with the app and stops when the app is destroyed', async () => {
		const start = vi.fn(); const stop = vi.fn();
		vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
		TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([]), { provide: AuthStore, useValue: { token: () => null, currentUser: () => null, isInitialized$: of(true) } }, { provide: FormA11ySyncService, useValue: { start, stop } }] });
		await TestBed.compileComponents();
		const f = TestBed.createComponent(App);
		expect(start).toHaveBeenCalledWith(document);
		expect(stop).not.toHaveBeenCalled();
		f.destroy();
		expect(stop).toHaveBeenCalledTimes(1);
		vi.unstubAllGlobals();
	});
});
