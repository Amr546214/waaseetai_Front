import { FormA11ySyncService } from './form-a11y-sync.service';
import { markInvalid, clearInvalid } from './form-error-focus';

// Typed then cleared (ng-invalid + touched: the sync service marks it), then a failed submit calls markInvalid (class ws-invalid + its own message): the next
// sync pass must NOT strip aria-invalid from the control markInvalid now owns.
describe('FormA11ySyncService hands a control over to markInvalid without dropping aria-invalid', () => {
	afterEach(() => { document.body.innerHTML = ''; });

	it('keeps aria-invalid=true and aria-describedby on a control marked by markInvalid after the sync service had marked it', () => {
		document.body.innerHTML = '<div><input id="f" class="ng-invalid ng-touched ng-dirty"><p class="field-error">مطلوب</p></div>';
		const svc = new FormA11ySyncService();
		svc.sync(document);
		const input = document.getElementById('f') as HTMLInputElement;
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.hasAttribute('data-ws-a11y')).toBe(true);
		document.querySelector('.field-error')!.remove();
		markInvalid(input, 'أدخل اسمك');
		svc.sync(document);
		expect(input.classList.contains('ws-invalid')).toBe(true);
		expect(input.getAttribute('aria-invalid')).toBe('true');
		expect(input.getAttribute('aria-describedby')).toMatch(/ws-field-msg-/);
		// correcting the field (valid again) clears it as before
		clearInvalid(input);
		input.className = 'ng-valid ng-touched';
		svc.sync(document);
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	it('a control the sync service marked and that became valid is still released', () => {
		document.body.innerHTML = '<div><input id="g" class="ng-invalid ng-touched"><p class="field-error">مطلوب</p></div>';
		const svc = new FormA11ySyncService();
		svc.sync(document);
		const input = document.getElementById('g')!;
		input.className = 'ng-valid ng-touched';
		svc.sync(document);
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});
});

describe('FormA11ySyncService covers the upload zone of a file field', () => {
	afterEach(() => { document.body.innerHTML = ''; });
	it('a visible field error under an upload card makes the CARD aria-invalid + described by it; fixing the file releases it', () => {
		document.body.innerHTML = '<div><input type="file" id="doc-front" hidden><div class="upload-card" id="card" tabindex="0">+</div><span role="alert" data-testid="field-error">مستند الهوية مطلوب</span></div>';
		const svc = new FormA11ySyncService();
		svc.sync(document);
		const card = document.getElementById('card')!;
		expect(card.getAttribute('aria-invalid')).toBe('true');
		expect(card.getAttribute('aria-describedby')).toMatch(/ws-a11y-msg-/);
		document.querySelector('[data-testid="field-error"]')!.remove();
		svc.sync(document);
		expect(card.getAttribute('aria-invalid')).toBeNull();
		expect(card.getAttribute('aria-describedby')).toBeNull();
	});
});
