import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { ASSISTANT_TTS_PATH, AssistantTtsError, AssistantTtsService } from './assistant-tts.service';
import { AuthStore } from '../store/auth.store';
import { SKIP_LOADING, loadingInterceptor } from '../interceptors/loading.interceptor';
import { LoadingService } from './loading.service';
import { environment } from '../../../environments/environment';

// Frontend half of WaseetAI TTS: only the user's own app JWT is sent (from
// AuthStore), to the Waseet backend — never any WaseetAI credential.

describe('AssistantTtsService', () => {
	let service: AssistantTtsService;
	let http: HttpTestingController;
	const token = signal<string | null>('app-jwt');
	const loading = { start: vi.fn(), stop: vi.fn() };
	const URL_TTS = `${environment.url_api}${ASSISTANT_TTS_PATH}`;

	beforeEach(() => {
		token.set('app-jwt');
		loading.start.mockClear();
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptors([loadingInterceptor])),
				provideHttpClientTesting(),
				{ provide: AuthStore, useValue: { token } },
				{ provide: LoadingService, useValue: loading },
			],
		});
		service = TestBed.inject(AssistantTtsService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it('POSTs only text/voice/dialect to the authenticated backend endpoint with the app JWT, as a Blob, without the page loader', async () => {
		const result = firstValueFrom(service.synthesize({ text: 'مرحبا', voice: 'Kore', dialect: 'saudi' }));
		const req = http.expectOne(URL_TTS);
		expect(req.request.method).toBe('POST');
		expect(req.request.body).toEqual({ text: 'مرحبا', voice: 'Kore', dialect: 'saudi' });
		expect(req.request.headers.get('Authorization')).toBe('Bearer app-jwt');
		expect(req.request.responseType).toBe('blob');
		expect(req.request.context.get(SKIP_LOADING)).toBe(true);
		expect(loading.start).not.toHaveBeenCalled();
		const wav = new Blob(['RIFF'], { type: 'audio/wav' });
		req.flush(wav);
		expect(await result).toBe(wav);
	});

	it('no session → AUTH_REQUIRED without any request', async () => {
		token.set(null);
		await expect(firstValueFrom(service.synthesize({ text: 'x', voice: 'Puck', dialect: 'egyptian' }))).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
		http.expectNone(URL_TTS);
	});

	it('a non-audio or empty response is rejected (never played)', async () => {
		const p = firstValueFrom(service.synthesize({ text: 'x', voice: 'Puck', dialect: 'egyptian' }));
		http.expectOne(URL_TTS).flush(new Blob(['{"success":true}'], { type: 'application/json' }));
		await expect(p).rejects.toBeInstanceOf(AssistantTtsError);
		await expect(p).rejects.toMatchObject({ code: 'INVALID_AUDIO' });
	});

	it.each([
		[401, 'AUTH_REQUIRED'],
		[400, 'INVALID_INPUT'],
		[429, 'RATE_LIMITED'],
		[503, 'NOT_CONFIGURED'],
		[504, 'TIMEOUT'],
		[502, 'UNAVAILABLE'],
		[500, 'UNAVAILABLE'],
	])('HTTP %s → %s', async (status, code) => {
		const p = firstValueFrom(service.synthesize({ text: 'x', voice: 'Puck', dialect: 'egyptian' }));
		http.expectOne(URL_TTS).flush(new Blob(['{}'], { type: 'application/json' }), { status, statusText: 'x' });
		await expect(p).rejects.toMatchObject({ code });
	});

	it('unsubscribing cancels the HTTP request', () => {
		const sub = service.synthesize({ text: 'x', voice: 'Puck', dialect: 'egyptian' }).subscribe();
		const req = http.expectOne(URL_TTS);
		sub.unsubscribe();
		expect(req.cancelled).toBe(true);
	});
});
