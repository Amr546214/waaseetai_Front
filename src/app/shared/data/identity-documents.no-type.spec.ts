import { documentInputProblem } from './identity-documents';

describe('document number without a chosen type (type is read from the picture)', () => {
  it('never blocks on a hidden type field, whatever the digits look like', () => {
    expect(documentInputProblem('٣٠٤٨٠١٢٢٠٣٢٩٦', 'EG', null)).toBeNull();
    expect(documentInputProblem('A1234567', 'EG', null)).toBeNull();
  });
  it('still validates the number once a type is known', () => {
    expect(documentInputProblem('12345', 'EG', 'NATIONAL_ID')?.key).toBe('idNumber');
  });
});
