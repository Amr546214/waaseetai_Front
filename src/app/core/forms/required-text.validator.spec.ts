import { FormControl } from '@angular/forms';
import { isBlankText, requiredText } from './required-text.validator';

describe('requiredText: whitespace-only is not a value', () => {
	it('blank variants fail with the central `required` key', () => {
		for (const v of ['', '   ', ' ', '​', ' ‌‍﻿⁠ ', '\n\t', null, undefined]) {
			expect(requiredText(new FormControl(v)), JSON.stringify(v)).toEqual({ required: true });
			expect(isBlankText(v)).toBe(true);
		}
	});
	it('any real text passes, even one character, and no length rule exists', () => {
		for (const v of ['م', ' a ', 'نبذة قصيرة']) expect(requiredText(new FormControl(v)), v).toBeNull();
	});
});
