import { describe, it, expect } from 'vitest';
import { readableValue } from './sa-modification-requests';

describe('modification requests: a JSON value is shown as readable lines', () => {
	it('a documents map becomes one labelled line per document', () => {
		expect(readableValue('{"idDocumentUrl":"مستند محفوظ بشكل خاص","certificateUrls":["a","b"]}')).toBe('مستند الهوية: مستند محفوظ بشكل خاص\nالشهادات: a، b');
	});
	it('plain text and non-JSON braces are left alone, empty stays empty', () => {
		expect(readableValue('اسم جديد')).toBe('اسم جديد');
		expect(readableValue('{ليس JSON')).toBe('{ليس JSON');
		expect(readableValue(undefined)).toBe('');
	});
});
