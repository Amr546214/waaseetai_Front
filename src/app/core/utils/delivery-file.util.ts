/**
 * Delivery files: how a stored file entry is opened / downloaded.
 *
 * The backend stores every delivery file as {name, url, type, size} (uploaded: the Cloudinary secure_url under waseetai/deliveries/<provider>/<stage>/;
 * a plain https link when the provider attached a link). Nothing is proxied: the browser goes straight to the stored URL.
 *
 *  - OPEN     = the stored URL itself, in a new tab (`target=_blank rel=noopener`). Works for every stored entry that has an https URL.
 *  - DOWNLOAD = for a file we uploaded (Cloudinary `/upload/` URL) the same URL with the delivery flag `fl_attachment` inserted, which makes the CDN answer with
 *               `Content-Disposition: attachment` so the browser saves the file instead of rendering it. An external link has no download variant (it is only opened).
 *  - An entry without a usable https URL (a legacy delivery that only recorded file NAMES) is NOT a link: it is shown as plain text with an explanation, never as a dead anchor.
 */
export interface DeliveryFile { name?: string; url?: string; type?: string; size?: number }

/** https only (a `javascript:` / `data:` / relative value is never turned into a link). */
export function isOpenableUrl(url: unknown): url is string {
	if (typeof url !== 'string' || !url.trim()) return false;
	try { return new URL(url).protocol === 'https:'; } catch { return false; }
}

export function deliveryFileOpenUrl(file: DeliveryFile | null | undefined): string | null {
	return isOpenableUrl(file?.url) ? file!.url! : null;
}

/** Our own uploads live on res.cloudinary.com/<cloud>/<image|video|raw>/upload/... */
export function isCloudinaryUpload(url: unknown): boolean {
	if (!isOpenableUrl(url)) return false;
	try { const u = new URL(url); return u.hostname === 'res.cloudinary.com' && /\/(image|video|raw)\/upload\//.test(u.pathname); } catch { return false; }
}

export function deliveryFileDownloadUrl(file: DeliveryFile | null | undefined): string | null {
	const url = deliveryFileOpenUrl(file);
	if (!url || !isCloudinaryUpload(url)) return null;
	if (url.includes('fl_attachment')) return url;
	return url.replace('/upload/', '/upload/fl_attachment/');
}

export const LEGACY_FILE_NOTE = 'سُجّل اسم الملف فقط في هذا التسليم القديم، ولا يوجد رابط محفوظ لفتحه';
