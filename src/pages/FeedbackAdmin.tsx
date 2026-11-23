import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import {
  FEEDBACK_COLLECTIONS,
  FIELDS_BY_KIND,
  npsScore,
  ratingStats,
  toCsv,
  type FeedbackKind,
} from '../lib/feedback';
import { Download, Loader2, ShieldCheck } from 'lucide-react';

type Row = Record<string, unknown>;

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Responses({ kind }: { kind: FeedbackKind }) {
  const fields = FIELDS_BY_KIND[kind];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    getDocs(collection(db, FEEDBACK_COLLECTIONS[kind]))
      .then((snap) => {
        if (cancelled) return;
        const list: Row[] = snap.docs.map((d) => {
          const data = d.data();
          return { id: d.id, ...data, submittedAt: data.createdAt?.toDate?.()?.toISOString() ?? '' };
        });
        list.sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
        setRows(list);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Could not load responses. Your account may not be on the admin list.');
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  if (error) return <div className="p-4 bg-brand-red-pastel text-red-700 rounded-xl text-sm font-bold">{error}</div>;
  if (!rows) return <Loader2 className="w-6 h-6 animate-spin text-brand-blue mx-auto my-12" />;

  const stats = ratingStats(fields, rows);
  const nps = kind === 'attendee' ? npsScore(rows) : null;
  const textFields = fields.filter((f) => f.kind === 'text' || f.kind === 'textarea');
  const stamp = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-mono font-bold text-slate-500 uppercase tracking-widest">{rows.length} responses</p>
        <div className="flex gap-2">
          <button
            onClick={() => download(`devfest-ibadan-2026-${kind}-feedback-${stamp}.csv`, toCsv(fields, rows), 'text/csv')}
            className="px-3 py-1.5 bg-brand-ink text-white text-xs font-bold rounded-full flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => download(`devfest-ibadan-2026-${kind}-feedback-${stamp}.json`, JSON.stringify(rows, null, 2), 'application/json')}
            className="px-3 py-1.5 border border-brand-ink text-xs font-bold rounded-full flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {nps !== null && (
          <div className="bg-white rounded-2xl border-2 border-brand-ink/10 p-4">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Net Promoter Score</div>
            <div className="text-2xl font-display font-bold">{nps}</div>
          </div>
        )}
        {stats.map((s) => (
          <div key={s.name} className="bg-white rounded-2xl border-2 border-brand-ink/10 p-4">
            <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{s.label}</div>
            <div className="text-2xl font-display font-bold">
              {s.average === null ? '-' : s.average.toFixed(2)} <span className="text-xs text-slate-400 font-normal">/ 5 ({s.count})</span>
            </div>
          </div>
        ))}
      </div>

      {textFields.map((f) => {
        const answers = rows.map((r) => r[f.name]).filter((v): v is string => typeof v === 'string' && v.length > 0);
        if (!answers.length) return null;
        return (
          <section key={f.name}>
            <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">{f.label}</h3>
            <ul className="space-y-2">
              {answers.map((a, i) => (
                <li key={i} className="bg-white rounded-xl border border-brand-ink/10 p-3 text-sm whitespace-pre-line break-words">
                  {a}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function FeedbackAdmin() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('attendee');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    setSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (err) {
      console.error(err);
      setSignInError('Wrong email or password.');
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef6fc] font-sans text-brand-ink">
      <header className="bg-white border-b-2 border-brand-ink/10 px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-display font-bold">Feedback Admin</h1>
        {user && (
          <button onClick={() => signOut(auth)} className="px-3 py-1.5 border border-brand-ink text-xs font-mono font-bold rounded-full uppercase tracking-wider">
            Sign out
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {!ready ? (
          <Loader2 className="w-6 h-6 animate-spin text-brand-blue mx-auto my-12" />
        ) : !user ? (
          <form onSubmit={handleSignIn} className="max-w-sm mx-auto bg-white p-8 rounded-3xl border-2 border-brand-ink/10 space-y-4">
            <div className="w-12 h-12 bg-brand-blue-pastel text-brand-blue rounded-2xl flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500 text-center">Sign in to view feedback responses.</p>
            {signInError && <p role="alert" className="text-xs font-bold text-red-700 text-center">{signInError}</p>}
            <input
              type="email"
              aria-label="Email"
              placeholder="Email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue outline-none"
            />
            <input
              type="password"
              aria-label="Password"
              placeholder="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue outline-none"
            />
            <button type="submit" disabled={signingIn} className="w-full py-2.5 bg-brand-ink hover:bg-black text-white font-display font-bold rounded-full text-sm disabled:opacity-50">
              {signingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        ) : (
          <>
            <div className="flex gap-2 mb-6">
              {(['attendee', 'sponsor'] as FeedbackKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border ${kind === k ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  {k === 'attendee' ? 'Attendees' : 'Sponsors'}
                </button>
              ))}
            </div>
            <Responses kind={kind} />
          </>
        )}
      </main>
    </div>
  );
}
