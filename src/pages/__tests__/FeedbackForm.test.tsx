import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeedbackForm from '../FeedbackForm';

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

describe('FeedbackForm', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'x' });
    localStorage.clear();
    window.scrollTo = vi.fn();
  });

  it('shows separate enjoyed-most and improve questions for attendees', () => {
    render(<FeedbackForm kind="attendee" />);
    expect(screen.getByLabelText(/what did you enjoy most/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what should we improve/i)).toBeInTheDocument();
  });

  it('blocks submission and shows an error when a required rating is missing', async () => {
    render(<FeedbackForm kind="attendee" />);
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/overall experience/i);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('submits an attendee response to attendeeFeedback with a server timestamp', async () => {
    render(<FeedbackForm kind="attendee" />);
    rate(/^overall experience/i, 5);
    fireEvent.click(screen.getAllByRole('radio', { name: '9 out of 10' })[0]);
    rate(/^venue/i, 4);
    rate(/^sessions and speakers/i, 5);
    rate(/^organisation/i, 4);
    rate(/^food and refreshments/i, 3);
    rate(/^networking/i, 5);
    fireEvent.change(screen.getByLabelText(/what did you enjoy most/i), { target: { value: 'The quiz' } });
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    const [ref, data] = addDocMock.mock.calls[0];
    expect(ref).toMatchObject({ name: 'attendeeFeedback' });
    expect(data).toEqual({
      overall: 5, nps: 9, venue: 4, sessions: 5, organisation: 4, food: 3, networking: 5,
      enjoyedMost: 'The quiz', createdAt: 'SERVER_TIMESTAMP',
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
    rate(/^overall experience/i, 5);
    fireEvent.click(screen.getAllByRole('radio', { name: '9 out of 10' })[0]);
    for (const l of [/^venue/i, /^sessions and speakers/i, /^organisation/i, /^food and refreshments/i, /^networking/i]) rate(l, 4);
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
    expect(screen.queryByText(/feedback received/i)).not.toBeInTheDocument();
  });
});
