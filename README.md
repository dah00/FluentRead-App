# FluentRead

A web app that listens to you read any text aloud, then gives you AI-powered
feedback on your English **pronunciation** — built for non-native English
speakers who want to improve their reading fluency.

## How it works

1. **Choose a passage** — paste text, upload a photo of a page (OCR via Claude
   Vision), or pick a built-in sample.
2. **Read it aloud** — the browser transcribes your speech in real time using
   the Web Speech API, while your audio is recorded for playback. Long readings
   (10–30 min) are supported via an auto-restart loop.
3. **Get feedback** — your transcript and the original passage are sent to
   Claude, which returns a structured report: a pronunciation score, the words
   that diverged (with a tip for each), and suggested next steps. You can replay
   your recording and tap **Correct** on any flagged word to hear how it should
   sound.

## Tech stack

- **Next.js 14** (App Router, JavaScript)
- **Tailwind CSS**
- **Web Speech API** for in-browser speech recognition
- **MediaRecorder API** for capturing audio playback
- **Anthropic Claude API** for feedback generation and image OCR
- **OpenAI TTS** for the "Correct" pronunciation playback
- Deployable to **Vercel**

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your API keys
npm run dev
```

Set these in `.env.local`:

- `ANTHROPIC_API_KEY` — required for feedback and photo OCR
- `OPENAI_API_KEY` — required for the "Correct" word pronunciation button

Open http://localhost:3000 in **Chrome or Edge** (the Web Speech API is not
supported in Firefox; Safari support is partial).

## Project structure

```
app/
  page.js                 # Home — passage input (paste / photo / sample)
  read/page.js            # Recording screen with live transcript
  feedback/page.js        # Feedback report + recording playback
  api/ocr/route.js        # Claude Vision text extraction (server-side)
  api/feedback/route.js   # Claude feedback generation (server-side)
  api/tts/route.js        # OpenAI text-to-speech for "Correct" button
hooks/
  useSpeechRecognition.js # Speech capture with auto-restart loop
  useAudioRecorder.js     # MediaRecorder-based audio capture
lib/
  store.js                # Cross-page session state (React Context)
  samples.js              # Built-in sample passages
```

## Notes

- API keys live only on the server (`.env.local` / Vercel env vars). They are
  never exposed to the browser — all Claude and OpenAI calls go through the
  Next.js API routes.
- Long transcripts are split into chunks and analyzed in parallel, then merged
  into a single report.
