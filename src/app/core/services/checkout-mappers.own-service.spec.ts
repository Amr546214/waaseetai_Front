import { mapCartItem } from './checkout-mappers';

describe('cart mapping: own-service flag', () => {
	const base: any = { id: 'i', modelId: 'm', title: 't', category: 'c', totalAmount: 1, totalDays: 1, provider: { id: 'p', name: 'نا' }, addedAt: '', savedForLater: false };
	it('carries the BE ownService flag and omits it otherwise', () => {
		expect(mapCartItem({ ...base, ownService: true } as any).ownService).toBe(true);
		expect(mapCartItem(base).ownService).toBeUndefined();
	});
});
