import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

const fakeSocket = { connected: false, on: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
const ioSpy = vi.fn<(...args: any[]) => any>(() => fakeSocket);
vi.mock('socket.io-client', () => ({ default: (...args: any[]) => ioSpy(...args), io: (...args: any[]) => ioSpy(...args) }));

import { NotificationEngineService } from './notification-engine.service';

// A dispute notification must open THIS dispute for each party: the provider has a details page; the client app has none, so its
// list page opens the dispute through ?dispute=<id>. Rows without metadata keep their stored (real) link.
describe('NotificationEngineService - dispute notification targets', () => {
	let service: NotificationEngineService;
	beforeEach(() => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		TestBed.configureTestingModule({});
		service = TestBed.inject(NotificationEngineService);
	});
	afterEach(() => vi.unstubAllGlobals());

	for (const type of ['DISPUTE_OPENED', 'DISPUTE_RESOLVED']) {
		it(`${type}: provider -> /provider-overview/disputes/<id>, client -> /client-overview/disputes?dispute=<id>`, () => {
			const nt = { type, metadata: { disputeId: 'D-1' }, actionUrl: '/client-overview/disputes' };
			expect(service.resolveNotificationTarget(nt, '/provider-overview')).toBe('/provider-overview/disputes/D-1');
			expect(service.resolveNotificationTarget(nt, '/client-overview')).toBe('/client-overview/disputes?dispute=D-1');
		});
	}

	it('an older row without metadata keeps its stored same-app link; another dashboard\'s link is not followed', () => {
		expect(service.resolveNotificationTarget({ type: 'DISPUTE_OPENED', actionUrl: '/client-overview/disputes' }, '/client-overview')).toBe('/client-overview/disputes');
		expect(service.resolveNotificationTarget({ type: 'DISPUTE_OPENED', actionUrl: '/client-overview/disputes' }, '/provider-overview')).toBeNull();
	});
});
