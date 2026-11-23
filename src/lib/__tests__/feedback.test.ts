import { describe, it, expect } from 'vitest';
import { ATTENDEE_FIELDS, SPONSOR_FIELDS, buildPayload, npsScore, ratingStats, toCsv } from '../feedback';
import type { FormValues } from '../feedback';

const attendeeBase = {
  overall: 5, nps: 9, venue: 4, sessions: 5, organisation: 4, food: 3, networking: 5,
  halls: ['Hall 2'], favourite: 'The keynote', enjoyedMost: 'The quiz', improve: 'More seats',
  tookQuiz: 'No', tookVibe: 'No', topics: ['AI'], role: 'Developer', heardFrom: 'Twitter', email: 'ada@example.com',
};
const sponsorBase = {
  company: 'Chowdeck', contactName: 'Ada', email: 'ada@example.com',
  overall: 5, communication: 4, booth: 4, visibility: 5, audience: 5, talent: 4, value: 4,
  goalLeads: 'Yes', goalHiring: 'Partly', goalAwareness: 'Yes', goalProductFeedback: 'No',
  conversations: '11-30', worked: 'Great crowd', improve: 'More signage', sponsorAgain: 'Definitely', nextPackage: 'Booth',
};
const without = (o: FormValues, k: string): FormValues => Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));

describe('buildPayload (attendee)', () => {
  it('accepts a complete response and stores exactly the answered questions', () => {
    expect(buildPayload(ATTENDEE_FIELDS, attendeeBase)).toEqual({ ok: true, payload: attendeeBase });
  });

  it('keeps enjoyedMost and improve as two separate required answers', () => {
    expect(buildPayload(ATTENDEE_FIELDS, without(attendeeBase, 'enjoyedMost'))).toEqual({ ok: false, error: 'Please answer: What did you enjoy most?' });
    expect(buildPayload(ATTENDEE_FIELDS, without(attendeeBase, 'improve'))).toEqual({ ok: false, error: 'Please answer: What should we improve?' });
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, improve: '   ' }).ok).toBe(false);
  });

  it('requires every question, including email, role, halls and topics', () => {
    for (const k of Object.keys(attendeeBase)) {
      expect(buildPayload(ATTENDEE_FIELDS, without(attendeeBase, k)).ok, `${k} should be required`).toBe(false);
    }
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, halls: [] }).ok).toBe(false);
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, topics: [] }).ok).toBe(false);
  });

  it('asks for a quiz and Vibe Lounge rating only after answering Yes', () => {
    const yes = { ...attendeeBase, tookQuiz: 'Yes', tookVibe: 'Yes' };
    expect(buildPayload(ATTENDEE_FIELDS, yes)).toEqual({ ok: false, error: 'Please answer: How would you rate the quiz?' });
    const rated = buildPayload(ATTENDEE_FIELDS, { ...yes, quizRating: 4, vibeRating: 5 });
    expect(rated.ok && rated.payload).toMatchObject({ quizRating: 4, vibeRating: 5 });
  });

  it('drops a stale rating when the answer is changed back to No', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, tookVibe: 'No', vibeRating: 5 });
    expect(res.ok && 'vibeRating' in res.payload).toBe(false);
  });

  it('has no project showcase question and uses the new halls and roles', () => {
    const names = ATTENDEE_FIELDS.map((f) => f.name);
    expect(names).not.toContain('sawShowcase');
    expect(names).not.toContain('showcaseRating');
    const opts = (n: string) => (ATTENDEE_FIELDS.find((f) => f.name === n) as { options: string[] }).options;
    expect(opts('halls')).toEqual(['Main Hall (Hall 1)', 'Hall 2', 'Hall 3', 'Vibe Lounge']);
    expect(opts('role')).toEqual(['Developer', 'Designer', 'First time in tech']);
  });

  it('treats NPS 0 as a valid answer', () => {
    const res = buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, nps: 0 });
    expect(res.ok && res.payload.nps).toBe(0);
  });

  it('rejects out-of-range ratings and unknown options', () => {
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, overall: 6 }).ok).toBe(false);
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, role: 'Student' }).ok).toBe(false);
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, halls: ['Hall 4'] }).ok).toBe(false);
  });

  it('requires a valid email address', () => {
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, email: 'nope' }).ok).toBe(false);
  });

  it('enforces text length limits', () => {
    expect(buildPayload(ATTENDEE_FIELDS, { ...attendeeBase, favourite: 'x'.repeat(301) }).ok).toBe(false);
  });
});

describe('buildPayload (sponsor)', () => {
  it('accepts a complete response', () => {
    expect(buildPayload(SPONSOR_FIELDS, sponsorBase)).toEqual({ ok: true, payload: sponsorBase });
  });

  it('requires every question', () => {
    for (const k of Object.keys(sponsorBase)) {
      expect(buildPayload(SPONSOR_FIELDS, without(sponsorBase, k)).ok, `${k} should be required`).toBe(false);
    }
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
