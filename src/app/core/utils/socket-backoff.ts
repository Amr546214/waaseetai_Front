/**
 * Reconnection policy shared by every Socket.IO client: exponential backoff (1s, 2s, 4s ... capped at 30s) with +-50% random jitter, so
 * many tabs / users that lost the connection together do not come back in lock-step, and a refused handshake (for example the server's
 * connection rate limit) is not hammered. Socket.IO applies delay = min(base * 2^attempt, max) * (1 +- randomizationFactor).
 */
export const SOCKET_BACKOFF = {
	reconnection: true,
	reconnectionDelay: 1000,
	reconnectionDelayMax: 30_000,
	randomizationFactor: 0.5,
} as const;
