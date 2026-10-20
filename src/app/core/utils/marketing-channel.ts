// Marketing channel validity for the marketer setup wizard: the SAME rule as the backend (utils/marketing-channel-validation.ts). A channel is valid when it can really be a
// channel of its platform; no platform is forced and one channel is enough.
//  - no spaces; a link (http(s):// or a «/») must be an http(s) URL on the platform's own domains; otherwise a handle: WhatsApp = a phone number (digits, optional +,
//    7-15 digits), the others = letters / digits / . _ - with an optional leading @.

export type MarketingPlatform = 'LINKEDIN' | 'YOUTUBE' | 'TIKTOK' | 'WHATSAPP' | 'TWITTER' | 'INSTAGRAM';

const HOSTS: Record<MarketingPlatform, string[]> = {
	LINKEDIN: ['linkedin.com'],
	YOUTUBE: ['youtube.com', 'youtu.be'],
	TIKTOK: ['tiktok.com'],
	WHATSAPP: ['wa.me', 'whatsapp.com'],
	TWITTER: ['twitter.com', 'x.com'],
	INSTAGRAM: ['instagram.com'],
};

/** null when valid, else the Arabic message to show under the channel field. */
export function marketingChannelProblem(platform: string | null | undefined, rawHandle: string | null | undefined): string | null {
	const handle = String(rawHandle ?? '').trim();
	if (!handle) return 'أدخل معرّف القناة أو رابطها';
	if (/\s/.test(handle)) return 'معرّف القناة لا يجوز أن يحتوي على مسافات';
	const key = String(platform ?? '').toUpperCase() as MarketingPlatform;
	const hosts = HOSTS[key];
	if (!hosts) return null; // the platform select reports its own error
	if (/^https?:\/\//i.test(handle) || handle.includes('/')) {
		if (/^[a-z][a-z0-9+.-]*:/i.test(handle) && !/^https?:\/\//i.test(handle)) return 'رابط القناة يجب أن يبدأ بـ http أو https';
		let url: URL;
		try { url = new URL(/^https?:\/\//i.test(handle) ? handle : `https://${handle}`); } catch { return 'رابط القناة غير صالح'; }
		const host = url.hostname.toLowerCase().replace(/^www\./, '');
		return hosts.some(d => host === d || host.endsWith(`.${d}`)) ? null : 'الرابط لا يخص هذا النوع من القنوات';
	}
	if (key === 'WHATSAPP') return /^\+?\d{7,15}$/.test(handle) ? null : 'أدخل رقم واتساب صالحًا (أرقام فقط، مع + اختياريًا)';
	return /^@?[\p{L}\p{N}._-]{1,100}$/u.test(handle) ? null : 'معرّف القناة غير صالح: أحرف وأرقام ونقطة وشرطة فقط';
}
