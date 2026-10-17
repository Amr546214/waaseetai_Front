import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The public provider profile has no local-only favourite, no invented availability / reply-time line and no button without an action.
const html = readFileSync(join(__dirname, 'provider-profile.html'), 'utf8');
const ts = readFileSync(join(__dirname, 'provider-profile.ts'), 'utf8');

describe('provider profile page: nothing fake', () => {
	it('no local provider favourite (button, state, handler, heart icon use)', () => {
		for (const gone of ['fav-btn', 'favSaved', 'toggleFav', 'محفوظ', 'href="#ws-heart"']) { expect(html, gone).not.toContain(gone); expect(ts, gone).not.toContain(gone); }
	});
	it('no invented availability / reply time', () => {
		for (const gone of ['متاحة الآن', 'ترد خلال 3 ساعات', 'profile-online']) expect(html, gone).not.toContain(gone);
	});
	it('no dead «إرسال رسالة» / share / «تواصل مع المزود» button: every button has a real handler', () => {
		for (const gone of ['إرسال رسالة', 'تواصل مع المزود', 'href="#ws-share"', 'href="#ws-msg"']) expect(html, gone).not.toContain(gone);
		const buttons = [...html.matchAll(/<button\b[^>]*>/g)].map(m => m[0]);
		expect(buttons.length).toBeGreaterThan(0);
		const dead = buttons.filter(b => !/\(click\)=/.test(b) && !/routerLink/.test(b));
		expect(dead).toEqual([]);
	});
	it('the real actions stay: «اطلب خدمة» (real handler)', () => {
		expect((html.match(/\(click\)="goToServices\(\)"/g) || []).length).toBeGreaterThanOrEqual(2);
	});
	it('service favourites are untouched (still in the marketplace service)', () => {
		const svc = readFileSync(join(__dirname, '../../../../core/services/marketplace.service.ts'), 'utf8');
		expect(svc).toContain('setFavorite'); expect(svc).toContain('/favorites');
	});
});
