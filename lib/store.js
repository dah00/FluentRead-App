'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// Holds the session data shared across pages: the passage being read,
// the recording results, and the generated feedback report.
// Mirrored to sessionStorage so a page refresh doesn't lose the session.
const AppContext = createContext(null);

const STORAGE_KEY = 'fluentread-session';

export function AppProvider({ children }) {
  const [passage, setPassage] = useState('');
  // segments: [{ text, start, end }] — finalized speech chunks with ms timestamps
  const [segments, setSegments] = useState([]);
  const [duration, setDuration] = useState(0); // recording duration in seconds
  const [report, setReport] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Audio recording state — ephemeral (Blob URLs can't be serialized to sessionStorage).
  // Lost on page refresh; user must re-record.
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.passage) setPassage(data.passage);
        if (data.segments) setSegments(data.segments);
        if (data.duration) setDuration(data.duration);
        if (data.report) setReport(data.report);
      }
    } catch {
      // corrupted storage — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ passage, segments, duration, report })
      );
    } catch {
      // storage full (very long sessions) — in-memory state still works
    }
  }, [passage, segments, duration, report, hydrated]);

  const resetSession = () => {
    setSegments([]);
    setDuration(0);
    setReport(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingStartTime(null);
  };

  const value = {
    passage,
    setPassage,
    segments,
    setSegments,
    duration,
    setDuration,
    report,
    setReport,
    audioUrl,
    setAudioUrl,
    recordingStartTime,
    setRecordingStartTime,
    resetSession,
    hydrated,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
