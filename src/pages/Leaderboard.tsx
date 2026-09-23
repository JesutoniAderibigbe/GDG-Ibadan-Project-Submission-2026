import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, collectionGroup, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, Medal, Star, Target, Users, LayoutTemplate, Activity } from 'lucide-react';

interface Submission {
  id: string;
  teamName: string;
  projectTitle: string;
  whatBuilt: string;
  createdAt: any;
}

interface Rating {
  id: string;
  submissionId: string;
  judgeId: string;
  score: number;
}

export default function Leaderboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    const q1 = query(
      collection(db, 'submissions')
    );
    const sub1 = onSnapshot(q1, (snapshot) => {
      const results: Submission[] = [];
      snapshot.forEach((doc) => results.push({ id: doc.id, ...doc.data() } as Submission));
      setSubmissions(results);
    }, (err) => handleFirestoreError(err, 'list', 'submissions'));

    const q2 = query(collectionGroup(db, 'ratings'));
    const sub2 = onSnapshot(q2, (snapshot) => {
      const results: Rating[] = [];
      snapshot.forEach((doc) => {
        // extract submissionId from the reference path: submissions/{submissionId}/ratings/{judgeId}
        const submissionId = doc.ref.parent.parent?.id;
        if (submissionId) {
          results.push({ id: doc.id, submissionId, ...doc.data() } as Rating);
        }
      });
      setRatings(results);
      setIsLoading(false);
    }, (err) => {
      setIsLoading(false);
      handleFirestoreError(err, 'list', 'ratings (collectionGroup)');
    });

    return () => {
      sub1();
      sub2();
    };
  }, []);

  const aggregatedData = submissions.map((sub) => {
    const subRatings = ratings.filter((r) => r.submissionId === sub.id);
    const totalScore = subRatings.reduce((sum, r) => sum + r.score, 0);
    const judgeCount = subRatings.length;
    const isFullyRated = judgeCount === 2; // assuming 2 judges max
    return {
      ...sub,
      totalScore,
      judgeCount,
      isFullyRated,
      subRatings
    };
  }).sort((a, b) => b.totalScore - a.totalScore); // Sort by highest score

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="h-auto sm:h-16 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-8 shrink-0 z-10 sticky top-0 py-4 sm:py-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 line-clamp-1">
            Build-a-Thon <span className="text-indigo-600 hidden sm:inline">— Leaderboard</span>
          </h1>
        </div>
        <div className="flex gap-4">
            <a href="/judges" className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg uppercase tracking-wider transition">
              Judges
            </a>
            <a href="/" className="px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg uppercase tracking-wider transition">
              Submit Form
            </a>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400 space-y-4">
            <Activity className="w-8 h-8 animate-pulse text-indigo-400" />
            <p className="font-medium">Calculating scores...</p>
          </div>
        ) : aggregatedData.length === 0 ? (
          <div className="bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 mt-10">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center mb-3">
              <LayoutTemplate className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-xs font-bold text-slate-400 tracking-wide uppercase">No submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {aggregatedData.map((data, index) => (
              <div 
                key={data.id} 
                className={`bg-white rounded-2xl border ${index < 3 ? 'border-indigo-200 shadow-md' : 'border-slate-200 shadow-sm'} p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden transition-all hover:shadow-lg`}
              >
                {index === 0 && <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-yellow-300/30 to-transparent rounded-bl-full pointer-events-none" />}
                {index === 1 && <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-slate-300/30 to-transparent rounded-bl-full pointer-events-none" />}
                {index === 2 && <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-600/20 to-transparent rounded-bl-full pointer-events-none" />}
                
                <div className="flex items-center gap-6 flex-grow">
                  <div className="flex flex-col items-center justify-center w-12 shrink-0">
                    {index === 0 ? <Medal className="w-10 h-10 text-yellow-500 mb-1" /> :
                     index === 1 ? <Medal className="w-8 h-8 text-slate-400 mb-1" /> :
                     index === 2 ? <Medal className="w-8 h-8 text-amber-600 mb-1" /> :
                     <span className="text-2xl font-black text-slate-300 tracking-tighter">#{index + 1}</span>}
                  </div>
                  
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 leading-tight mb-1">{data.projectTitle || 'Untitled'}</h2>
                    <div className="flex items-center text-xs font-bold text-indigo-600 uppercase tracking-widest mb-2">
                       {data.teamName || 'N/A'}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 italic font-serif">"{data.whatBuilt || 'No description provided.'}"</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-center space-x-6 sm:pl-6 sm:border-l border-slate-100 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0">
                   <div className="text-center">
                     <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Score</span>
                     <div className="flex items-baseline justify-center gap-1 text-slate-900">
                       <span className="text-4xl font-black">{data.totalScore}</span>
                       <span className="text-sm font-bold text-slate-400">/200</span>
                     </div>
                   </div>
                   
                   <div className="flex flex-col gap-2">
                     {['judge1', 'judge2'].map((jId) => {
                       const r = data.subRatings.find(sr => sr.judgeId === jId);
                       return (
                         <div key={jId} className="flex items-center gap-2 text-xs font-bold bg-slate-50 px-2 py-1 rounded">
                           <span className={r ? 'text-green-600' : 'text-slate-400'}>
                             {jId.toUpperCase()}:
                           </span>
                           <span className={r ? 'text-slate-900' : 'text-slate-400 font-normal italic'}>
                             {r ? r.score : 'Pending'}
                           </span>
                         </div>
                       );
                     })}
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
