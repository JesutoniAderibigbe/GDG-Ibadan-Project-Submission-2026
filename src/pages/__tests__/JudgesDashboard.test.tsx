import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JudgesDashboard from '../JudgesDashboard';

const setDocMock = vi.fn();

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: {},
}));

const submissionsFixture = [
  {
    id: 'sub1',
    data: {
      teamName: 'Neural Ninjas',
      teamMembers: 'Ada, Bola',
      projectTitle: 'Smart Irrigation Pro',
      projectLink: 'https://demo1.example.com',
      whatBuilt: 'Waters plants automatically.',
      aiToolsUsed: 'Gemini',
      createdAt: { toMillis: () => 2000, toDate: () => new Date(2000) },
    },
  },
  {
    id: 'sub2',
    data: {
      teamName: 'Code Wizards',
      teamMembers: 'Chi',
      projectTitle: 'Budget Buddy',
      projectLink: 'https://demo2.example.com',
      whatBuilt: 'Tracks spending.',
      aiToolsUsed: 'Vertex',
      createdAt: { toMillis: () => 1000, toDate: () => new Date(1000) },
    },
  },
];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ type: 'collection', name })),
  collectionGroup: vi.fn((_db, name) => ({ type: 'collectionGroup', name })),
  query: vi.fn((ref) => ref),
  orderBy: vi.fn(),
  where: vi.fn(),
  doc: vi.fn((_db, ...segments) => ({ type: 'doc', path: segments.join('/') })),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  onSnapshot: vi.fn((ref, onNext) => {
    if (ref.type === 'collection' && ref.name === 'submissions') {
      onNext({
        forEach: (cb: (d: unknown) => void) =>
          submissionsFixture.forEach((s) => cb({ id: s.id, data: () => s.data })),
      });
    } else if (ref.type === 'collectionGroup' && ref.name === 'ratings') {
      // No existing ratings by default for this judge.
      onNext({ forEach: (_cb: (d: unknown) => void) => {} });
    }
    return () => {};
  }),
}));

describe('JudgesDashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    setDocMock.mockReset();
    setDocMock.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('shows the login gate when no judge is logged in', () => {
    render(<JudgesDashboard />);
    expect(screen.getByText(/judge portal login/i)).toBeInTheDocument();
  });

  it('rejects an invalid judge username', async () => {
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'intruder' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));

    expect(window.alert).toHaveBeenCalledWith("Invalid judge username. Use 'judge1' or 'judge2'.");
    expect(screen.getByText(/judge portal login/i)).toBeInTheDocument();
    expect(localStorage.getItem('judgeId')).toBeNull();
  });

  it('logs in a valid judge and lists submissions sorted newest first', async () => {
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge1' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));

    expect(localStorage.getItem('judgeId')).toBe('judge1');
    const titles = await screen.findAllByRole('heading', { level: 4 });
    expect(titles.map((t) => t.textContent)).toEqual(['Smart Irrigation Pro', 'Budget Buddy']);
  });

  it('filters submissions by search query', async () => {
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge2' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));

    await screen.findByText('Smart Irrigation Pro');
    fireEvent.change(screen.getByPlaceholderText(/search submissions/i), { target: { value: 'Budget' } });

    expect(screen.queryByText('Smart Irrigation Pro')).not.toBeInTheDocument();
    expect(screen.getByText('Budget Buddy')).toBeInTheDocument();
  });

  it('rejects submitting with an empty score', async () => {
    // Note: the score <input> has min="1" max="100" but no `required`, so a
    // browser (and jsdom, matching real behavior) blocks the native form
    // submission entirely for out-of-range numbers before this component's
    // JS ever runs — the only way to reach the "must be between 1 and 100"
    // branch via a real submit is to leave the field empty.
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge1' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));
    await screen.findByText('Smart Irrigation Pro');

    await userEvent.click(screen.getAllByRole('button', { name: /save rating/i })[0]);

    expect(await screen.findByText(/score must be between 1 and 100/i)).toBeInTheDocument();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('the score input enforces a native 1-100 range', () => {
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge1' } });
    fireEvent.click(screen.getByRole('button', { name: /access dashboard/i }));
    const scoreInput = screen.getAllByPlaceholderText('0')[0] as HTMLInputElement;
    expect(scoreInput.min).toBe('1');
    expect(scoreInput.max).toBe('100');
  });

  it('saves a valid rating with the correct doc path and payload', async () => {
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge1' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));
    await screen.findByText('Smart Irrigation Pro');

    const scoreInputs = screen.getAllByPlaceholderText('0');
    const commentInputs = screen.getAllByPlaceholderText(/great idea/i);
    fireEvent.change(scoreInputs[0], { target: { value: '87' } });
    fireEvent.change(commentInputs[0], { target: { value: 'Loved the demo' } });
    await userEvent.click(screen.getAllByRole('button', { name: /save rating/i })[0]);

    await waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));
    const [ref, payload, options] = setDocMock.mock.calls[0];
    expect(ref.path).toBe('submissions/sub1/ratings/judge1');
    expect(payload).toMatchObject({ score: 87, comment: 'Loved the demo', judgeId: 'judge1' });
    expect(options).toEqual({ merge: true });
  });

  it('shows a link back to the leaderboard', async () => {
    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge1' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));
    await screen.findByText('Smart Irrigation Pro');

    const link = screen.getByRole('link', { name: /view leaderboard/i });
    expect(link).toHaveAttribute('href', '/leaderboard');
  });

  it('prefills an existing rating from the single collectionGroup ratings listener', async () => {
    const { onSnapshot } = await import('firebase/firestore');
    (onSnapshot as ReturnType<typeof vi.fn>).mockImplementationOnce((ref: any, onNext: any) => {
      // submissions listener (first subscription set up by the component)
      onNext({
        forEach: (cb: (d: unknown) => void) =>
          submissionsFixture.forEach((s) => cb({ id: s.id, data: () => s.data })),
      });
      return () => {};
    }).mockImplementationOnce((ref: any, onNext: any) => {
      // ratings collectionGroup listener, pre-seeded with judge1's existing score on sub1
      onNext({
        forEach: (cb: (d: unknown) => void) =>
          cb({
            data: () => ({ score: 72, comment: 'Solid', judgeId: 'judge1' }),
            ref: { parent: { parent: { id: 'sub1' } } },
          }),
      });
      return () => {};
    });

    render(<JudgesDashboard />);
    fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'judge1' } });
    await userEvent.click(screen.getByRole('button', { name: /access dashboard/i }));
    await screen.findByText('Smart Irrigation Pro');

    const scoreInputs = await screen.findAllByPlaceholderText('0');
    expect(scoreInputs[0]).toHaveValue(72);
    expect(await screen.findByRole('button', { name: /update rating/i })).toBeInTheDocument();
  });
});
