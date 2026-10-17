import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mapHttpError } from '../../core/forms/http-error';
import { backendBannerMessage, genericBanner } from './submit-feedback';
import { handleSubmitError } from './submit-error';

const http = (status: number, body: unknown = null) => mapHttpError({ status, error: body });
let host: HTMLElement;
beforeEach(() => { host = document.createElement('div'); host.innerHTML = '<input id="amount" name="amount"><input id="note" name="note">'; document.body.appendChild(host); });
afterEach(() => host.remove());

describe('genericBanner (synchronous half: the user is never left without the honest message)', () => {
	it.each([[0], [401], [403], [409], [429], [500], [503]])('status %s -> the mapped message, immediately', (status) => {
		const m = http(status, { message: 'x' });
		expect(genericBanner(m)).toBe(m.message);
	});
	it('a 400 without field names is generic too', () => expect(genericBanner(http(400, {}))).toBeTruthy());
	it('a 400/422 that names fields is NOT generic (null: wait for the field placement)', () => {
		expect(genericBanner(http(422, { errors: [{ field: 'amount', message: 'المبلغ غير صالح' }] }))).toBeNull();
	});
});

describe('backendBannerMessage', () => {
	it('field-keyed 422 that lands on its control: empty banner, message under the field', async () => {
		const banner = await backendBannerMessage(host, http(422, { errors: [{ field: 'amount', message: 'المبلغ غير صالح' }] }));
		expect(banner).toBe('');
		const el = host.querySelector<HTMLInputElement>('#amount')!;
		expect(el.getAttribute('aria-invalid')).toBe('true');
		expect(document.getElementById(el.getAttribute('aria-describedby')!)!.getAttribute('role')).toBe('alert');
	});
	it('a field that matches no control is not dropped: it goes to the banner', async () => {
		expect(await backendBannerMessage(host, http(422, { errors: [{ field: 'ghost', message: 'سبب ما' }] }))).toBe('سبب ما');
	});
	it('429 / network never mark a field', async () => {
		for (const s of [429, 0, 500]) {
			await backendBannerMessage(host, http(s, { message: 'Too many' }));
			expect(host.querySelector('.ws-invalid')).toBeNull();
		}
	});
});

describe('handleSubmitError', () => {
	it('field error handled -> onGeneric not called; otherwise onGeneric gets the honest message', async () => {
		const seen: string[] = [];
		await handleSubmitError(host, { status: 422, error: { errors: [{ field: 'note', message: 'ملاحظة قصيرة' }] } }, { onGeneric: (m) => seen.push(m) });
		expect(seen).toEqual([]);
		await handleSubmitError(host, { status: 429, error: { message: 'Too many requests' } }, { onGeneric: (m) => seen.push(m) });
		expect(seen.length).toBe(1);
		expect(seen[0]).toMatch(/[؀-ۿ]/);
	});
});
