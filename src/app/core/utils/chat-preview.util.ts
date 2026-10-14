/**
 * The one place that turns a message's stored text into the short preview a conversation list shows. A negotiation card is stored as
 * `WS_NEGOTIATION::{json}` (internal state) and must never be shown raw.
 */
export const NEGOTIATION_PREFIX = 'WS_NEGOTIATION::';

const KIND_TEXT: Record<string, string> = {
	PROVIDER_COUNTER: 'عرض مضاد من مقدم الخدمة',
	PROVIDER_REJECT: 'رفض مقدم الخدمة طلب التفاوض',
	CLIENT_ACCEPT_COUNTER: 'قبل العميل العرض المضاد',
	CLIENT_DECLINE_COUNTER: 'رفض العميل العرض المضاد'
};

export function chatPreview(text: string | null | undefined): string {
	const t = text ?? '';
	if (!t.startsWith(NEGOTIATION_PREFIX)) return t;
	try {
		const o = JSON.parse(t.slice(NEGOTIATION_PREFIX.length)) as { kind?: unknown; priceValue?: unknown; price?: unknown } | null;
		const kind = typeof o?.kind === 'string' ? o.kind : '';
		const price = Number(String(o?.priceValue ?? o?.price ?? '').replace(/[^\d.]/g, ''));
		const withPrice = Number.isFinite(price) && price > 0 ? ` — ${price} $` : '';
		if (KIND_TEXT[kind]) return KIND_TEXT[kind] + (kind === 'PROVIDER_COUNTER' ? withPrice : '');
		return 'طلب تفاوض على العرض' + withPrice;
	} catch {
		return 'رسالة تفاوض';
	}
}
