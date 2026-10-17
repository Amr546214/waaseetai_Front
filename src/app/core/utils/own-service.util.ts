/**
 * The signed-in user owns this service. Identity is the real owner USER id: the BE flag `isOwnService` when it sent one, else the service's
 * `provider.id` (a user id) against the authenticated user id. Never the display name and never the acting role — a provider who switched the
 * same account to CLIENT is still the owner.
 */
export const OWN_SERVICE_LABEL = 'هذه خدمتك';

export function isOwnModel(model: { isOwnService?: boolean; provider?: { id?: string | null } | null } | null | undefined, userId: string | null | undefined): boolean {
	if (!model || !userId) return false;
	return model.isOwnService === true || (!!model.provider?.id && model.provider.id === userId);
}
