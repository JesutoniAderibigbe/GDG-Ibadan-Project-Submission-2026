import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { Search, ExternalLink, Github, Users, Wrench, Clock, Activity, LayoutTemplate, ShieldCheck, Loader2 } from 'lucide-react';

interface Submission {
  id: string;
  teamName: string;
  teamMembers: string;
  projectTitle: string;
  projectLink: string;
  githubLink?: string;
  whatBuilt: string;
  whyBuilt: string;
  aiToolsUsed: string;
  createdAt: any;
}

interface Rating {
  score: number;
  comment: string;
  judgeId: string;
}

function RatingForm({ submissionId, judgeId, existingRating }: { submissionId: string, judgeId: string, existingRating?: Rating }) {
  const [score, setScore] = useState<number | ''>(existingRating ? existingRating.score : '');
  const [comment, setComment] = useState(existingRating ? existingRating.comment : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingRating) {
      setScore(existingRating.score);
      setComment(existingRating.comment);
    }
  }, [existingRating]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score === '' || score < 1 || score > 100) {
      setError('Score must be between 1 and 100');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      const ratingRef = doc(db, 'submissions', submissionId, 'ratings', judgeId);
      await setDoc(ratingRef, {
        score: Number(score),
        comment,
        judgeId,
        updatedAt: serverTimestamp()
      }, { merge: true }); // Use merge to allow upsert matching the security rule update pattern
    } catch (err) {
      console.error(err);
      setError('Failed to save rating');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 pt-5 border-t border-slate-100 flex flex-col gap-3">
      {error && <div className="text-red-500 text-[10px] font-bold">{error}</div>}
      <div className="flex items-center gap-3">
        <div className="w-16 shrink-0">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Score /100</label>
          <input 
            type="number" 
            min="1" max="100" 
            value={score}
            onChange={(e) => setScore(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="0"
          />
        </div>
        <div className="flex-grow">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Feedback</label>
          <input 
            type="text" 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Great idea..."
          />
        </div>
      </div>
      <button 
        type="submit" 
        disabled={isSubmitting || (score === existingRating?.score && comment === existingRating?.comment)}
        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold min-h-7 uppercase tracking-wider rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : (existingRating ? 'Update Rating' : 'Save Rating')}
      </button>
    </form>
  )
}

export default function JudgesDashboard() {
  const [judgeId, setJudgeId] = useState<string | null>(() => localStorage.getItem('judgeId'));
  const [loginInput, setLoginInput] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Track all ratings by submission map
  const [myRatings, setMyRatings] = useState<Record<string, Rating>>({});

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const id = loginInput.trim().toLowerCase();
    if (id === 'judge1' || id === 'judge2') {
      localStorage.setItem('judgeId', id);
      setJudgeId(id);
    } else {
      alert("Invalid judge username. Use 'judge1' or 'judge2'.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('judgeId');
    setJudgeId(null);
  };

  const handleFirestoreError = (err: unknown, operationType: string, path: string) => {
    const errInfo = {
      error: err instanceof Error ? err.message : String(err),
      operationType,
      path,
      authInfo: { isAnonymous: true }
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  };

  useEffect(() => {
    if (!judgeId) return;

    setIsLoading(true);
    const q = query(
      collection(db, 'submissions')
    );
    
    const unsubscribeSubmissions = onSnapshot(
      q,
      (snapshot) => {
        const results: Submission[] = [];
        snapshot.forEach((doc) => results.push({ id: doc.id, ...doc.data() } as Submission));
        
        // Sort client side to handle missing createdAt gracefully
        results.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        
        setSubmissions(results);
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
        handleFirestoreError(error, 'list', 'submissions');
      }
    );

    return () => unsubscribeSubmissions();
  }, [judgeId]);

  // Separate effect to fetch ratings individually for each submission
  useEffect(() => {
    if (!judgeId || submissions.length === 0) return;

    const unsubscribers = submissions.map(sub => {
      const ratingRef = doc(db, 'submissions', sub.id, 'ratings', judgeId);
      return onSnapshot(ratingRef, (docSnap) => {
        if (docSnap.exists()) {
          setMyRatings(prev => ({ ...prev, [sub.id]: docSnap.data() as Rating }));
        }
      });
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [submissions, judgeId]);

  if (!judgeId) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-2 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold text-slate-900">Judge Portal Login</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Enter your assigned username</p>
          </div>
          <input 
            type="text" 
            placeholder="Username (judge1 or judge2)" 
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
          <button type="submit" className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition mt-2 text-sm">
            Access Dashboard
          </button>
        </form>
      </div>
    );
  }

  const filteredSubmissions = submissions.filter((sub) => {
    const query = searchQuery.toLowerCase();
    const tName = sub.teamName || '';
    const pTitle = sub.projectTitle || '';
    return (
      tName.toLowerCase().includes(query) ||
      pTitle.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-auto sm:h-16 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-8 shrink-0 z-10 sticky top-0 gap-4 sm:gap-0 py-4 sm:py-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45"></div>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 line-clamp-1">
            Judges Dashboard <span className="text-indigo-600 hidden sm:inline">— Hello, {judgeId}</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative flex-grow sm:flex-grow-0">
            <input
              type="text"
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-slate-100 border-none rounded-full text-sm w-full sm:w-64 focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          </div>
          <button onClick={handleLogout} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-full uppercase tracking-wider shrink-0 transition">
            Log Out
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400 space-y-4">
            <Activity className="w-8 h-8 animate-pulse text-indigo-400" />
            <p className="font-medium">Loading submissions...</p>
          </div>
        ) : filteredSubmissions.length === 0 ? (
          <div className="bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 mt-10">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center mb-3">
              <LayoutTemplate className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">Waiting for entries...</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-2">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                Recent Submissions ({filteredSubmissions.length})
              </h3>
              <div className="flex items-center gap-4">
                 <a href="/leaderboard" className="text-xs font-bold text-indigo-600 uppercase tracking-widest hover:underline">
                   View Leaderboard
                 </a>
                <span className="text-xs text-indigo-600 font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Live Update Active
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredSubmissions.map((sub) => (
                <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-bold text-indigo-600 uppercase mb-2 block">
                        <span className="text-slate-400 mr-1">Team Name:</span> {sub.teamName || 'N/A'}
                      </span>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Project Name:</span>
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">
                          {sub.projectTitle || 'Untitled'}
                        </h4>
                      </div>
                    </div>
                    {sub.createdAt && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                        {sub.createdAt?.toDate ? formatDistanceToNow(sub.createdAt.toDate(), { addSuffix: true }) : 'just now'}
                      </span>
                    )}
                  </div>

                  <div className="mb-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Team Members:</span>
                    <div className="flex flex-wrap gap-[4px]">
                      {(sub.teamMembers || '').split(',').filter(Boolean).map((member, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-500 truncate max-w-[120px]" title={member.trim()}>
                          {member.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4 flex-grow">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">What they built:</span>
                    <p className="text-sm text-slate-600 line-clamp-3 italic font-serif">
                      "{sub.whatBuilt || 'No description provided.'}"
                    </p>
                  </div>

                  <div className="mb-5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">AI Tools Used:</span>
                    <div className="flex flex-wrap gap-[4px]">
                      {(sub.aiToolsUsed || '').split(',').filter(Boolean).map((tool, i) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[10px] font-bold text-indigo-600 truncate max-w-[100px]" title={tool.trim()}>
                          {tool.trim()}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {sub.projectLink && (
                      <a
                        href={sub.projectLink.startsWith('http') ? sub.projectLink : `https://${sub.projectLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded flex items-center justify-center hover:bg-slate-800 transition uppercase tracking-wider"
                      >
                        Live Demo
                      </a>
                    )}
                    {sub.githubLink && (
                      <a
                        href={sub.githubLink.startsWith('http') ? sub.githubLink : `https://${sub.githubLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 border border-slate-200 text-slate-700 text-[10px] font-bold rounded flex items-center justify-center hover:bg-slate-50 transition uppercase tracking-wider"
                      >
                        GitHub
                      </a>
                    )}
                  </div>
                  
                  <RatingForm submissionId={sub.id} judgeId={judgeId} existingRating={myRatings[sub.id]} />
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
