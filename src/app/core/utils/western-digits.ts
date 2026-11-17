/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits -> 0-9. Everything else is left untouched. */
export function toWesternDigits(value: string): string {
	return value.replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
}

const TEXT_TYPES = new Set(['text', 'tel', 'search', 'email', 'url', 'number', '']);

/**
 * Site wide: whatever digits a person types into a text field become 0-9 as they are typed (ID numbers, phones, amounts,
 * dates...). Passwords are never touched. The listener runs in the capture phase on the document, so the form control
 * (which listens on the element itself) already receives the converted value. Returns a function that removes it.
 */
export function installWesternDigits(doc: Document): () => void {
	const handler = (event: Event) => {
		const el = event.target as HTMLInputElement | HTMLTextAreaElement | null;
		if (!el || (event as InputEvent).isComposing) return;
		const isInput = el.tagName === 'INPUT';
		if (!isInput && el.tagName !== 'TEXTAREA') return;
		if (isInput && !TEXT_TYPES.has((el as HTMLInputElement).type)) return;
		const before = el.value;
		const after = toWesternDigits(before);
		if (after === before) return;
		let start: number | null = null;
		let end: number | null = null;
		try { start = el.selectionStart; end = el.selectionEnd; } catch { /* some input types expose no selection */ }
		el.value = after;
		try { if (start !== null && end !== null) el.setSelectionRange(start, end); } catch { /* ignore */ }
	};
	doc.addEventListener('input', handler, true);
	return () => doc.removeEventListener('input', handler, true);
}
