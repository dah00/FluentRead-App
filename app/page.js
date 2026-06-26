'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import { SAMPLES } from '@/lib/samples';

const TABS = [
  { id: 'paste', label: 'Paste text' },
  { id: 'photo', label: 'Upload photo' },
  { id: 'sample', label: 'Sample passages' },
];

const MIN_WORDS = 25;

async function imageToBase64(file, maxDim = 1800) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (scale === 1 && file.type !== 'image/heic') {
    return { base64: dataUrl.split(',')[1], mediaType: file.type, preview: dataUrl };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpeg = canvas.toDataURL('image/jpeg', 0.85);
  return { base64: jpeg.split(',')[1], mediaType: 'image/jpeg', preview: jpeg };
}

export default function Home() {
  const router = useRouter();
  const { passage, setPassage, resetSession } = useApp();
  const [tab, setTab] = useState('paste');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [preview, setPreview] = useState('');
  const [selectedSample, setSelectedSample] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const wordCount = passage.trim() ? passage.trim().split(/\s+/).length : 0;
  const tooShort = wordCount > 0 && wordCount < MIN_WORDS;
  const ready = wordCount >= MIN_WORDS;

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setOcrError('');
    setOcrLoading(true);
    try {
      const { base64, mediaType, preview: previewUrl } = await imageToBase64(file);
      setPreview(previewUrl);
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed.');
      setPassage(data.text);
    } catch (err) {
      setOcrError(err.message || 'Something went wrong reading that image.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const chooseSample = (sample) => {
    setSelectedSample(sample.id);
    setPassage(sample.text);
  };

  const startReading = () => {
    resetSession();
    router.push('/read');
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          ReadCoach
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-slate-600">
          Read any text aloud and get AI feedback on your English pronunciation.
        </p>
      </div>

      {/* Tabs */}
      <div className="mt-10 flex justify-center gap-1 rounded-xl bg-slate-200/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === 'paste' && (
          <div>
            <textarea
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder="Paste anything you want to read aloud — a book excerpt, an article, a speech…"
              rows={10}
              className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-base leading-relaxed shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            {tooShort && (
              <p className="mt-2 text-sm text-amber-600">
                Add a bit more — at least {MIN_WORDS} words gives Claude enough to work with ({wordCount} so far).
              </p>
            )}
          </div>
        )}

        {tab === 'photo' && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={ocrLoading}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 transition ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600'
              } disabled:opacity-60`}
            >
              {ocrLoading ? (
                <>
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                  <span className="text-sm font-medium">Extracting text from your photo…</span>
                </>
              ) : (
                <>
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <span className="text-sm font-medium">
                    Take a photo or upload an image of a page
                  </span>
                  <span className="text-xs text-slate-400">
                    {isDragging ? 'Drop to extract text' : 'JPEG, PNG, WebP — or drag and drop'}
                  </span>
                </>
              )}
            </button>

            {ocrError && (
              <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {ocrError}
              </p>
            )}

            {preview && !ocrLoading && (
              <img
                src={preview}
                alt="Uploaded page"
                className="mt-4 max-h-48 rounded-lg border border-slate-200 object-contain"
              />
            )}

            {passage && !ocrLoading && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Extracted text — review and correct before reading
                </label>
                <textarea
                  value={passage}
                  onChange={(e) => setPassage(e.target.value)}
                  rows={8}
                  className="w-full resize-y rounded-xl border border-slate-300 bg-white p-4 text-base leading-relaxed shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                />
                {tooShort && (
                  <p className="mt-2 text-sm text-amber-600">
                    At least {MIN_WORDS} words needed ({wordCount} extracted — try a longer section of text).
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'sample' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {SAMPLES.map((sample) => {
              const wc = sample.text.trim().split(/\s+/).length;
              return (
                <button
                  key={sample.id}
                  onClick={() => chooseSample(sample)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedSample === sample.id
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{sample.title}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      {wc} words
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{sample.subtitle}</p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {sample.text}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer action */}
      <div className="mt-8 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-500">
          {wordCount === 0 ? (
            'No passage yet'
          ) : (
            <>
              <span className="font-semibold text-slate-900">{wordCount}</span>{' '}
              {wordCount === 1 ? 'word' : 'words'} ready
            </>
          )}
        </p>
        <button
          onClick={startReading}
          disabled={!ready}
          title={tooShort ? `Need at least ${MIN_WORDS} words` : undefined}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Start Reading →
        </button>
      </div>
    </main>
  );
}
