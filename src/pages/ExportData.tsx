import { useState, useEffect } from 'react';
import { collection, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Download, Copy, Check, ChevronLeft } from 'lucide-react';

export default function ExportData() {
  const [data, setData] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'submissions'));
        const ratingsSnap = await getDocs(collectionGroup(db, 'ratings'));
        
        const allRatings: Record<string, any[]> = {};
        
        ratingsSnap.forEach(doc => {
           const submissionId = doc.ref.parent.parent?.id;
           if (submissionId) {
              if (!allRatings[submissionId]) allRatings[submissionId] = [];
              allRatings[submissionId].push({
                 judgeId: doc.data().judgeId,
                 score: doc.data().score,
                 comment: doc.data().comment,
                 updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null
              });
           }
        });

        const results: any[] = [];
        snap.forEach(doc => {
          const d = doc.data();
          results.push({
            id: doc.id,
            teamName: d.teamName,
            email: d.email,
            projectTitle: d.projectTitle,
            projectLink: d.projectLink,
            githubLink: d.githubLink,
            teamMembers: (d.teamMembers || "").split(',').map((x: string) => x.trim()).filter(Boolean),
            whatBuilt: d.whatBuilt,
            whyBuilt: d.whyBuilt,
            aiToolsUsed: (d.aiToolsUsed || "").split(',').map((x: string) => x.trim()).filter(Boolean),
            mediaUrl: d.mediaUrl || null,
            mediaType: d.mediaType || null,
            submittedAt: d.createdAt?.toDate?.()?.toISOString() || null,
            ratings: allRatings[doc.id] || []
          });
        });

        // Sort by newest
        results.sort((a, b) => {
          return (new Date(b.submittedAt || 0).getTime()) - (new Date(a.submittedAt || 0).getTime());
        });
        
        setData(results);
      } catch (err) {
        console.error("Failed to load export data:", err);
      }
    }
    load();
  }, []);

  const jsonString = data ? JSON.stringify(data, null, 2) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devfest-ibadan-2026-project-showcase-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!data) return <div className="p-8 text-slate-500 font-mono tracking-wider animate-pulse flex items-center justify-center min-h-screen bg-slate-950">Fetching raw data from database...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-mono flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 backdrop-blur-md sticky top-0 z-10">
        <div>
          <h1 className="text-white font-display font-bold text-lg flex items-center gap-2">
			<span className="text-brand-yellow">{'{ }'}</span> JSON Export
		  </h1>
          <p className="text-xs text-slate-500 mt-1">Raw machine-readable data for AI processing or web scraping.</p>
        </div>
        <div className="flex gap-3">
          <a href="/judges" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-full flex items-center gap-2 transition mr-4">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </a>
          <button
            onClick={handleCopy}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-full flex items-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-brand-green" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold rounded-full flex items-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            Download .json
          </button>
        </div>
      </div>
      <div className="p-6 overflow-auto flex-1">
        <pre className="text-[13px] leading-relaxed text-emerald-400 break-words whitespace-pre-wrap font-mono" id="raw-json">
          {jsonString}
        </pre>
      </div>
    </div>
  );
}
