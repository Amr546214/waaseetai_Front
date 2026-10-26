import { chatPreview } from './chat-preview.util';

describe('chatPreview', () => {
	it('never shows a raw negotiation card', () => {
		const card = (o: object) => 'WS_NEGOTIATION::' + JSON.stringify(o);
		expect(chatPreview(card({ isNegotiation: true, price: '45', negTypeName: 'تعديل السعر' }))).toBe('طلب تفاوض على العرض — 45 USD');
		expect(chatPreview(card({ kind: 'PROVIDER_COUNTER', price: 50 }))).toBe('عرض مضاد من مقدم الخدمة — 50 USD');
		expect(chatPreview(card({ kind: 'CLIENT_ACCEPT_COUNTER', offerId: 'o' }))).toBe('قبل العميل العرض المضاد');
		expect(chatPreview('WS_NEGOTIATION::{bad json')).toBe('رسالة تفاوض');
		for (const t of [card({ isNegotiation: true }), card({ kind: 'PROVIDER_REJECT' })]) expect(chatPreview(t)).not.toMatch(/WS_NEGOTIATION|[{}]/);
	});
	it('leaves ordinary text and empty values alone', () => {
		expect(chatPreview('مرحبا')).toBe('مرحبا');
		expect(chatPreview(null)).toBe('');
		expect(chatPreview(undefined)).toBe('');
	});
});
