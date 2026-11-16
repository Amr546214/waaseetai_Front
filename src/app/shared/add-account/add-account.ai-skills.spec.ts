import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccountService } from '../../core/services/account.service';
import { AuthStore } from '../../core/store/auth.store';
import { SkillsCatalogService } from '../../core/services/skills-catalog.service';
import { UiNotificationService } from '../../core/services/ui-notification.service';
import { AddAccount as ClientAddAccount } from '../../pages/dashboard/clients-overview/profile/add-account/add-account';

// The add-account wizard (a client adding a provider account): an AI skills suggestion that can only add names from the catalog of the chosen specialty.
describe('add-account wizard: AI skills suggestion', () => {
	const catalog = [{ id: 'c1', nameAr: 'ذكاء اصطناعي وبيانات', skills: ['Python', 'SQL', 'Excel', 'PyTorch'] }];
	function mount(suggest: ReturnType<typeof vi.fn>) {
		const info = vi.fn(), success = vi.fn(), error = vi.fn();
		TestBed.configureTestingModule({ imports: [ClientAddAccount], providers: [provideRouter([]),
			{ provide: AccountService, useValue: { getAvailableAccountTypes: () => of({ success: true, data: { ownedRoles: ['CLIENT'], activeRole: 'CLIENT' } }), addAccountType: vi.fn(), switchActiveRole: vi.fn(), suggestSkills: suggest } },
			{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT', roles: ['CLIENT'] }) } },
			{ provide: SkillsCatalogService, useValue: { getAll: () => of({ success: true, data: catalog }) } },
			{ provide: UiNotificationService, useValue: { info, success, error } }] });
		const f = TestBed.createComponent(ClientAddAccount); const c = f.componentInstance as any; f.detectChanges();
		c.skillCategories.set(catalog); c.spec.controls.specMain.setValue('ذكاء اصطناعي وبيانات');
		return { c, f, info, success, error };
	}

	it('adds only catalog names (case-insensitive), skips known ones and invented ones, and reports how many', () => {
		const suggest = vi.fn(() => of({ success: true, data: { suggestedSkills: ['python', 'SQL', 'Rust', 'Python', 'pytorch'] } }));
		const { c, success } = mount(suggest); c.skills.set(['SQL']);
		c.suggestSkillsWithAi();
		expect(suggest).toHaveBeenCalledWith({ mainSpecialty: 'ذكاء اصطناعي وبيانات', existingSkills: ['SQL'] });
		expect(c.skills()).toEqual(['SQL', 'Python', 'PyTorch']);
		expect(success).toHaveBeenCalled(); expect(c.isSuggestingSkills()).toBe(false);
	});
	it('nothing new: says so and changes nothing; a failed call is reported and re-enables the button', () => {
		const a = mount(vi.fn(() => of({ success: true, data: { suggestedSkills: ['Rust'] } }))); a.c.suggestSkillsWithAi();
		expect(a.c.skills()).toEqual([]); expect(a.info).toHaveBeenCalled(); TestBed.resetTestingModule();
		const b = mount(vi.fn(() => throwError(() => new Error('x')))); b.c.suggestSkillsWithAi();
		expect(b.error).toHaveBeenCalled(); expect(b.c.isSuggestingSkills()).toBe(false);
	});
	it('no specialty chosen: no call', () => {
		const suggest = vi.fn(); const { c } = mount(suggest); c.spec.controls.specMain.setValue(''); c.suggestSkillsWithAi();
		expect(suggest).not.toHaveBeenCalled();
	});
	it('the button uses the official AI icon and is wired to the suggestion', () => {
		const { f } = mount(vi.fn()); const c = f.componentInstance as any; c.stepIdx.set(1); f.detectChanges();
		const btn = (f.nativeElement as HTMLElement).querySelector('[data-testid="add-account-ai-skills"]');
		if (btn) expect(btn.innerHTML).toContain('#i-ai');
	});
});
