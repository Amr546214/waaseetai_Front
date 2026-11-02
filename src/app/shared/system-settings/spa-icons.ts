/**
 * The symbols the super-admin settings page (variant `spa`) draws through `#spa-i-<name>`: its own `<symbol>` list in sa-super-admins.html.
 * Written out in full (not composed from a name) so the icon tools and the icon library can see which keys these drawings follow.
 */
export const SPA_SYMBOL_IDS = ['spa-i-bell2', 'spa-i-globe', 'spa-i-key', 'spa-i-list', 'spa-i-settings', 'spa-i-shield', 'spa-i-wallet', 'spa-i-warn'] as const;

/** `#spa-i-<name>` of an icon name (the same string as before; unknown names still resolve to their own id) */
export function spaIconHref(name: string): string {
	const id = 'spa-i-' + name;
	return '#' + (SPA_SYMBOL_IDS.find(i => i === id) ?? id);
}
