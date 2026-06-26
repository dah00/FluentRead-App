'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordingStartTime, setRecordingStartTime] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  // Clean up mic stream and revoke any previous blob URL.
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    // Revoke previous recording if any
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    // Prefer webm (Chrome/Edge/Brave), fall back to whatever the browser supports.
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    // When stop() is called, onstop fires after the final ondataavailable.
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      });
      setAudioUrl(URL.createObjectURL(blob));
      cleanup();
    };

    recorderRef.current = recorder;
    setRecordingStartTime(Date.now());
    recorder.start();
    setIsRecording(true);
  }, [audioUrl, cleanup]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return { isRecording, audioUrl, recordingStartTime, startRecording, stopRecording };
}
