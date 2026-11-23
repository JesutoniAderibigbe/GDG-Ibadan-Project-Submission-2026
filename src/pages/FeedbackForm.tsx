import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  FEEDBACK_COLLECTIONS,
  FIELDS_BY_KIND,
  buildPayload,
  isVisible,
  type Field,
  type FeedbackKind,
  type FormValues,
} from '../lib/feedback';
import { Loader2, Star, CheckCircle2 } from 'lucide-react';

const COPY: Record<FeedbackKind, { title: string; intro: string; thanks: string }> = {
  attendee: {
    title: 'Attendee Feedback',
    intro: 'Thanks for joining us! It takes about 2 minutes and helps us make next year even better.',
    thanks: 'Thank you for your feedback. See you at the next one!',
  },
  sponsor: {
    title: 'Sponsor Feedback',
    intro: 'Thank you for supporting DevFest Ibadan. Your honest feedback helps us improve what we offer sponsors.',
    thanks: 'Thank you for your feedback and for supporting the community.',
  },
};

const INPUT =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none transition-shadow';
const LABEL = 'block text-[10px] font-mono font-bold uppercase text-slate-500 tracking-widest';

function Label({ field, htmlFor }: { field: Field; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={LABEL}>
      {field.label}
    </label>
  );
}

function RatingInput({ field, value, onChange }: { field: Field; value: number | undefined; onChange: (n: number | undefined) => void }) {
  return (
    <div role="radiogroup" aria-label={field.label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} out of 5`}
          onClick={() => onChange(value === n ? undefined : n)}
          className="p-1 rounded-lg hover:bg-slate-100 transition"
        >
          <Star className={`w-7 h-7 ${value !== undefined && n <= value ? 'fill-brand-yellow text-brand-yellow' : 'text-slate-300'}`} />
        </button>
      ))}
    </div>
  );
}

function NpsInput({ field, value, onChange }: { field: Field; value: number | undefined; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label={field.label}>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} out of 10`}
            onClick={() => onChange(n)}
            className={`py-2 rounded-lg text-xs font-bold border transition ${
              value === n ? 'bg-brand-ink text-white border-brand-ink' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
    </div>
  );
}

function Chips({ options, selected, multi, onToggle, label }: { options: string[]; selected: string[]; multi: boolean; onToggle: (o: string) => void; label: string }) {
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            role={multi ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => onToggle(o)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              on ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export default function FeedbackForm({ kind }: { kind: FeedbackKind }) {
  const fields = FIELDS_BY_KIND[kind];
  const copy = COPY[kind];
  const storageKey = `feedback-submitted-${kind}`;

  const [values, setValues] = useState<FormValues>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  const set = (name: string, value: FormValues[string]) => setValues((v) => ({ ...v, [name]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = buildPayload(fields, values);
    if ('error' in result) {
      setError(result.error);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, FEEDBACK_COLLECTIONS[kind]), { ...result.payload, createdAt: serverTimestamp() });
      try {
        localStorage.setItem(storageKey, '1');
      } catch {
        /* private mode: fine, the duplicate guard is best-effort */
      }
      setDone(true);
      setValues({});
    } catch (err) {
      console.error(err);
      setError('Something went wrong sending your feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (f: Field) => {
    switch (f.kind) {
      case 'rating':
        return <RatingInput field={f} value={values[f.name] as number | undefined} onChange={(n) => set(f.name, n)} />;
      case 'nps':
        return <NpsInput field={f} value={values[f.name] as number | undefined} onChange={(n) => set(f.name, n)} />;
      case 'single':
        return (
          <Chips
            label={f.label}
            options={f.options}
            multi={false}
            selected={values[f.name] ? [String(values[f.name])] : []}
            onToggle={(o) => set(f.name, values[f.name] === o ? undefined : o)}
          />
        );
      case 'multi': {
        const selected = (values[f.name] as string[] | undefined) ?? [];
        return (
          <Chips
            label={f.label}
            options={f.options}
            multi
            selected={selected}
            onToggle={(o) => set(f.name, selected.includes(o) ? selected.filter((s) => s !== o) : [...selected, o])}
          />
        );
      }
      case 'select':
        return (
          <select
            id={f.name}
            value={(values[f.name] as string) ?? ''}
            onChange={(e) => set(f.name, e.target.value || undefined)}
            className={INPUT}
          >
            <option value="" disabled>
              Choose a session or speaker
            </option>
            {f.groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        );
      case 'textarea':
        return (
          <textarea
            id={f.name}
            rows={3}
            maxLength={f.max}
            value={(values[f.name] as string) ?? ''}
            onChange={(e) => set(f.name, e.target.value)}
            className={`${INPUT} resize-none`}
            placeholder={f.placeholder}
          />
        );
      case 'text':
        return (
          <input
            id={f.name}
            type={f.inputType ?? 'text'}
            maxLength={f.max}
            value={(values[f.name] as string) ?? ''}
            onChange={(e) => set(f.name, e.target.value)}
            className={INPUT}
            placeholder={f.placeholder}
            required
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#eef6fc] font-sans text-brand-ink py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto mt-10">
        <div className="mb-8 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-1 font-display font-bold text-lg mb-6 border border-brand-ink rounded-full px-4 py-1 bg-white/70">
            <span className="text-brand-yellow">{'{'}</span>
            <span>DevFest Ibadan</span>
            <span className="text-brand-yellow">{'}'}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight leading-none">{copy.title}</h1>
          <p className="text-sm text-slate-500 mt-4 max-w-md">{copy.intro}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border-2 border-brand-ink/10 overflow-hidden">
          {done ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="w-14 h-14 text-brand-green mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Feedback received!</h2>
              <p className="text-slate-500 mb-4">{copy.thanks}</p>
              <button onClick={() => setDone(false)} className="text-brand-blue font-bold hover:text-blue-700 transition text-sm">
                Submit another response
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="p-6 sm:p-8 space-y-6">
              {error && (
                <div role="alert" className="bg-brand-red-pastel text-red-700 p-4 rounded-xl text-xs font-bold uppercase tracking-wider border border-brand-red/30">
                  {error}
                </div>
              )}
              {fields.filter((f) => isVisible(f, values)).map((f) => (
                <div key={f.name} className="space-y-2">
                  <Label field={f} htmlFor={f.kind === 'text' || f.kind === 'textarea' || f.kind === 'select' ? f.name : undefined} />
                  {'hint' in f && f.hint && <p className="text-[11px] text-slate-400">{f.hint}</p>}
                  {renderField(f)}
                </div>
              ))}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-brand-ink hover:bg-black text-white font-display font-bold rounded-full transition disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
