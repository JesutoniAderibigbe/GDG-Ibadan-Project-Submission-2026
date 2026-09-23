import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExportData from '../ExportData';

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: {},
}));

const submissionsFixture = [
  {
    id: 'sub1',
    data: {
      teamName: 'Neural Ninjas',
      projectTitle: 'Smart Irrigation Pro',
      projectLink: 'https://demo1.example.com',
      githubLink: 'https://github.com/team/repo',
      teamMembers: 'Ada, Bola',
      whatBuilt: 'Waters plants.',
      whyBuilt: 'Plants kept dying.',
      aiToolsUsed: 'Gemini, Vertex',
      createdAt: { toDate: () => new Date('2026-09-01T00:00:00Z') },
    },
  },
];

const ratingsFixture = [
  { submissionId: 'sub1', data: { judgeId: 'judge1', score: 90, comment: 'Great', updatedAt: { toDate: () => new Date('2026-09-02T00:00:00Z') } } },
];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ type: 'collection', name })),
  collectionGroup: vi.fn((_db, name) => ({ type: 'collectionGroup', name })),
  getDocs: vi.fn(async (ref) => {
    if (ref.type === 'collection' && ref.name === 'submissions') {
      return {
        forEach: (cb: (d: unknown) => void) =>
          submissionsFixture.forEach((s) => cb({ id: s.id, data: () => s.data })),
      };
    }
    return {
      forEach: (cb: (d: unknown) => void) =>
        ratingsFixture.forEach((r) =>
          cb({ data: () => r.data, ref: { parent: { parent: { id: r.submissionId } } } })
        ),
    };
  }),
}));

describe('ExportData', () => {
  it('renders a JSON export with team members and AI tools split into arrays, plus nested ratings', async () => {
    render(<ExportData />);
    const pre = await screen.findByText(/Neural Ninjas/);
    const parsed = JSON.parse(pre.textContent || '[]');

    expect(parsed).toHaveLength(1);
    expect(parsed[0].teamMembers).toEqual(['Ada', 'Bola']);
    expect(parsed[0].aiToolsUsed).toEqual(['Gemini', 'Vertex']);
    expect(parsed[0].ratings).toEqual([
      { judgeId: 'judge1', score: 90, comment: 'Great', updatedAt: '2026-09-02T00:00:00.000Z' },
    ]);
    expect(parsed[0].submittedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});
