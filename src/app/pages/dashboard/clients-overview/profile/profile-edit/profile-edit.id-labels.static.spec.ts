import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The identity tab is display only (owner decision 2026-11-25): no editable identity field, no expiry date, no send button.
const html = readFileSync(join(__dirname, 'profile-edit.html'), 'utf8');

describe('client profile edit: the identity tab shows the data and edits nothing', () => {
  it('has no expiry-date field and no editable identity controls, only the read-only list', () => {
    expect(html).not.toContain('تاريخ انتهاء الهوية');
    expect(html).not.toContain('ce-id-expiry');
    expect(html).not.toContain('formControlName="idExpiryDate"');
    expect(html).not.toContain('data-testid="identity-submit"');
    expect(html).toContain('data-testid="identity-readonly"');
    expect(html).toMatch(/<ws-legal-name-field[^>]*\[readOnly\]="true"/);
  });
});
