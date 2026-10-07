import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { KycDocumentService, kycAccessErrorMessage } from './kyc-document.service';

describe('KycDocumentService', () => {
	let post: ReturnType<typeof vi.fn>;
	let service: KycDocumentService;

	beforeEach(() => {
		post = vi.fn(() => of({ success: true, data: { url: 'https://signed.example/x', expiresAt: 'z', expiresInSeconds: 120, private: true, legacy: false } }));
		TestBed.configureTestingModule({ providers: [{ provide: HttpClient, useValue: { post } }] });
		service = TestBed.inject(KycDocumentService);
	});

	it('POSTs /kyc-documents/access-link with only the fields that were given', () => {
		service.createAccessLink({ document: 'client_front_id' }).subscribe();
		expect(post).toHaveBeenCalledTimes(1);
		expect(String(post.mock.calls[0][0])).toMatch(/\/kyc-documents\/access-link$/);
		expect(post.mock.calls[0][1]).toEqual({ document: 'client_front_id' });
	});

	it('sends userId (admin), id and index when given, including index 0', () => {
		service.createAccessLink({ document: 'provider_certificate', userId: 'u1', index: 0 }).subscribe();
		service.createAccessLink({ document: 'onboarding_document', id: 'o1' }).subscribe();
		expect(post.mock.calls[0][1]).toEqual({ document: 'provider_certificate', userId: 'u1', index: 0 });
		expect(post.mock.calls[1][1]).toEqual({ document: 'onboarding_document', id: 'o1' });
	});

	it('returns data (the link) and never keeps it: a second call asks the server again', () => {
		let first: any; let second: any;
		service.createAccessLink({ document: 'client_front_id' }).subscribe(l => (first = l));
		service.createAccessLink({ document: 'client_front_id' }).subscribe(l => (second = l));
		expect(first.url).toBe('https://signed.example/x');
		expect(second.url).toBe('https://signed.example/x');
		expect(post).toHaveBeenCalledTimes(2);
	});

	it('maps failures to clear Arabic messages', () => {
		expect(kycAccessErrorMessage({ status: 401 })).toBe('انتهت الجلسة، سجّل الدخول مجددًا');
		expect(kycAccessErrorMessage({ status: 403 })).toBe('لا تملك صلاحية لفتح هذه الوثيقة');
		expect(kycAccessErrorMessage({ status: 404 })).toBe('لا توجد وثيقة مرفوعة');
		expect(kycAccessErrorMessage({ status: 500 })).toBe('تعذر فتح الوثيقة');
		expect(kycAccessErrorMessage(null)).toBe('تعذر فتح الوثيقة');
	});
});
