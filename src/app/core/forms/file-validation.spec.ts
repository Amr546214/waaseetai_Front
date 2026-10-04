import { DOC_MIMES, IMAGE_MIMES, MB, formatMegabytes, validateFile } from './file-validation';

describe('validateFile', () => {
	const rule = { maxBytes: 2 * MB, mimeTypes: IMAGE_MIMES, typesLabel: 'JPG أو PNG أو WEBP' };

	it('accepts a file within the size and type limits', () => {
		expect(validateFile({ size: 1 * MB, type: 'image/png' }, rule)).toBeNull();
	});

	it('rejects a wrong type with the allowed types named', () => {
		expect(validateFile({ size: 1000, type: 'application/pdf' }, rule)).toBe('نوع الملف غير مسموح، المسموح: JPG أو PNG أو WEBP');
	});

	it('rejects an oversize file with the real size and the limit', () => {
		expect(validateFile({ size: 3.5 * MB, type: 'image/jpeg' }, rule)).toBe('حجم الملف كبير جدًا (3.5 ميغابايت)، الحد الأقصى 2 ميغابايت');
	});

	it('rejects an empty file; no type restriction when mimeTypes is omitted', () => {
		expect(validateFile({ size: 0, type: 'image/png' }, rule)).toContain('فارغ');
		expect(validateFile({ size: 10, type: 'application/zip' }, { maxBytes: MB })).toBeNull();
	});

	it('DOC_MIMES includes pdf and the image types; formatMegabytes', () => {
		expect(DOC_MIMES).toContain('application/pdf');
		expect(DOC_MIMES).toEqual(expect.arrayContaining(IMAGE_MIMES));
		expect(formatMegabytes(2 * MB)).toBe('2');
		expect(formatMegabytes(1.5 * MB)).toBe('1.5');
	});
});

describe('validateFile: extension fallback', () => {
	const rule = { maxBytes: MB, mimeTypes: ['application/pdf'], extensions: ['.zip', '.mp4'], typesLabel: 'PDF أو ZIP أو MP4' };

	it('accepts a file whose MIME type is odd/empty when its extension is allowed', () => {
		expect(validateFile({ name: 'Sample.ZIP', size: 10, type: '' }, rule)).toBeNull();
		expect(validateFile({ name: 'clip.mp4', size: 10, type: 'application/octet-stream' }, rule)).toBeNull();
	});

	it('still rejects when neither the MIME type nor the extension is allowed', () => {
		expect(validateFile({ name: 'run.exe', size: 10, type: 'application/x-msdownload' }, rule)).toContain('نوع الملف غير مسموح');
	});
});
