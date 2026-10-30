import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { config, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CreateRequest } from './create-request';

describe('CreateRequest metadata initialization', () => {
  const bypass = new HttpErrorResponse({
    status: 401,
    statusText: 'SSR Bypassed - Unauthenticated',
    error: { success: false, message: 'SSR execution bypassed for authenticated route' },
  });
  const get = vi.fn();
  const post = vi.fn();
  const unhandled = vi.fn();
  let previousUnhandled: typeof config.onUnhandledError;

  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    post.mockReturnValue(of({ success: false }));
    unhandled.mockClear();
    previousUnhandled = config.onUnhandledError;
    config.onUnhandledError = unhandled;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
    get.mockImplementation(() => throwError(() => bypass));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    config.onUnhandledError = previousUnhandled;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function initialize(platform: 'browser' | 'server') {
    await TestBed.configureTestingModule({
      imports: [CreateRequest],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: HttpClient, useValue: { get, post } },
      ],
    }).overrideComponent(CreateRequest, { set: { template: '', imports: [] } }).compileComponents();
    const fixture = TestBed.createComponent(CreateRequest);
    await fixture.whenStable();
    // RxJS reports errors from subscriptions without an error handler on the next timer turn.
    await new Promise(resolve => setTimeout(resolve, 10));
    return fixture.componentInstance;
  }

  it('does not let rejected metadata and category requests escape to the process', async () => {
    const component = await initialize('browser');
    expect(get.mock.calls.some(([url]) => url.endsWith('/specialties/categories'))).toBe(true);
    expect(unhandled).not.toHaveBeenCalled();
    expect(component.specialties()).toEqual([]);
  });

  it('leaves authenticated initialization for the browser during SSR', async () => {
    await initialize('server');
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('still loads metadata and recommendations in the browser', async () => {
    get.mockImplementation((url: string) => of(url.endsWith('/requests/meta')
      ? { data: { categories: [{ id: 'web', name: 'Web', specialties: [{ name: 'Frontend' }] }] } }
      : { success: false }));
    const component = await initialize('browser');
    expect(component.specialties()).toEqual([expect.objectContaining({ id: 'web', subs: ['Frontend'] })]);
    expect(post.mock.calls.some(([url]) => url.includes('specialty-recommendations'))).toBe(true);
    expect(get.mock.calls.some(([url]) => url.endsWith('/specialties/categories'))).toBe(false);
  });

  it('still loads categories when browser metadata fails', async () => {
    get.mockImplementation((url: string) => url.endsWith('/specialties/categories')
      ? of({ success: true, data: [{ id: 'web', name: 'Web', specialties: [{ name: 'Frontend' }] }] })
      : throwError(() => bypass));
    const component = await initialize('browser');
    expect(component.specialties()).toEqual([expect.objectContaining({ id: 'web', subs: ['Frontend'] })]);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
