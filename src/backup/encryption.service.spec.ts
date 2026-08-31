import * as fc from 'fast-check';
import { EncryptionService } from './encryption.service';
import { getFcNumRuns } from '../common/test/test-utils';

/**
 * Property 7: Credential Encryption Round-Trip
 * Validates: Requirements 5.4, 5.5
 */
describe('EncryptionService — Property 7: Credential Encryption Round-Trip', () => {
  let svc: EncryptionService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-key-for-property-tests';
    svc = new EncryptionService();
  });

  it('decrypt(encrypt(x)) === x and encrypt(x) !== x for all non-empty strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (plaintext) => {
          const enc = svc.encrypt(plaintext);
          expect(enc).not.toBe(plaintext);
          expect(svc.decrypt(enc)).toBe(plaintext);
        },
      ),
      { numRuns: getFcNumRuns() },
    );
  });
});
