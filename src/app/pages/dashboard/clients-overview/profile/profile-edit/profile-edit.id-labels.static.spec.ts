import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The identity tab used to label one disabled ID-expiry field "تاريخ الانتهاء/الميلاد": two different dates under one label.
const html = readFileSync(join(__dirname, 'profile-edit.html'), 'utf8');

describe('client profile edit: the identity date label names one date', () => {
  it('the field is labelled "تاريخ انتهاء الهوية" and the mixed expiry/birth label is gone', () => {
    expect(html).not.toContain('الانتهاء/الميلاد');
    expect(html).toContain('تاريخ انتهاء الهوية');
    expect(html).toMatch(/<label[^>]*for="ce-id-expiry"[^>]*>تاريخ انتهاء الهوية<\/label>/);
    expect(html).toMatch(/id="ce-id-expiry"[^>]*formControlName="idExpiryDate"/);
  });
});
