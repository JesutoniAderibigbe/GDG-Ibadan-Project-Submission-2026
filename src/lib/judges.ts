// Single source of truth for who's allowed to judge. Keep this in sync with
// the `judgeId in [...]` allowlist in firestore.rules -- the client-side
// check here is just UX (clear error message); the Firestore rule is what
// actually enforces it, since anyone can bypass the UI and call the API directly.
export const VALID_JUDGES = ['jesutoni', 'abidemi', 'josh'];

export function isValidJudge(id: string): boolean {
  return VALID_JUDGES.includes(id.trim().toLowerCase());
}
