import { identityImageRejected } from './identity-inspection-result';

// A picture the AI check does not accept is removed from the form (the message stays); a remark about the data does not reject it.
describe('identityImageRejected', () => {
	const ok = { status: 'CLEAR_VALID', isIdentityDocument: true, readability: 'CLEAR', sideMatchesExpected: true };
	it('accepts a clear document of the right side and kind', () => expect(identityImageRejected(ok)).toBe(false));
	it('rejects: not an ID, unreadable, wrong side, another kind than chosen', () => {
		expect(identityImageRejected({ ...ok, isIdentityDocument: false, status: 'NOT_ID_DOCUMENT' })).toBe(true);
		expect(identityImageRejected({ ...ok, readability: 'UNREADABLE', status: 'UNREADABLE' })).toBe(true);
		expect(identityImageRejected({ ...ok, sideMatchesExpected: false, status: 'NEEDS_ATTENTION' })).toBe(true);
		expect(identityImageRejected({ ...ok, documentTypeMatches: false, status: 'NEEDS_ATTENTION' })).toBe(true);
	});
	it('rejects when the document number differs from the typed one', () => {
		expect(identityImageRejected({ ...ok, status: 'NEEDS_ATTENTION', fields: { nationalId: 'MISMATCH' } })).toBe(true);
		expect(identityImageRejected({ ...ok, fields: { nationalId: 'COULD_NOT_VERIFY' } })).toBe(false);
	});
	it('keeps the picture when only the name / date differ or the photo is a bit blurry', () => {
		expect(identityImageRejected({ ...ok, status: 'NEEDS_ATTENTION', fields: { fullName: 'MISMATCH', birthDate: 'MISMATCH' } })).toBe(false);
		expect(identityImageRejected({ ...ok, status: 'NEEDS_ATTENTION', readability: 'BLURRY' })).toBe(false);
	});
	it('no result: nothing is rejected', () => { expect(identityImageRejected(null)).toBe(false); expect(identityImageRejected(undefined)).toBe(false); });
});
