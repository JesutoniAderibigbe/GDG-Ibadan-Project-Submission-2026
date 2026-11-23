import { describe, it, expect } from 'vitest';
import { ATTENDEE_FIELDS, SPONSOR_FIELDS, buildPayload, npsScore, ratingStats, toCsv } from '../feedback';

const attendeeBase = { overall: 5, nps: 9, venue: 4, sessions: 5, organisation: 4, food: 3, networking: 5 };
const sponsorBase = {
  company: 'Chowdeck', contactName: 'Ada', email: 'ada@example.com',
  overall: 5, communication: 4, booth: 4, visibility: 5, audience: 5, talent: 4, value: 4,
  sponsorAgain: 'Definitely',
};

describe('buildPayload', () => {
  it('accepts a minimal valid attendee response and omits empty optionals', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, enjoyedMost: '   ', halls: [] });
    expect(res).toEqual({ ok: true, payload: attendeeBase });
  });

  it('keeps enjoyedMost and improve as two separate answers', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, enjoyedMost: 'The quiz', improve: 'More seats' });
    expect(res.ok && res.payload).toMatchObject({ enjoyedMost: 'The quiz', improve: 'More seats' });
  });

  it('requires the mandatory ratings', () => {
    const { venue: _venue, ...rest } = attendeeBase;
    const res = buildPayload(ATTENDEE_FIELDS, rest);
    expect(res).toEqual({ ok: false, error: 'Please answer: Venue' });
  });

  it('treats NPS 0 as a valid answer', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, nps: 0 });
    expect(res.ok && res.payload.nps).toBe(0);
  });

  it('rejects out-of-range ratings and unknown options', () => {
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, overall: 6 }).ok).toBe(false);
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, role: 'Wizard' }).ok).toBe(false);
  });

  it('drops multi-select values that are not real options', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, halls: ['Hall 2', 'Hall 9'] });
    expect(res.ok && res.payload.halls).toEqual(['Hall 2']);
  });

  it('validates the optional attendee email format', () => {
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, email: 'nope' }).ok).toBe(false);
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, email: 'a@b.co' }).ok).toBe(true);
  });

  it('requires sponsor company, contact email and likelihood to sponsor again', () => {
    expect(buildPayload(SPONSOR_FIELDS, sponsorBase).ok).toBe(true);
    const { email: _email, ...noEmail } = sponsorBase;
    expect(buildPayload(SPONSOR_FIELDS, noEmail)).toEqual({ ok: false, error: 'Please answer: Contact email' });
    const { sponsorAgain: _s, ...noAgain } = sponsorBase;
    expect(buildPayload(SPONSOR_FIELDS, noAgain).ok).toBe(false);
  });

  it('enforces text length limits', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, favourite: 'x'.repeat(301) });
    expect(res.ok).toBe(false);
  });
});

describe('stats', () => {
  const rows = [{ overall: 5, nps: 10 }, { overall: 3, nps: 6 }, { overall: 4, nps: 9 }, { nps: 7 }];

  it('averages ratings, ignoring rows without an answer', () => {
    const overall = ratingStats(ATTENDEE_FIELDS, rows).find((s) => s.name === 'overall');
    expect(overall).toMatchObject({ average: 4, count: 3 });
  });

  it('returns a null average when nobody answered', () => {
    expect(ratingStats(ATTENDEE_FIELDS, []).find((s) => s.name === 'venue')?.average).toBeNull();
  });

  it('computes NPS as promoters minus detractors', () => {
    // 2 promoters (10, 9), 1 detractor (6), 1 passive (7) of 4 => 25
    expect(npsScore(rows)).toBe(25);
    expect(npsScore([])).toBeNull();
  });
});

describe('toCsv', () => {
  it('escapes quotes, commas and joins arrays', () => {
    const csv = toCsv(ATTENDEE_FIELDS, [{ submittedAt: 't', overall: 5, halls: ['Hall 1', 'Hall 2'], improve: 'Louder, "bigger"' }]);
    const [header, line] = csv.split('\n');
    expect(header.startsWith('Submitted at,Overall experience')).toBe(true);
    expect(line).toContain('Hall 1; Hall 2');
    expect(line).toContain('"Louder, ""bigger"""');
  });

  it('neutralises spreadsheet formulas', () => {
    const csv = toCsv(ATTENDEE_FIELDS, [{ improve: '=HYPERLINK("http://x")' }]);
    expect(csv).toContain(`'=HYPERLINK`);
  });
});
