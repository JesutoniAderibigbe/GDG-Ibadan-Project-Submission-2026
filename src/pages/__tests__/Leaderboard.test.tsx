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
  { id: 'jesutoni', submissionId: 'sub1', data: { judgeId: 'jesutoni', score: 90 } },
  { id: 'abidemi', submissionId: 'sub1', data: { judgeId: 'abidemi', score: 70 } },
  { id: 'josh', submissionId: 'sub1', data: { judgeId: 'josh', score: 40 } },
  { id: 'jesutoni', submissionId: 'sub2', data: { judgeId: 'jesutoni', score: 50 } },
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

  it('sums all three judges scores correctly, out of 300', async () => {
    render(<Leaderboard />);
    await screen.findByText('Smart Irrigation Pro');
    const totals = Array.from(document.querySelectorAll('.text-4xl.font-black')).map((el) => el.textContent);
    expect(totals).toEqual(['200', '50']); // sub1: 90 + 70 + 40, sub2: 50 + (0, 0 unrated)
    expect(screen.getAllByText('/300').length).toBe(2);
  });

  it('shows "Pending" for judges who have not rated yet', async () => {
    render(<Leaderboard />);
    await screen.findByText('Smart Irrigation Pro');
    // sub1 is fully rated by all 3 judges; sub2 only has jesutoni's score,
    // so abidemi and josh should read Pending for sub2.
    const pendingLabels = screen.getAllByText('Pending');
    expect(pendingLabels).toHaveLength(2);
  });
});
