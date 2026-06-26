'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ReadPage() {
  const router = useRouter();
  const { passage, hydrated, setSegments, setDuration, setAudioUrl, setRecordingStartTime } = useApp();
  const { supported, isListening, segments, interimText, start, stop, reset } =
    useSpeechRecognition();
  const { audioUrl, recordingStartTime, startRecording, stopRecording } =
    useAudioRecorder();

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef    = useRef(null);
  const transcriptRef   = useRef(null);

  // Derived values — declared before useEffect hooks that reference them.
  const fullTranscript =
    segments.map((s) => s.text).join(' ') +
    (interimText ? ' ' + interimText : '');

  const spokenWords = segments.reduce(
    (n, s) => n + s.text.split(/\s+/).filter(Boolean).length,
    0
  );

  const phase = isListening ? 'recording' : segments.length > 0 ? 'done' : 'idle';

  // Passage guard — if someone navigates here directly with no passage, send them home.
  useEffect(() => {
    if (hydrated && !passage.trim()) {
      router.replace('/');
    }
  }, [hydrated, passage, router]);

  // Auto-scroll the transcript window to the bottom on every new word.
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [fullTranscript]);

  // Timer: runs an interval while recording, freezes on stop.
  useEffect(() => {
    if (!isListening) return;
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [isListening]);

  const handleStart = async () => {
    startTimeRef.current = null;
    setElapsed(0);
    reset();
    await startRecording(); // Gets mic permission first
    start();                // SpeechRecognition reuses the granted permission — no second prompt
  };

  const handleStop = () => {
    stop();
    stopRecording();
  };

  const handleTryAgain = () => {
    startTimeRef.current = null;
    setElapsed(0);
    reset();
  };

  const handleGetFeedback = () => {
    setSegments(segments);
    setDuration(elapsed);
    setAudioUrl(audioUrl);
    setRecordingStartTime(recordingStartTime);
    router.push('/feedback');
  };

  // Show spinner while waiting for sessionStorage to hydrate.
  if (!hydrated || !passage.trim()) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Back to home"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold text-slate-900">ReadCoach</h1>
      </div>

      {/* Browser support warning */}
      {!supported && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your browser doesn't support speech recognition. Try Chrome or Edge on desktop or Android.
        </div>
      )}

      {/* Passage display */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Read this aloud
        </p>
        <div className="max-h-56 overflow-y-auto text-base leading-relaxed text-slate-800 sm:max-h-80">
          {passage}
        </div>
      </div>

      {/* ── IDLE ──────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="mt-10 flex flex-col items-center gap-4">
          <button
            onClick={handleStart}
            disabled={!supported}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 active:scale-95 disabled:opacity-40"
            aria-label="Start recording"
          >
            {/* Microphone icon */}
            <svg className="h-9 w-9" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5z" />
              <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291A6.751 6.751 0 0 1 5.25 12.75v-1.5A.75.75 0 0 1 6 10.5z" />
            </svg>
          </button>
          <p className="text-sm text-slate-500">Tap to start recording</p>
        </div>
      )}

      {/* ── RECORDING ─────────────────────────────────────────────────── */}
      {phase === 'recording' && (
        <div className="mt-8 flex flex-col items-center gap-6">
          {/* Pulsing indicator + timer */}
          <div className="flex items-center gap-3">
            <span className="animate-pulse-slow h-3 w-3 rounded-full bg-red-500" />
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-800">
              {formatTime(elapsed)}
            </span>
          </div>

          {/* Live transcript — fixed 5-line window, auto-scrolls to latest */}
          <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Live transcript
            </p>
            <div
              ref={transcriptRef}
              className="scrollbar-hide max-h-[7.5rem] overflow-y-auto"
            >
              <p className="text-sm leading-relaxed text-slate-700">
                {fullTranscript || (
                  <span className="italic text-slate-400">Start speaking…</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleStop}
            className="rounded-full bg-red-600 px-8 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-95"
          >
            Stop Recording
          </button>
        </div>
      )}

      {/* ── DONE ──────────────────────────────────────────────────────── */}
      {phase === 'done' && (
        <div className="mt-8 flex flex-col items-center gap-6">
          {/* Stats row */}
          <div className="flex w-full gap-4">
            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="font-mono text-3xl font-bold text-indigo-600">
                {formatTime(elapsed)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Duration</p>
            </div>
            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-3xl font-bold text-indigo-600">{spokenWords}</p>
              <p className="mt-1 text-xs text-slate-500">Words spoken</p>
            </div>
          </div>

          {/* Full transcript for review */}
          <div className="w-full max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your transcript
            </p>
            <p className="text-sm leading-relaxed text-slate-700">{fullTranscript}</p>
          </div>

          {/* Actions */}
          <div className="flex w-full gap-3">
            <button
              onClick={handleTryAgain}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Try Again
            </button>
            <button
              onClick={handleGetFeedback}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Get Feedback →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
