import { describe, it, expect } from 'vitest';
import { isValidJudge, VALID_JUDGES } from '../judges';

describe('isValidJudge', () => {
  it('accepts the three valid judge usernames', () => {
    for (const name of VALID_JUDGES) {
      expect(isValidJudge(name)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(isValidJudge('JESUTONI')).toBe(true);
    expect(isValidJudge('AbIdEmI')).toBe(true);
    expect(isValidJudge('JOSH')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isValidJudge('  josh  ')).toBe(true);
  });

  it('rejects anyone not on the list', () => {
    expect(isValidJudge('judge1')).toBe(false);
    expect(isValidJudge('intruder')).toBe(false);
    expect(isValidJudge('')).toBe(false);
  });
});
