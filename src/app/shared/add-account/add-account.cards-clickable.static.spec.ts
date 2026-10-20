/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Found on dev: the two company cards carried no click handler, so clicking them stayed silent. Every card of every add-account page now routes its click through selectType (which answers for a card that cannot be chosen).
describe('add-account templates: every role card handles its click', () => {
	for (const area of ['clients-overview', 'provider-overview', 'marketer-overview']) {
		it(`${area}: 5 cards, each with selectType(...)`, () => {
			const html = readFileSync(join(__dirname, `../../pages/dashboard/${area}/profile/add-account/add-account.html`), 'utf8');
			const cards = html.match(/<div class="role-card"[^>]*>/g) ?? [];
			expect(cards.length).toBe(5);
			for (const card of cards) expect(card, card).toMatch(/\(click\)="selectType\('/);
		});
	}
});
