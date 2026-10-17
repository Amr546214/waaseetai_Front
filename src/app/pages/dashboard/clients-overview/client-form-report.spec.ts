import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleClientError, hasFieldErrors, reportClientBackend, reportClientProblems } from './client-form-report';

let host: HTMLElement;
beforeEach(() => {
	(Element.prototype as any).scrollIntoView = vi.fn();
	host = document.createElement('div');
	host.innerHTML = '<input id="title" name="title"><ws-select id="cat"><button type="button">اختر</button></ws-select><textarea id="desc"></textarea>';
	document.body.appendChild(host);
});
afterEach(() => host.remove());

describe('client form glue', () => {
	it('a ws-select problem lands on its trigger button (focusable), message under the select, and the first invalid in page order is focused', async () => {
		await reportClientProblems(host, [{ field: 'desc', message: 'الوصف مطلوب' }, { field: 'cat', message: 'اختر التصنيف' }, { field: 'title', message: 'العنوان مطلوب' }]);
		expect(document.activeElement).toBe(host.querySelector('#title'));
		const btn = host.querySelector('ws-select button')!;
		expect(btn.getAttribute('aria-invalid')).toBe('true');
		expect(document.getElementById(btn.getAttribute('aria-describedby')!)!.textContent).toBe('اختر التصنيف');
	});
	it('422 naming a field -> under the field, generic is empty', async () => {
		const r = await reportClientBackend(host, { status: 422, error: { errors: [{ field: 'title', message: 'العنوان طويل' }] } }, { resolve: { title: 'title' } });
		expect(r.handled).toBe(true);
		expect(r.generic).toBe('');
		expect(document.activeElement).toBe(host.querySelector('#title'));
	});
	it.each([[0], [429], [500], [403], [409]])('status %s stays generic, nothing is marked', async (status) => {
		const show = vi.fn();
		handleClientError(host, { status, error: { message: 'x' } }, {}, show);
		expect(show).toHaveBeenCalledTimes(1); // synchronously
		expect(host.querySelector('.ws-invalid')).toBeNull();
		expect(hasFieldErrors({ status, error: { message: 'x' } })).toBe(false);
	});
	it('a status-less failure that carries an Arabic server message keeps that message', () => {
		const show = vi.fn();
		handleClientError(host, { error: { message: 'لا يمكن التفاوض على هذا العرض' } }, {}, show);
		expect(show).toHaveBeenCalledWith('لا يمكن التفاوض على هذا العرض');
	});
});
