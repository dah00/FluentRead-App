'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score) {
  if (score >= 80) return { text: 'text-emerald-600', stroke: '#10b981' };
  if (score >= 60) return { text: 'text-amber-500',   stroke: '#f59e0b' };
  return            { text: 'text-red-500',     stroke: '#ef4444' };
}

function ScoreRing({ score }) {
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const { stroke } = scoreColor(score);
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="-rotate-90" aria-hidden>
      <circle cx="45" cy="45" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
      <circle cx="45" cy="45" r={r} fill="none" stroke={stroke} strokeWidth="8"
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

function ScoreCard({ label, score, stat, overview }) {
  const { text } = scoreColor(score);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex items-center gap-4">
        <div className="relative flex h-[90px] w-[90px] shrink-0 items-center justify-center">
          <ScoreRing score={score} />
          <span className={`absolute text-2xl font-bold ${text}`}>{score}</span>
        </div>
        <div>
          {stat && <p className={`text-sm font-semibold ${text}`}>{stat}</p>}
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{overview}</p>
        </div>
      </div>
    </div>
  );
}

// ── Flagged word card ────────────────────────────────────────────────────────

// Try to extract the mispronounced version from Claude's issue text.
// Claude writes things like "transcribed as 'arky pelago'" — we grab the quoted part.
function extractHeardVersion(issue) {
  const match = issue.match(/[''""]([^''""\n]+)[''""\n]/);
  return match ? match[1] : null;
}

function FlaggedWordCard({ fw }) {
  const [playingTts, setPlayingTts] = useState(false);
  const ttsRef = useRef(null);
  const [cachedTtsUrl, setCachedTtsUrl] = useState(null);

  const heardVersion = extractHeardVersion(fw.issue);

  const stopTts = () => {
    if (ttsRef.current) { ttsRef.current.pause(); ttsRef.current = null; }
    setPlayingTts(false);
  };

  const playCorrect = async () => {
    if (playingTts) { stopTts(); return; }
    stopTts();
    setPlayingTts(true);

    let url = cachedTtsUrl;
    if (!url) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: fw.word }),
        });
        const data = await res.json();
        if (!res.ok || !data.audio) throw new Error(data.error || 'TTS failed');
        url = data.audio;
        setCachedTtsUrl(url);
      } catch (err) {
        console.error('TTS fetch failed:', err);
        setPlayingTts(false);
        return;
      }
    }

    const audio = new Audio(url);
    ttsRef.current = audio;
    audio.onended = () => stopTts();
    audio.onerror = () => { console.error('TTS audio error'); stopTts(); };
    audio.play().catch((err) => { console.error('TTS play failed:', err); stopTts(); });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      {/* Word + visual comparison */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-lg font-bold text-slate-900">{fw.word}</p>
          {heardVersion && (
            <p className="mt-1 text-sm">
              <span className="text-slate-400">What was heard: </span>
              <span className="font-medium text-amber-600">{heardVersion}</span>
            </p>
          )}
          {!heardVersion && (
            <p className="mt-1 text-sm text-slate-500">{fw.issue}</p>
          )}
        </div>
        <button
          onClick={playCorrect}
          className={`mt-1 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            playingTts
              ? 'bg-indigo-100 text-indigo-700'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {playingTts ? '■' : '▶'} Correct
        </button>
      </div>
      {/* Tip */}
      <p className="mt-2 text-sm text-indigo-700">→ {fw.tip}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const router = useRouter();
  const {
    passage, segments, duration,
    report, setReport,
    audioUrl,
    resetSession, setPassage,
    hydrated,
  } = useApp();

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!hydrated) return;

    if (segments.length === 0 && !report) {
      router.replace('/');
      return;
    }

    if (report) return;

    setLoading(true);
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments, duration, passage }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || 'Feedback generation failed.');
        setReport(data.report);
      })
      .catch((err) => setError(err.message || 'Something went wrong.'))
      .finally(() => setLoading(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const handleTryAgain = () => {
    resetSession();
    router.push('/read');
  };

  const handleNewPassage = () => {
    resetSession();
    setPassage('');
    router.push('/');
  };

  if (!hydrated || loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        {loading && <p className="text-sm text-slate-500">Analyzing your reading…</p>}
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-semibold text-red-700">Something went wrong</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button onClick={() => window.location.reload()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
              Retry
            </button>
            <button onClick={handleNewPassage}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              New Passage
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!report) return null;

  const { pronunciation, summary, nextSteps } = report;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={handleNewPassage}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          ← New Passage
        </button>
        <h1 className="text-xl font-bold text-slate-900">Your Feedback</h1>
      </div>

      <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50 px-5 py-4">
        <p className="text-sm font-medium leading-relaxed text-indigo-800">{summary}</p>
      </div>

      {/* Full recording playback — simple browser player, no clipping */}
      {audioUrl && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your recording
          </p>
          <audio
            src={audioUrl}
            controls
            className="w-full"
            onLoadedMetadata={(e) => {
              const a = e.target;
              if (a.duration === Infinity || isNaN(a.duration)) {
                a.currentTime = 1e101;
                a.addEventListener('timeupdate', function fix() {
                  a.removeEventListener('timeupdate', fix);
                  a.currentTime = 0;
                });
              }
            }}
          />
        </div>
      )}

      <ScoreCard
        label="Pronunciation"
        score={pronunciation.score}
        stat={
          pronunciation.flaggedWords?.length > 0
            ? `${pronunciation.flaggedWords.length} word${pronunciation.flaggedWords.length === 1 ? '' : 's'} flagged`
            : 'No issues found'
        }
        overview={pronunciation.overview}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Words to review
        </h2>
        {pronunciation.flaggedWords?.length > 0 ? (
          <div className="flex flex-col gap-3">
            {pronunciation.flaggedWords.map((fw, i) => (
              <FlaggedWordCard key={i} fw={fw} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm text-emerald-700">
              No significant pronunciation issues detected — great job!
            </p>
          </div>
        )}
      </section>

      {nextSteps?.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Next steps
          </h2>
          <div className="flex flex-col gap-2">
            {nextSteps.map((step, i) => (
              <div key={i}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">
                  {i + 1}
                </span>
                <p className="text-sm text-slate-700">{step}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 flex gap-3">
        <button onClick={handleTryAgain}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
          Try Again
        </button>
        <button onClick={handleNewPassage}
          className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
          New Passage
        </button>
      </div>
    </main>
  );
}
