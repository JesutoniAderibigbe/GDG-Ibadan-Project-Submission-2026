import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../lib/firebase';
import { validateMediaFile, uploadToCloudinary, type MediaType } from '../lib/media';
import { Rocket, Loader2, Image as ImageIcon, Video, X } from 'lucide-react';

const YEAR_COLORS = ['text-brand-blue', 'text-brand-red', 'text-brand-yellow', 'text-brand-green', 'text-brand-blue'];
const CONFETTI_COLORS = ['bg-brand-blue', 'bg-brand-red', 'bg-brand-yellow', 'bg-brand-green'];
const CONFETTI = Array.from({ length: 12 }, (_, i) => ({
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  angle: (i / 12) * Math.PI * 2,
}));

function SuccessDialog({ mediaWarning, onClose }: { mediaWarning: string | null; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-ink/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Submission received"
    >
      <motion.div
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl border-2 border-brand-ink/10 p-10 text-center relative overflow-hidden"
        initial={{ opacity: 0, scale: 0.75, rotateX: 12, y: 24 }}
        animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 12 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
        style={{ perspective: 800 }}
      >
        {CONFETTI.map((dot, i) => (
          <motion.span
            key={i}
            className={`absolute top-1/2 left-1/2 w-2 h-2 rounded-full ${dot.color}`}
            initial={{ opacity: 1, x: 0, y: 0, scale: 0 }}
            animate={{
              opacity: 0,
              scale: 1,
              x: Math.cos(dot.angle) * 140,
              y: Math.sin(dot.angle) * 140,
            }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          />
        ))}

        <motion.div
          className="w-20 h-20 bg-brand-blue-pastel text-brand-blue rounded-full flex items-center justify-center mx-auto mb-6 relative"
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 380, damping: 14 }}
        >
          <Rocket className="w-10 h-10" />
        </motion.div>

        <motion.h2
          className="font-display text-2xl font-bold text-brand-ink tracking-tight mb-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Submission received!
        </motion.h2>
        <p className="text-slate-500 mb-4">Good luck with the showcase. 🚀</p>

        {mediaWarning && (
          <div className="mb-4 px-4 py-3 bg-brand-yellow-pastel border border-brand-yellow/40 rounded-xl text-xs font-bold text-amber-800 text-left">
            {mediaWarning}
          </div>
        )}

        <button onClick={onClose} className="text-brand-blue font-bold hover:text-blue-700 transition">
          Submit another project
        </button>
      </motion.div>
    </motion.div>
  );
}

type MediaState =
  | { status: 'idle' }
  | { status: 'processing' }
  | { status: 'error'; message: string }
  | { status: 'ready'; file: File; mediaType: MediaType; previewUrl: string; size: number };

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function SubmissionForm() {
  const [formData, setFormData] = useState({
    teamName: '',
    email: '',
    teamMembers: '',
    projectTitle: '',
    projectLink: '',
    githubLink: '',
    whatBuilt: '',
    whyBuilt: '',
    aiToolsUsed: '',
  });

  const [media, setMedia] = useState<MediaState>({ status: 'idle' });
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mediaWarning, setMediaWarning] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (media.status === 'ready') URL.revokeObjectURL(media.previewUrl);
    if (!file) {
      setMedia({ status: 'idle' });
      return;
    }
    setMedia({ status: 'processing' });
    try {
      const mediaType = await validateMediaFile(file);
      setMedia({
        status: 'ready',
        file,
        mediaType,
        previewUrl: URL.createObjectURL(file),
        size: file.size,
      });
    } catch (err) {
      setMedia({ status: 'error', message: err instanceof Error ? err.message : 'Could not process that file.' });
    }
  };

  const clearMedia = () => {
    if (media.status === 'ready') URL.revokeObjectURL(media.previewUrl);
    setMedia({ status: 'idle' });
  };

  const handleFirestoreError = (err: unknown, operationType: string, path: string) => {
    const errInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType,
      path,
      authInfo: { isAnonymous: true }
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    return new Error(JSON.stringify(errInfo));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMediaWarning(null);

    // Simple word count validation
    const whatBuiltWords = formData.whatBuilt.trim().split(/\s+/).length;
    const whyBuiltWords = formData.whyBuilt.trim().split(/\s+/).length;

    if (whatBuiltWords > 200) {
      setError('"What did you build?" exceeds the 200-word limit.');
      return;
    }
    if (whyBuiltWords > 200) {
      setError('"Why did you build it?" exceeds the 200-word limit.');
      return;
    }
    if (media.status === 'processing') {
      setError('Still processing your photo/video — hang on a moment and try again.');
      return;
    }
    if (media.status === 'error') {
      setError(media.message);
      return;
    }

    setIsSubmitting(true);

    let mediaUrl: string | undefined;
    let mediaType: MediaType | undefined;

    if (media.status === 'ready') {
      try {
        mediaUrl = await uploadToCloudinary(media.file, setUploadProgress);
        mediaType = media.mediaType;
      } catch (err) {
        // Never let a media-upload failure (Cloudinary outage, quota, network)
        // block the actual submission — the team's entry still matters more
        // than the screenshot. Submit without media and tell them afterward.
        setMediaWarning(
          err instanceof Error
            ? `Your project was submitted, but the media upload failed: ${err.message}`
            : 'Your project was submitted, but the media upload failed. You can email an organizer to add it manually.'
        );
      }
    }

    try {
      const submissionData = { ...formData };
      if (!submissionData.githubLink.trim()) {
        delete (submissionData as any).githubLink;
      }

      await addDoc(collection(db, 'submissions'), {
        ...submissionData,
        ...(mediaUrl ? { mediaUrl, mediaType } : {}),
        createdAt: serverTimestamp(),
      });
      setIsSuccess(true);

      // Best-effort organizer notification -- never let this affect the
      // submission itself, which already succeeded above.
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: submissionData.teamName,
          email: submissionData.email,
          projectTitle: submissionData.projectTitle,
          projectLink: submissionData.projectLink,
          aiToolsUsed: submissionData.aiToolsUsed,
        }),
      }).catch((err) => console.error('Notify request failed:', err));
    } catch (err) {
      setError('Failed to submit. Please try again.');
      handleFirestoreError(err, 'create', 'submissions');
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const resetForm = () => {
    setIsSuccess(false);
    setMediaWarning(null);
    setFormData({
      teamName: '',
      email: '',
      teamMembers: '',
      projectTitle: '',
      projectLink: '',
      githubLink: '',
      whatBuilt: '',
      whyBuilt: '',
      aiToolsUsed: '',
    });
    clearMedia();
  };

  return (
    <div className="min-h-screen bg-[#eef6fc] font-sans text-brand-ink py-12 px-4 sm:px-6 relative">
      <AnimatePresence>
        {isSuccess && <SuccessDialog mediaWarning={mediaWarning} onClose={resetForm} />}
      </AnimatePresence>
      <div className="max-w-xl mx-auto mt-10">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-1 font-display font-bold text-lg mb-6 border border-brand-ink rounded-full px-4 py-1 bg-white/70">
            <span className="text-brand-yellow">{'{'}</span>
            <span>DevFest Ibadan</span>
            <span className="text-brand-yellow">{'}'}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-ink tracking-tight leading-none">
            {'2026.'.split('').map((ch, i) => (
              <span key={i} className={YEAR_COLORS[i]}>{ch}</span>
            ))}{' '}
            Project Showcase
          </h1>
          <p className="text-xs font-mono font-bold text-slate-500 uppercase tracking-[0.2em] mt-4">Project Submission</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border-2 border-brand-ink/10 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="bg-brand-red-pastel text-red-700 p-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-brand-red/30">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="teamName" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                  Team Name
                </label>
                <input
                  type="text"
                  id="teamName"
                  name="teamName"
                  required
                  value={formData.teamName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow"
                  placeholder="e.g. Neural Ninjas"
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="projectTitle" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                  Project Title
                </label>
                <input
                  type="text"
                  id="projectTitle"
                  name="projectTitle"
                  required
                  value={formData.projectTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow"
                  placeholder="Smart Irrigation Pro"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                Email <span className="normal-case tracking-normal text-slate-400 font-normal">(so we can reach you if you're selected)</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow"
                placeholder="team@example.com"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="teamMembers" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                Team Members <span className="normal-case tracking-normal text-slate-400 font-normal">(comma-separated)</span>
              </label>
              <textarea
                id="teamMembers"
                name="teamMembers"
                required
                rows={2}
                value={formData.teamMembers}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none resize-none transition-shadow"
                placeholder="Name 1, Name 2, Name 3"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="projectLink" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                  Demo URL
                </label>
                <input
                  type="url"
                  id="projectLink"
                  name="projectLink"
                  required
                  value={formData.projectLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="githubLink" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                  GitHub Repository <span className="normal-case tracking-normal text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  id="githubLink"
                  name="githubLink"
                  value={formData.githubLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow"
                  placeholder="https://github.com/..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="whatBuilt" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                What did you build? <span className="normal-case tracking-normal text-slate-400 font-normal">(max 200 words)</span>
              </label>
              <textarea
                id="whatBuilt"
                name="whatBuilt"
                required
                rows={3}
                value={formData.whatBuilt}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none resize-none transition-shadow"
                placeholder="Describe the solution..."
              />
              <div className="text-right text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mt-1">
                {formData.whatBuilt.trim().length === 0 ? 0 : formData.whatBuilt.trim().split(/\s+/).length} / 200 words
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="whyBuilt" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                Why did you build it? <span className="normal-case tracking-normal text-slate-400 font-normal">(Problem being solved)</span>
              </label>
              <textarea
                id="whyBuilt"
                name="whyBuilt"
                required
                rows={3}
                value={formData.whyBuilt}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none resize-none transition-shadow"
                placeholder="Describe the problem..."
              />
              <div className="text-right text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase mt-1">
                {formData.whyBuilt.trim().length === 0 ? 0 : formData.whyBuilt.trim().split(/\s+/).length} / 200 words
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="aiToolsUsed" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                Google Technologies Used
              </label>
              <input
                type="text"
                id="aiToolsUsed"
                name="aiToolsUsed"
                required
                value={formData.aiToolsUsed}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow"
                placeholder="Firebase, Google Cloud, Gemini..."
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="projectMedia" className="block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest">
                Screenshot or Demo Clip <span className="normal-case tracking-normal text-slate-400 font-normal">(Optional — images up to 25MB, videos up to 75MB / 90s)</span>
              </label>

              {media.status === 'idle' && (
                <label
                  htmlFor="projectMedia"
                  className="flex flex-col items-center justify-center gap-2 w-full px-3 py-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-mono cursor-pointer hover:border-brand-blue hover:text-brand-blue transition-colors"
                >
                  <div className="flex gap-2">
                    <ImageIcon className="w-5 h-5" />
                    <Video className="w-5 h-5" />
                  </div>
                  Click to choose a photo or video
                </label>
              )}

              {media.status === 'processing' && (
                <div className="flex items-center gap-2 w-full px-3 py-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-xs font-mono">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking file...
                </div>
              )}

              {media.status === 'error' && (
                <div className="space-y-2">
                  <div className="px-3 py-3 bg-brand-red-pastel border border-brand-red/30 rounded-xl text-red-700 text-xs font-bold">
                    {media.message}
                  </div>
                  <label htmlFor="projectMedia" className="text-xs font-mono font-bold text-brand-blue cursor-pointer hover:underline">
                    Choose a different file
                  </label>
                </div>
              )}

              {media.status === 'ready' && (
                <div className="flex items-center gap-3 w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {media.mediaType === 'image' ? (
                    <img src={media.previewUrl} alt="Selected preview" className="w-14 h-14 object-cover rounded-lg shrink-0" />
                  ) : (
                    <video src={media.previewUrl} className="w-14 h-14 object-cover rounded-lg shrink-0" muted />
                  )}
                  <div className="flex-grow min-w-0">
                    <p className="text-xs font-bold text-brand-ink truncate">
                      {media.mediaType === 'image' ? 'Photo' : 'Video'} ready
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">{formatBytes(media.size)}</p>
                  </div>
                  <button type="button" onClick={clearMedia} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-brand-ink transition shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <input
                type="file"
                id="projectMedia"
                accept="image/*,video/*"
                onChange={handleMediaChange}
                className="sr-only"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || media.status === 'processing'}
                className="w-full py-3 bg-brand-ink hover:bg-black text-white font-display font-bold rounded-full transition-colors shadow-[0_0_0_3px_rgba(66,133,244,0.25)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{uploadProgress !== null ? `Uploading... ${uploadProgress}%` : 'Submitting...'}</span>
                  </>
                ) : (
                  <>
                    <span>Submit Project</span>
                    <Rocket className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
