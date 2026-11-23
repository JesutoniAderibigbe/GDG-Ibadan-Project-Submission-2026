// Feedback form definitions (attendees + sponsors), payload validation and
// admin-side stats. Keep the field names, option lists and limits in sync with
// the isValidAttendeeFeedback / isValidSponsorFeedback rules in firestore.rules.

// Who may read responses is enforced by `isFeedbackAdmin()` in firestore.rules
// (a single email/password account, matched by uid). The admin page has no
// client-side allowlist: a wrong account simply gets a permission error.

export type FeedbackKind = 'attendee' | 'sponsor';

export const FEEDBACK_COLLECTIONS: Record<FeedbackKind, string> = {
  attendee: 'attendeeFeedback',
  sponsor: 'sponsorFeedback',
};

// Every question is required. A field with `showIf` is only shown (and only
// required/stored) while another single-choice answer equals the given value,
// e.g. the Vibe Lounge rating only appears after answering "Yes".
interface FieldBase {
  name: string;
  label: string;
  showIf?: { name: string; equals: string };
}

export type Field =
  | (FieldBase & { kind: 'text'; max: number; inputType?: 'text' | 'email'; placeholder?: string; hint?: string })
  | (FieldBase & { kind: 'textarea'; max: number; placeholder?: string; hint?: string })
  | (FieldBase & { kind: 'rating' }) // 1-5
  | (FieldBase & { kind: 'nps' }) // 0-10
  | (FieldBase & { kind: 'single'; options: string[] })
  | (FieldBase & { kind: 'multi'; options: string[] });

export function isVisible(f: Field, values: Record<string, unknown>): boolean {
  return !f.showIf || values[f.showIf.name] === f.showIf.equals;
}

export const HALLS = ['Main Hall (Hall 1)', 'Hall 2', 'Hall 3', 'Vibe Lounge'];
export const TOPICS = ['AI', 'Web', 'Mobile', 'Cloud', 'Design', 'Career', 'Other'];
export const ROLES = ['Developer', 'Designer', 'First time in tech'];
export const YES_NO = ['Yes', 'No'];
export const GOAL_OPTIONS = ['Yes', 'Partly', 'No'];
export const CONVERSATION_BUCKETS = ['0-10', '11-30', '31-60', '60+'];
export const SPONSOR_AGAIN = ['Definitely', 'Probably', 'Unsure', 'No'];

export const ATTENDEE_FIELDS: Field[] = [
  { kind: 'rating', name: 'overall', label: 'Overall experience' },
  { kind: 'nps', name: 'nps', label: 'How likely are you to recommend DevFest Ibadan to a friend?' },
  { kind: 'rating', name: 'venue', label: 'Venue' },
  { kind: 'rating', name: 'sessions', label: 'Sessions and speakers' },
  { kind: 'rating', name: 'organisation', label: 'Organisation' },
  { kind: 'rating', name: 'food', label: 'Food and refreshments' },
  { kind: 'rating', name: 'networking', label: 'Networking' },
  { kind: 'multi', name: 'halls', label: 'Which hall(s) did you spend most time in?', options: HALLS },
  { kind: 'text', name: 'favourite', label: 'Favourite session or speaker', max: 300 },
  { kind: 'textarea', name: 'enjoyedMost', label: 'What did you enjoy most?', max: 1500 },
  { kind: 'textarea', name: 'improve', label: 'What should we improve?', max: 1500 },
  { kind: 'single', name: 'tookQuiz', label: 'Did you take part in the quiz?', options: YES_NO },
  { kind: 'rating', name: 'quizRating', label: 'How would you rate the quiz?', showIf: { name: 'tookQuiz', equals: 'Yes' } },
  { kind: 'single', name: 'tookVibe', label: 'Did you take part in the Vibe Lounge?', options: YES_NO },
  { kind: 'rating', name: 'vibeRating', label: 'How would you rate the Vibe Lounge?', showIf: { name: 'tookVibe', equals: 'Yes' } },
  { kind: 'multi', name: 'topics', label: 'Which topics do you want next year?', options: TOPICS },
  { kind: 'single', name: 'role', label: 'Your role', options: ROLES },
  { kind: 'text', name: 'heardFrom', label: 'How did you hear about us?', max: 200 },
  { kind: 'text', name: 'email', label: 'Email', inputType: 'email', max: 320, placeholder: 'you@example.com' },
];

export const SPONSOR_FIELDS: Field[] = [
  { kind: 'text', name: 'company', label: 'Company name', max: 150 },
  { kind: 'text', name: 'contactName', label: 'Your name', max: 150 },
  { kind: 'text', name: 'email', label: 'Contact email', inputType: 'email', max: 320, hint: 'So we can follow up' },
  { kind: 'rating', name: 'overall', label: 'Overall satisfaction with the sponsorship' },
  { kind: 'rating', name: 'communication', label: 'Pre-event communication' },
  { kind: 'rating', name: 'booth', label: 'Booth or placement' },
  { kind: 'rating', name: 'visibility', label: 'Brand visibility' },
  { kind: 'rating', name: 'audience', label: 'Quality of the audience' },
  { kind: 'rating', name: 'talent', label: 'Access to talent' },
  { kind: 'rating', name: 'value', label: 'Value for money' },
  { kind: 'single', name: 'goalLeads', label: 'Did you meet your goal: leads?', options: GOAL_OPTIONS },
  { kind: 'single', name: 'goalHiring', label: 'Did you meet your goal: hiring?', options: GOAL_OPTIONS },
  { kind: 'single', name: 'goalAwareness', label: 'Did you meet your goal: brand awareness?', options: GOAL_OPTIONS },
  { kind: 'single', name: 'goalProductFeedback', label: 'Did you meet your goal: product feedback?', options: GOAL_OPTIONS },
  { kind: 'single', name: 'conversations', label: 'Roughly how many meaningful conversations did you have?', options: CONVERSATION_BUCKETS },
  { kind: 'textarea', name: 'worked', label: 'What worked well?', max: 1500 },
  { kind: 'textarea', name: 'improve', label: 'What could we improve?', max: 1500 },
  { kind: 'single', name: 'sponsorAgain', label: 'Likelihood to sponsor next year', options: SPONSOR_AGAIN },
  { kind: 'text', name: 'nextPackage', label: 'Preferred package or support next time', max: 500 },
];

export const FIELDS_BY_KIND: Record<FeedbackKind, Field[]> = {
  attendee: ATTENDEE_FIELDS,
  sponsor: SPONSOR_FIELDS,
};

export type FormValues = Record<string, string | number | string[] | undefined>;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Validates the raw form values and returns the document to store. Every
// visible question is required; questions hidden by `showIf` are skipped and
// never stored, so Firestore rules can tie them to the answer that unlocks them.
export function buildPayload(
  fields: Field[],
  values: FormValues,
): { ok: true; payload: Record<string, string | number | string[]> } | { ok: false; error: string } {
  const payload: Record<string, string | number | string[]> = {};
  const missing = (f: Field) => ({ ok: false as const, error: `Please answer: ${f.label}` });
  const invalid = (f: Field) => ({ ok: false as const, error: `Invalid answer: ${f.label}` });

  for (const f of fields) {
    if (!isVisible(f, values)) continue;
    const raw = values[f.name];

    if (f.kind === 'multi') {
      const picked = Array.isArray(raw) ? raw.filter((v) => f.options.includes(v)) : [];
      if (!picked.length) return missing(f);
      payload[f.name] = picked;
      continue;
    }

    if (f.kind === 'rating' || f.kind === 'nps') {
      const min = f.kind === 'rating' ? 1 : 0;
      const max = f.kind === 'rating' ? 5 : 10;
      if (raw === undefined || raw === '') return missing(f);
      const n = Number(raw);
      if (!Number.isInteger(n) || n < min || n > max) return invalid(f);
      payload[f.name] = n;
      continue;
    }

    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return missing(f);

    if (f.kind === 'single') {
      if (!f.options.includes(text)) return invalid(f);
    } else {
      if (text.length > f.max) return { ok: false, error: `${f.label} must be at most ${f.max} characters` };
      if (f.kind === 'text' && f.inputType === 'email' && !EMAIL_RE.test(text)) {
        return { ok: false, error: 'Please enter a valid email address' };
      }
    }
    payload[f.name] = text;
  }

  return { ok: true, payload };
}

// ---- Admin-side stats ----

export interface RatingStat {
  name: string;
  label: string;
  average: number | null;
  count: number;
}

export function ratingStats(fields: Field[], rows: Record<string, unknown>[]): RatingStat[] {
  return fields
    .filter((f) => f.kind === 'rating')
    .map((f) => {
      const nums = rows.map((r) => r[f.name]).filter((v): v is number => typeof v === 'number');
      const average = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      return { name: f.name, label: f.label, average, count: nums.length };
    });
}

// Net Promoter Score: % promoters (9-10) minus % detractors (0-6).
export function npsScore(rows: Record<string, unknown>[]): number | null {
  const scores = rows.map((r) => r.nps).filter((v): v is number => typeof v === 'number');
  if (!scores.length) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

function csvCell(value: unknown): string {
  const s = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  // Prefix formula-like cells so spreadsheet apps don't execute user-supplied text.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(fields: Field[], rows: Record<string, unknown>[]): string {
  const columns = ['submittedAt', ...fields.map((f) => f.name)];
  const header = ['Submitted at', ...fields.map((f) => f.label)].map(csvCell).join(',');
  const lines = rows.map((r) => columns.map((c) => csvCell(r[c])).join(','));
  return [header, ...lines].join('\n');
}
