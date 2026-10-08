/// <reference types="node" />

// Static guard for the account-type cards on mobile. The card's children (icon, name, desc, state, button) are siblings, so a
// `flex-direction:row` card put all five in ONE row inside an `overflow:hidden` box: the description was squeezed to ~40px and the
// "متابعة" button was pushed past the card edge and clipped (320/360/390px). The mobile card must be a two-column grid instead
// (icon | text stack) and the button must not rely on flex-only alignment.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, 'register.css'), 'utf8');
const mobile = css.slice(css.indexOf('@media(max-width:767px){app-register .rg-s1 .roles-section'));

describe('register account-type cards on mobile', () => {
	it('the card is a two-column grid, not a single flex row', () => {
		expect(mobile).toMatch(/\.role-card\{display:grid;grid-template-columns:52px minmax\(0,1fr\)/);
		expect(mobile).not.toMatch(/\.role-card\{[^}]*flex-direction:row/);
	});

	it('name / description / state / button share the text column; the icon spans it', () => {
		expect(mobile).toMatch(/\.role-card>\.role-icon\{grid-column:1;grid-row:1\/span 4\}/);
		expect(mobile).toMatch(/\.role-card>\.role-name,[^{]*\.role-desc,[^{]*\.role-state,[^{]*\.role-cta\{grid-column:2\}/);
		expect(mobile).not.toMatch(/\.role-cta\{[^}]*align-self:flex-end/);
	});
});
