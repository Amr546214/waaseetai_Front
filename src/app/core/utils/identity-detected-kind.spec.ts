import { detectedDocumentCode } from './identity-inspection-result';

describe('detectedDocumentCode: the document type comes from what the AI saw in the picture', () => {
	it('maps the four supported kinds to the app codes and ignores everything else', () => {
		expect(detectedDocumentCode({ documentKind: 'NATIONAL_ID' })).toBe('NATIONAL_ID');
		expect(detectedDocumentCode({ documentKind: 'passport' })).toBe('PASSPORT');
		expect(detectedDocumentCode({ documentKind: 'RESIDENCE_PERMIT' })).toBe('RESIDENCE_PERMIT');
		expect(detectedDocumentCode({ documentKind: 'DRIVING_LICENCE' })).toBe('DRIVING_LICENCE');
		for (const v of ['OTHER', 'UNKNOWN', '', undefined, null, 'DRIVING_LICENSE']) expect(detectedDocumentCode({ documentKind: v as any })).toBeNull();
		expect(detectedDocumentCode(null)).toBeNull();
	});
});
