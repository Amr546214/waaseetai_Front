import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// PayPal is the only money method for a provider: the setup, profile-data and withdraw pages carry no IBAN / bank / holder / wallet text,
// inputs or payload keys.
const read = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');
const FILES = ['profile/profile-setup/profile-setup.html', 'profile/profile-setup/profile-setup.ts', 'profile/data/data.html', 'profile/data/data.ts', 'finance/withdraw/withdraw.html', 'finance/withdraw/withdraw.ts'];

describe('provider pages are PayPal-only (static)', () => {
  for (const f of FILES) {
    it(`${f}: no IBAN / bank account / account holder / digital wallet`, () => {
      const code = read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
      expect(code).not.toMatch(/ibanNumber|\biban\b|IBAN|bankName|accountHolder|walletProvider|walletPhone|حساب بنكي|الحساب البنكي|اسم البنك|محفظة رقمية|bank_transfer/);
    });
  }

  it('the profile service has no banking update call', () => {
    const svc = readFileSync(join(__dirname, '../../../core/services/provider-profile.service.ts'), 'utf8');
    expect(svc).not.toContain('updateBankingInfo');
    expect(svc).not.toMatch(/ibanNumber|bankName|accountHolderName/);
  });
});
