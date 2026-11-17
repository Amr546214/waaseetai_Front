/**
 * The provider setup wizard keeps what the person typed in THIS browser (localStorage, one key per account) while the wizard is open, so a refresh or a closed tab
 * returns to the same step with the same answers. Nothing leaves the browser until the final «إرسال» of the wizard; the draft is erased when that succeeds.
 * Pictures and files never go in (they are uploaded to the server when chosen): only short text values, the selected lists and the step.
 */
export interface ProviderSetupDraft {
	v: 1;
	at: number;
	step: number;
	form: Record<string, Record<string, unknown>>;
	skills: string[];
	specs: string[];
	portfolio: Record<string, unknown[]>;
	avatarUrl: string;
}

const MAX_TEXT = 1500;
export const providerDraftKey = (userId: string) => `waseet.provider-setup-draft.v1.${userId}`;

/** a value that may be kept: not a data URL, not a long blob, only plain JSON-able things */
function keep(value: unknown): unknown {
	if (typeof value === 'string') return value.startsWith('data:') || value.length > MAX_TEXT ? undefined : value;
	if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
	if (Array.isArray(value)) return value.map(keep).filter(v => v !== undefined);
	if (value && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) { const c = keep(v); if (c !== undefined) out[k] = c; }
		return out;
	}
	return undefined;
}

export function buildDraft(input: { step: number; formRaw: Record<string, unknown>; skills: string[]; specs: string[]; portfolio: Record<string, unknown[]>; avatarUrl: string }): ProviderSetupDraft {
	const form: Record<string, Record<string, unknown>> = {};
	for (const [group, value] of Object.entries(input.formRaw)) {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			const clean = keep(value) as Record<string, unknown>;
			// the identity picture references are decided by the identity gate on the server, never by a draft
			if (group === 'docs') { delete clean['frontId']; delete clean['backId']; }
			form[group] = clean;
		}
	}
	return { v: 1, at: Date.now(), step: input.step, form, skills: (keep(input.skills) as string[]) ?? [], specs: (keep(input.specs) as string[]) ?? [], portfolio: (keep(input.portfolio) as Record<string, unknown[]>) ?? {}, avatarUrl: typeof keep(input.avatarUrl) === 'string' ? input.avatarUrl : '' };
}

export function readDraft(userId: string, storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): ProviderSetupDraft | null {
	if (!userId || !storage) return null;
	try {
		const parsed = JSON.parse(storage.getItem(providerDraftKey(userId)) || 'null');
		if (!parsed || parsed.v !== 1 || typeof parsed.form !== 'object' || !Number.isInteger(parsed.step)) return null;
		return { ...parsed, step: Math.min(7, Math.max(1, parsed.step)), skills: Array.isArray(parsed.skills) ? parsed.skills : [], specs: Array.isArray(parsed.specs) ? parsed.specs : [], portfolio: parsed.portfolio && typeof parsed.portfolio === 'object' ? parsed.portfolio : {}, avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : '' } as ProviderSetupDraft;
	} catch { return null; }
}

export function writeDraft(userId: string, draft: ProviderSetupDraft, storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): void {
	if (!userId || !storage) return;
	try { storage.setItem(providerDraftKey(userId), JSON.stringify(draft)); } catch { /* storage full or blocked: the wizard still works, it just cannot resume */ }
}

export function clearDraft(userId: string, storage: Pick<Storage, 'removeItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null): void {
	if (!userId || !storage) return;
	try { storage.removeItem(providerDraftKey(userId)); } catch { /* ignore */ }
}
