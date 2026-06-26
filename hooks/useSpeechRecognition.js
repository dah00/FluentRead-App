'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useSpeechRecognition() {
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState([]);
  const [interimText, setInterimText] = useState('');

  const recRef = useRef(null);
  // Ref instead of state: onend closes over this value when the recognition
  // instance is created, so a ref is the only way to read the *current* value
  // inside that closure without recreating the recognition object on every render.
  const isListeningRef = useRef(false);
  const segStartRef = useRef(null); // timestamp (ms) of the current segment's start

  useEffect(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);

    const rec = new SR();
    rec.continuous = true;     // don't stop after each sentence
    rec.interimResults = true; // stream partial results for live display
    rec.lang = 'en-US';

    rec.onstart = () => {
      segStartRef.current = Date.now();
    };

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const text = r[0].transcript.trim();
        if (!text) continue;

        if (r.isFinal) {
          const end = Date.now();
          setSegments((prev) => [
            ...prev,
            { text, start: segStartRef.current ?? end, end },
          ]);
          segStartRef.current = end;
        } else {
          interim += r[0].transcript;
        }
      }
      setInterimText(interim);
    };

    rec.onend = () => {
      setInterimText('');
      // Chrome cuts off recognition every ~60s. If we're still supposed to be
      // listening, restart immediately — the user never sees the interruption.
      if (isListeningRef.current) {
        try { rec.start(); } catch { /* already starting, safe to ignore */ }
      } else {
        setIsListening(false);
      }
    };

    rec.onerror = (e) => {
      // no-speech: user paused — normal during reading, not an error.
      // aborted: we called abort() ourselves — also expected.
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.error('SpeechRecognition error:', e.error);
    };

    recRef.current = rec;

    return () => {
      isListeningRef.current = false;
      try { rec.abort(); } catch {}
    };
  }, []);

  const start = useCallback(() => {
    if (!recRef.current || isListeningRef.current) return;
    isListeningRef.current = true;
    setIsListening(true);
    recRef.current.start();
  }, []);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    try { recRef.current?.stop(); } catch {}
  }, []);

  const reset = useCallback(() => {
    setSegments([]);
    setInterimText('');
  }, []);

  return { supported, isListening, segments, interimText, start, stop, reset };
}
