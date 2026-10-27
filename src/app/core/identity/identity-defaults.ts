/**
 * The ONE map: identity key -> the built-in default (what the site publishes today). It mirrors the server registry
 * (BE src/config/site-identity.registry.ts, `defaultAsset`); `identity-defaults.spec.ts` compares both when the sibling BE worktree is present.
 *
 * A default is NEVER changed by the identity system: with no custom version published every consumer renders exactly the markup / file it always rendered.
 * `file` paths are the paths the browser requests (relative to the site root); `inline-symbol` defaults live in templates / ai-icon.ts and are only replaced at runtime when a custom SVG is published.
 */
export type IdentityDefault =
	| { readonly type: 'file'; readonly path: string }
	| { readonly type: 'inline-symbol'; readonly symbolId: string };

const file = (path: string): IdentityDefault => ({ type: 'file', path });

export const IDENTITY_DEFAULTS: Readonly<Record<string, IdentityDefault>> = {
	'logo.mark': file('/images/waseet-mark.png'),
	'logo.boot': file('/assets/brand/waseet-mark.png'),
	'logo.email': file('/images/waseet-mark.png'),
	'social.og': file('/assets/social/waseetai-og-v3.jpg'),
	'favicon.tab': file('/assets/brand/waseet-mark.png'),
	'favicon.ico': file('/favicon.ico'),
	'icon.ai': { type: 'inline-symbol', symbolId: 'i-ai' },
	'character.bebo.classic.sprites': file('/bebo/robot-sprites.png'),
	'character.bebo.classic.actions': file('/bebo/robot-actions.png'),
	'character.bebo.classic.speaking': file('/bebo/robot-speaking.png'),
	'character.bebo.classic.antics': file('/bebo/robot-antics.png'),
	'character.bebo.classic.emotions': file('/bebo/robot-emotions.png'),
	'character.bebo.classic.kitten': file('/bebo/kitten-sprites.png'),
	'character.bebo.scout.sprites': file('/bebo/scout/guide-sprites.png'),
	'character.bebo.scout.actions': file('/bebo/scout/guide-actions.png'),
	'character.bebo.scout.speaking': file('/bebo/scout/guide-speaking.png'),
	'character.bebo.scout.antics': file('/bebo/scout/guide-antics.png'),
	'character.bebo.scout.emotions': file('/bebo/scout/guide-emotions.png'),
	'character.bebo.scout.kitten': file('/bebo/scout/kitten-sprites.png'),
	'character.bebo.traffic': file('/bebo/scout/guide-traffic.png'),
	'character.bebo.expressions': file('/bebo/scout/guide-expressions.png'),
};

/** keys whose consumer in THIS front end really reads the identity service (the coordinator mirrors this into the server's WIRED_KEYS) */
export const BEBO_ATLAS_KEYS: readonly string[] = Object.keys(IDENTITY_DEFAULTS).filter(k => k.startsWith('character.bebo.'));
export const FE_WIRED_KEYS: readonly string[] = ['logo.mark', 'logo.boot', 'favicon.tab', 'icon.ai', ...BEBO_ATLAS_KEYS];

export const defaultPathOf = (key: string): string => {
	const d = IDENTITY_DEFAULTS[key];
	return d && d.type === 'file' ? d.path : '';
};
