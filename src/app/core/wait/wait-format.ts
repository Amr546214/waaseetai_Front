/** Formatting of a remaining wait. Pure; the clock form ticks every second, the words form is for sentences. */

/** "1:23" under an hour, "1:05:00" from an hour on. */
export function formatClock(totalSeconds: number): string {
	const s = Math.max(0, Math.ceil(totalSeconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const two = (n: number) => String(n).padStart(2, '0');
	return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** "30 ثانية" / "دقيقتين" / "5 دقائق" / "ساعة". */
export function formatWaitWords(totalSeconds: number): string {
	const s = Math.max(1, Math.ceil(totalSeconds));
	if (s >= 3600) { const h = Math.round(s / 3600); return h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : `${h} ساعات`; }
	if (s >= 60) { const m = Math.ceil(s / 60); return m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : `${m} ${m <= 10 ? 'دقائق' : 'دقيقة'}`; }
	return `${s} ثانية`;
}

/** «بعد 1:23» (clock form) for a visible ticking label. */
export function waitLabel(totalSeconds: number): string {
	return `بعد ${formatClock(totalSeconds)}`;
}

/** The one 429 sentence. With a known wait it names it; with none it is honest and names NO number. */
export const RATE_LIMIT_PREFIX = 'طلبات كثيرة، يمكنك إعادة المحاولة بعد';
export function rateLimitSentence(totalSeconds: number | null | undefined, clock = false): string {
	if (totalSeconds == null || !Number.isFinite(totalSeconds)) return `${RATE_LIMIT_PREFIX} قليل`;
	if (totalSeconds <= 0) return 'يمكنك إعادة المحاولة الآن';
	return `${RATE_LIMIT_PREFIX} ${clock ? formatClock(totalSeconds) : formatWaitWords(totalSeconds)}`;
}
