/** Client-side checks for an uploaded file, with Arabic messages. The backend only sees the result (a URL/base64). */
export interface FileRule {
	/** Maximum size in bytes. */
	maxBytes: number;
	/** Allowed MIME types (e.g. 'image/png'). When empty any type is accepted. */
	mimeTypes?: string[];
	/** Human-readable allowed types for the message, e.g. 'JPG أو PNG أو PDF'. */
	typesLabel?: string;
}

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const DOC_MIMES = [...IMAGE_MIMES, 'application/pdf'];
export const MB = 1024 * 1024;

export function formatMegabytes(bytes: number): string {
	const mb = bytes / MB;
	return Number.isInteger(mb) ? `${mb}` : mb.toFixed(1);
}

/** Returns an Arabic error for the first violated rule, or null when the file is acceptable. */
export function validateFile(file: { size: number; type: string; name?: string }, rule: FileRule): string | null {
	if (rule.mimeTypes?.length && !rule.mimeTypes.includes(file.type)) {
		return `نوع الملف غير مسموح${rule.typesLabel ? `، المسموح: ${rule.typesLabel}` : ''}`;
	}
	if (file.size > rule.maxBytes) {
		return `حجم الملف كبير جدًا (${formatMegabytes(file.size)} ميغابايت)، الحد الأقصى ${formatMegabytes(rule.maxBytes)} ميغابايت`;
	}
	if (file.size === 0) return 'الملف فارغ، اختر ملفًا آخر';
	return null;
}
