import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Leaderboard from '../Leaderboard';

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: {},
}));

const submissionsFixture = [
  { id: 'sub1', data: { teamName: 'Neural Ninjas', projectTitle: 'Smart Irrigation Pro', whatBuilt: 'Waters plants.', createdAt: { toMillis: () => 2000 } } },
  { id: 'sub2', data: { teamName: 'Code Wizards', projectTitle: 'Budget Buddy', whatBuilt: 'Tracks spending.', createdAt: { toMillis: () => 1000 } } },
];

const ratingsFixture = [
  { id: 'judge1', submissionId: 'sub1', data: { judgeId: 'judge1', score: 90 } },
  { id: 'judge2', submissionId: 'sub1', data: { judgeId: 'judge2', score: 70 } },
  { id: 'judge1', submissionId: 'sub2', data: { judgeId: 'judge1', score: 50 } },
];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ type: 'collection', name })),
  collectionGroup: vi.fn((_db, name) => ({ type: 'collectionGroup', name })),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn((ref, onNext) => {
    if (ref.type === 'collection' && ref.name === 'submissions') {
      onNext({
        forEach: (cb: (d: unknown) => void) =>
          submissionsFixture.forEach((s) => cb({ id: s.id, data: () => s.data })),
      });
    } else if (ref.type === 'collectionGroup' && ref.name === 'ratings') {
      onNext({
        forEach: (cb: (d: unknown) => void) =>
          ratingsFixture.forEach((r) =>
            cb({
              id: r.id,
              data: () => r.data,
              ref: { parent: { parent: { id: r.submissionId } } },
            })
          ),
      });
    }
    return () => {};
  }),
}));

describe('Leaderboard', () => {
  it('ranks submissions by total score, highest first', async () => {
    render(<Leaderboard />);
    const titles = await screen.findAllByRole('heading', { level: 2 });
    expect(titles.map((t) => t.textContent)).toEqual(['Smart Irrigation Pro', 'Budget Buddy']);
  });

  it('sums both judges scores correctly', async () => {
    render(<Leaderboard />);
    await screen.findByText('Smart Irrigation Pro');
    const totals = Array.from(document.querySelectorAll('.text-4xl.font-black')).map((el) => el.textContent);
    expect(totals).toEqual(['160', '50']); // sub1: 90 + 70, sub2: 50 + (0, unrated)
  });

  it('shows "Pending" for a judge who has not rated yet', async () => {
    render(<Leaderboard />);
    await screen.findByText('Smart Irrigation Pro');
    // sub2 only has judge1's score; judge2 should read Pending.
    const pendingLabels = screen.getAllByText('Pending');
    expect(pendingLabels.length).toBeGreaterThan(0);
  });
});
