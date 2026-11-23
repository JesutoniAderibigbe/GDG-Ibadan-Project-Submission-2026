import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import FeedbackForm from '../FeedbackForm';
import { SESSION_GROUPS } from '../../lib/feedback';

const addDocMock = vi.fn();

vi.mock('../../lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ type: 'collection', name })),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

function rate(group: RegExp, n: number) {
  const radios = screen.getAllByRole('radiogroup', { name: group })[0];
  fireEvent.click(radios.querySelectorAll('[role="radio"]')[n - 1]);
}

function choose(group: RegExp, option: string) {
  const g = screen.getAllByRole('radiogroup', { name: group })[0];
  fireEvent.click(within(g).getByRole('radio', { name: option }));
}

function tick(group: RegExp, option: string) {
  const g = screen.getByRole('group', { name: group });
  fireEvent.click(within(g).getByRole('checkbox', { name: option }));
}

function fillAttendee({ vibe = 'No' as 'Yes' | 'No' } = {}) {
  rate(/^overall experience/i, 5);
  fireEvent.click(screen.getAllByRole('radio', { name: '9 out of 10' })[0]);
  rate(/^venue/i, 4);
  rate(/^sessions and speakers/i, 5);
  rate(/^organisation/i, 4);
  rate(/^food and refreshments/i, 3);
  rate(/^networking/i, 5);
  tick(/which hall/i, 'Vibe Lounge');
  fireEvent.change(screen.getByLabelText(/favourite session/i), { target: { value: SESSION_GROUPS[2].options[0] } });
  fireEvent.change(screen.getByLabelText(/what did you enjoy most/i), { target: { value: 'The quiz' } });
  fireEvent.change(screen.getByLabelText(/what should we improve/i), { target: { value: 'More seats' } });
  choose(/take part in the quiz/i, 'No');
  choose(/take part in the vibe lounge/i, vibe);
  tick(/which topics/i, 'AI');
  choose(/your role/i, 'First time in tech');
  fireEvent.change(screen.getByLabelText(/how did you hear/i), { target: { value: 'Twitter' } });
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'ada@example.com' } });
}

describe('FeedbackForm', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'x' });
    localStorage.clear();
    window.scrollTo = vi.fn();
  });

  it('shows separate enjoyed-most and improve questions, the new halls and roles, and no showcase question', () => {
    render(<FeedbackForm kind="attendee" />);
    expect(screen.getByLabelText(/what did you enjoy most/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what should we improve/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Main Hall (Hall 1)' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Vibe Lounge' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Hall 4' })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'First time in tech' })).toBeInTheDocument();
    expect(screen.queryByText(/project showcase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/optional/i)).not.toBeInTheDocument();
  });

  it('offers the favourite session as a dropdown grouped by room, including a single Vibe Lounge option', () => {
    render(<FeedbackForm kind="attendee" />);
    const select = screen.getByLabelText(/favourite session/i) as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.querySelectorAll('optgroup')).toHaveLength(5);
    expect(select.querySelectorAll('option:not([disabled])')).toHaveLength(26);
    expect(within(select).getAllByRole('option', { name: /vibe lounge/i })).toHaveLength(1);
    expect(within(select).getByRole('option', { name: /Building Distributed Systems with gRPC — Adeshina Lasisi/ })).toBeInTheDocument();
  });

  it('only shows the Vibe Lounge rating after answering Yes', () => {
    render(<FeedbackForm kind="attendee" />);
    expect(screen.queryByRole('radiogroup', { name: /rate the vibe lounge/i })).not.toBeInTheDocument();
    choose(/take part in the vibe lounge/i, 'Yes');
    expect(screen.getByRole('radiogroup', { name: /rate the vibe lounge/i })).toBeInTheDocument();
  });

  it('blocks submission and shows an error when a question is unanswered', async () => {
    render(<FeedbackForm kind="attendee" />);
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/overall experience/i);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('will not submit without the what-did-you-enjoy answer', async () => {
    render(<FeedbackForm kind="attendee" />);
    fillAttendee();
    fireEvent.change(screen.getByLabelText(/what did you enjoy most/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/what did you enjoy most/i);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('submits a complete attendee response to attendeeFeedback without any sign-in', async () => {
    render(<FeedbackForm kind="attendee" />);
    fillAttendee();
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    const [ref, data] = addDocMock.mock.calls[0];
    expect(ref).toMatchObject({ name: 'attendeeFeedback' });
    expect(data).toEqual({
      overall: 5, nps: 9, venue: 4, sessions: 5, organisation: 4, food: 3, networking: 5,
      halls: ['Vibe Lounge'], favourite: SESSION_GROUPS[2].options[0], enjoyedMost: 'The quiz', improve: 'More seats',
      tookQuiz: 'No', tookVibe: 'No', topics: ['AI'], role: 'First time in tech', heardFrom: 'Twitter',
      email: 'ada@example.com', createdAt: 'SERVER_TIMESTAMP',
    });
    expect(await screen.findByText(/feedback received/i)).toBeInTheDocument();
  });

  it('requires a contact email for sponsors', async () => {
    render(<FeedbackForm kind="sponsor" />);
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Chowdeck' } });
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ada' } });
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/contact email/i);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('shows an error and stays on the form when the write fails', async () => {
    addDocMock.mockRejectedValue(new Error('denied'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<FeedbackForm kind="attendee" />);
    fillAttendee();
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/feedback received/i)).not.toBeInTheDocument();
  });
});
