import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Rocket, Loader2 } from 'lucide-react';

export default function SubmissionForm() {
  const [formData, setFormData] = useState({
    teamName: '',
    teamMembers: '',
    projectTitle: '',
    projectLink: '',
    githubLink: '',
    whatBuilt: '',
    whyBuilt: '',
    aiToolsUsed: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
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
    setIsSubmitting(true);
    setError(null);

    // Simple word count validation
    const whatBuiltWords = formData.whatBuilt.trim().split(/\\s+/).length;
    const whyBuiltWords = formData.whyBuilt.trim().split(/\\s+/).length;

    if (whatBuiltWords > 200) {
      setError('"What did you build?" exceeds the 200-word limit.');
      setIsSubmitting(false);
      return;
    }
    if (whyBuiltWords > 200) {
      setError('"Why did you build it?" exceeds the 200-word limit.');
      setIsSubmitting(false);
      return;
    }

    try {
      const submissionData = { ...formData };
      if (!submissionData.githubLink.trim()) {
        delete (submissionData as any).githubLink;
      }

      await addDoc(collection(db, 'submissions'), {
        ...submissionData,
        createdAt: serverTimestamp(),
      });
      setIsSuccess(true);
    } catch (err) {
      setError('Failed to submit. Please try again.');
      throw handleFirestoreError(err, 'create', 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Rocket className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-3">Submission received!</h2>
          <p className="text-slate-500 mb-8">Good luck with the showcase. 🚀</p>
          <button
            onClick={() => {
              setIsSuccess(false);
              setFormData({
                teamName: '',
                teamMembers: '',
                projectTitle: '',
                projectLink: '',
                githubLink: '',
                whatBuilt: '',
                whyBuilt: '',
                aiToolsUsed: '',
              });
            }}
            className="text-indigo-600 font-bold hover:text-indigo-700 transition"
          >
            Submit another project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 py-12 px-4 sm:px-6 relative">
      <div className="absolute top-4 right-4 flex gap-4">
        <a href="/leaderboard" className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg uppercase tracking-wider transition">
          View Leaderboard
        </a>
        <a href="/judges" className="px-4 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-[10px] font-bold rounded-lg uppercase tracking-wider transition">
          Judges Login
        </a>
      </div>
      <div className="max-w-xl mx-auto mt-6">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-indigo-200">
            <div className="w-6 h-6 border-2 border-white rounded-md rotate-45"></div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
            Build with AI Ibadan 2026
            <span className="block text-indigo-600 mt-1">Build-a-Thon</span>
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-4">Project Submission</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg text-xs font-bold uppercase tracking-wider">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="teamName" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                  Team Name
                </label>
                <input
                  type="text"
                  id="teamName"
                  name="teamName"
                  required
                  value={formData.teamName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  placeholder="e.g. Neural Ninjas"
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <label htmlFor="projectTitle" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                  Project Title
                </label>
                <input
                  type="text"
                  id="projectTitle"
                  name="projectTitle"
                  required
                  value={formData.projectTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  placeholder="Smart Irrigation Pro"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="teamMembers" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                Team Members <span className="normal-case tracking-normal text-slate-400 font-normal">(comma-separated)</span>
              </label>
              <textarea
                id="teamMembers"
                name="teamMembers"
                required
                rows={2}
                value={formData.teamMembers}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-shadow"
                placeholder="Name 1, Name 2, Name 3"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="projectLink" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                  Demo URL
                </label>
                <input
                  type="url"
                  id="projectLink"
                  name="projectLink"
                  required
                  value={formData.projectLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="githubLink" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                  GitHub Repository <span className="normal-case tracking-normal text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  id="githubLink"
                  name="githubLink"
                  value={formData.githubLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                  placeholder="https://github.com/..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="whatBuilt" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                What did you build? <span className="normal-case tracking-normal text-slate-400 font-normal">(max 200 words)</span>
              </label>
              <textarea
                id="whatBuilt"
                name="whatBuilt"
                required
                rows={3}
                value={formData.whatBuilt}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-shadow"
                placeholder="Describe the solution..."
              />
              <div className="text-right text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">
                {formData.whatBuilt.trim().length === 0 ? 0 : formData.whatBuilt.trim().split(/\\s+/).length} / 200 words
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="whyBuilt" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                Why did you build it? <span className="normal-case tracking-normal text-slate-400 font-normal">(Problem being solved)</span>
              </label>
              <textarea
                id="whyBuilt"
                name="whyBuilt"
                required
                rows={3}
                value={formData.whyBuilt}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-shadow"
                placeholder="Describe the problem..."
              />
              <div className="text-right text-[10px] font-bold text-slate-400 tracking-widest uppercase mt-1">
                {formData.whyBuilt.trim().length === 0 ? 0 : formData.whyBuilt.trim().split(/\\s+/).length} / 200 words
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="aiToolsUsed" className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                Google AI Tools Used
              </label>
              <input
                type="text"
                id="aiToolsUsed"
                name="aiToolsUsed"
                required
                value={formData.aiToolsUsed}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                placeholder="Gemini, Vertex..."
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
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
        
        <div className="mt-8 text-center pb-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <a href="/judges" className="hover:text-indigo-600 transition">
            Judges Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
