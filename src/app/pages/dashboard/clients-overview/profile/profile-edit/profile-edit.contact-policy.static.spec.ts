import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The e-mail and the account phone are immutable from the interface for every role: the client page shows them read-only, there is no code flow to change
// them, and only the optional WhatsApp number is saved directly.
const html = readFileSync(join(__dirname, 'profile-edit.html'), 'utf8');
const ts = readFileSync(join(__dirname, 'profile-edit.ts'), 'utf8');

describe('client profile edit: e-mail and phone are display-only', () => {
  it('no phone-change dialog, no code wording, no "changes with a code" label', () => {
    expect(html).not.toContain('app-phone-change');
    expect(ts).not.toContain('PhoneChange');
    expect(html).not.toContain('يتطلب تأكيد رمز');
    expect(html).not.toContain('يتغيّر برمز تحقق');
    expect(html).toContain('(للقراءة فقط)');
  });

  it('the e-mail and the phone controls are disabled in both forms; WhatsApp stays editable', () => {
    const disabled = (name: string) => new RegExp(`${name}: \\[\\{ value: '', disabled: true \\}\\]`, 'g');
    expect((ts.match(disabled('email')) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((ts.match(disabled('phoneNumber')) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(ts).toMatch(/alternativePhone: \[''\]/);
  });

  it('the shared phone-change component and service are gone', () => {
    const { existsSync } = require('node:fs');
    expect(existsSync(join(__dirname, '..', '..', '..', '..', '..', 'sheards', 'phone-change'))).toBe(false);
    expect(existsSync(join(__dirname, '..', '..', '..', '..', '..', 'core', 'services', 'phone-change.service.ts'))).toBe(false);
  });
});
