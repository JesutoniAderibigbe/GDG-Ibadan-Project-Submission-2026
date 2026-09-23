import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmissionForm from '../SubmissionForm';

const addDocMock = vi.fn();
const validateMediaFileMock = vi.fn();
const uploadToCloudinaryMock = vi.fn();

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: {},
}));

vi.mock('../../lib/media', async () => {
  const actual = await vi.importActual<typeof import('../../lib/media')>('../../lib/media');
  return {
    ...actual,
    validateMediaFile: (...args: unknown[]) => validateMediaFileMock(...args),
    uploadToCloudinary: (...args: unknown[]) => uploadToCloudinaryMock(...args),
  };
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ type: 'collection', name })),
  addDoc: (...args: unknown[]) => addDocMock(...args),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByLabelText(/team name/i), { target: { value: 'Neural Ninjas' } });
  fireEvent.change(screen.getByLabelText(/project title/i), { target: { value: 'Smart Irrigation Pro' } });
  fireEvent.change(screen.getByLabelText(/team members/i), { target: { value: 'Ada, Bola' } });
  fireEvent.change(screen.getByLabelText(/demo url/i), { target: { value: 'https://demo.example.com' } });
  fireEvent.change(screen.getByLabelText(/what did you build/i), { target: { value: 'A thing that waters plants.' } });
  fireEvent.change(screen.getByLabelText(/why did you build it/i), { target: { value: 'Plants kept dying.' } });
  fireEvent.change(screen.getByLabelText(/google ai tools used/i), { target: { value: 'Gemini' } });
}

describe('SubmissionForm', () => {
  beforeEach(() => {
    addDocMock.mockReset();
    addDocMock.mockResolvedValue({ id: 'new-doc-id' });
    validateMediaFileMock.mockReset();
    uploadToCloudinaryMock.mockReset();
    uploadToCloudinaryMock.mockResolvedValue('https://res.cloudinary.com/demo/image/upload/v1/media.jpg');
  });

  it('renders all required fields and no judges links', () => {
    render(<SubmissionForm />);
    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/project title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/team members/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/demo url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/github repository/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/what did you build/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/why did you build it/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/google ai tools used/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/screenshot or demo clip/i)).toBeInTheDocument();
    // Judges/leaderboard entry points should no longer be public on this page.
    expect(screen.queryByText(/judges login/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/judges dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/view leaderboard/i)).not.toBeInTheDocument();
  });

  it('blocks submission when "what did you build" exceeds 200 words', async () => {
    render(<SubmissionForm />);
    fillRequiredFields();
    const longText = Array(201).fill('word').join(' ');
    fireEvent.change(screen.getByLabelText(/what did you build/i), { target: { value: longText } });

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    expect(await screen.findByText(/exceeds the 200-word limit/i)).toBeInTheDocument();
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('blocks submission when "why did you build it" exceeds 200 words', async () => {
    render(<SubmissionForm />);
    fillRequiredFields();
    const longText = Array(201).fill('word').join(' ');
    fireEvent.change(screen.getByLabelText(/why did you build it/i), { target: { value: longText } });

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    expect(await screen.findByText(/exceeds the 200-word limit/i)).toBeInTheDocument();
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('submits successfully with no media attached and shows the success screen', async () => {
    render(<SubmissionForm />);
    fillRequiredFields();

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/submission received/i)).toBeInTheDocument();

    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.teamName).toBe('Neural Ninjas');
    expect(payload.createdAt).toBe('SERVER_TIMESTAMP');
    expect(payload).not.toHaveProperty('mediaUrl');
    expect(payload).not.toHaveProperty('mediaType');
    expect(uploadToCloudinaryMock).not.toHaveBeenCalled();
  });

  it('omits githubLink from the payload when left blank', async () => {
    render(<SubmissionForm />);
    fillRequiredFields();

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload).not.toHaveProperty('githubLink');
  });

  it('keeps githubLink in the payload when provided', async () => {
    render(<SubmissionForm />);
    fillRequiredFields();
    fireEvent.change(screen.getByLabelText(/github repository/i), { target: { value: 'https://github.com/team/repo' } });

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.githubLink).toBe('https://github.com/team/repo');
  });

  it('shows an error and stays on the form when the write fails', async () => {
    addDocMock.mockRejectedValueOnce(new Error('permission-denied'));
    render(<SubmissionForm />);
    fillRequiredFields();

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    expect(await screen.findByText(/failed to submit/i)).toBeInTheDocument();
    expect(screen.queryByText(/submission received/i)).not.toBeInTheDocument();
  });

  it('validates and uploads a selected image, then includes mediaUrl/mediaType in the payload', async () => {
    validateMediaFileMock.mockResolvedValue('image');

    render(<SubmissionForm />);
    fillRequiredFields();

    const file = new File(['photo bytes'], 'photo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/screenshot or demo clip/i) as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(await screen.findByText(/photo ready/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    expect(uploadToCloudinaryMock).toHaveBeenCalledTimes(1);
    expect(uploadToCloudinaryMock.mock.calls[0][0]).toBe(file);
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload.mediaUrl).toBe('https://res.cloudinary.com/demo/image/upload/v1/media.jpg');
    expect(payload.mediaType).toBe('image');
  });

  it('shows the validation error and blocks submission when the file fails validation', async () => {
    validateMediaFileMock.mockRejectedValue(new Error('Video is too large (max 75MB). Trim or compress it before uploading.'));

    render(<SubmissionForm />);
    fillRequiredFields();

    const file = new File(['big'], 'clip.mp4', { type: 'video/mp4' });
    const input = screen.getByLabelText(/screenshot or demo clip/i) as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(await screen.findByText(/video is too large/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('still submits (without media) and warns the user when the Cloudinary upload fails', async () => {
    validateMediaFileMock.mockResolvedValue('image');
    uploadToCloudinaryMock.mockRejectedValue(new Error('Upload failed. Check your connection and try again.'));

    render(<SubmissionForm />);
    fillRequiredFields();

    const file = new File(['photo bytes'], 'photo.png', { type: 'image/png' });
    const input = screen.getByLabelText(/screenshot or demo clip/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    await screen.findByText(/photo ready/i);

    await userEvent.click(screen.getByRole('button', { name: /submit project/i }));

    // A media-upload failure (Cloudinary outage/quota) must not block the
    // actual submission — the team's entry still gets written.
    await waitFor(() => expect(addDocMock).toHaveBeenCalledTimes(1));
    const [, payload] = addDocMock.mock.calls[0];
    expect(payload).not.toHaveProperty('mediaUrl');
    expect(payload).not.toHaveProperty('mediaType');

    expect(await screen.findByText(/submission received/i)).toBeInTheDocument();
    expect(await screen.findByText(/media upload failed/i)).toBeInTheDocument();
  });
});
