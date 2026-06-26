import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';

// Above this word count we chunk the pronunciation analysis into parallel calls.
const CHUNK_WORDS = 400;

const SYSTEM_PROMPT = `You are an expert English reading coach. Analyze an oral reading session and return structured feedback as valid JSON only — no prose outside the JSON object.

You will be given:
- PASSAGE: the original text the reader was asked to read aloud
- TRANSCRIPT: what speech recognition captured

Calibration notes for honest feedback:
- Address the reader directly as "you" / "your" — never "the student" or third person
- Speech recognition makes errors; minor word differences may be recognition mistakes, not mispronunciations — only flag words with significant divergence
- Be specific, encouraging, and actionable`;

// Prompt for a single Claude call (short transcript)
function singleCallPrompt(passage, transcript) {
  return `PASSAGE:
${passage}

TRANSCRIPT:
${transcript}

Return exactly this JSON shape — no other text. Address the reader as "you" in all prose fields:
{
  "pronunciation": {
    "score": <integer 0–100>,
    "flaggedWords": [
      { "word": "<exact passage word>", "issue": "<what diverged>", "tip": "<how to fix it, addressed as 'you'>" }
    ],
    "overview": "<2–3 sentences addressed directly to the reader using 'you'>"
  },
  "summary": "<1–2 sentence overall assessment addressed directly to the reader using 'you'>",
  "nextSteps": ["<actionable tip using 'you'>", "<actionable tip using 'you'>"]
}`;
}

// Prompt for each pronunciation chunk in long-reading mode
function chunkCallPrompt(passageChunk, transcriptChunk) {
  return `Compare the PASSAGE chunk to the TRANSCRIPT chunk. Identify words that were significantly mispronounced or dropped. Return JSON only:
{
  "flaggedWords": [
    { "word": "<exact passage word>", "issue": "<what happened>", "tip": "<pronunciation tip>" }
  ]
}

PASSAGE CHUNK:
${passageChunk}

TRANSCRIPT CHUNK:
${transcriptChunk}`;
}

// Prompt for the final merge call in long-reading mode
function mergeCallPrompt(flaggedWords, passageExcerpt) {
  return `You have analyzed pronunciation across all chunks. Here are the combined flagged words:
${JSON.stringify(flaggedWords, null, 2)}

PASSAGE EXCERPT (for context):
${passageExcerpt}

Return exactly this JSON shape — no other text. Address the reader as "you" in all prose fields:
{
  "pronunciation": {
    "score": <integer 0–100>,
    "flaggedWords": <deduplicated and prioritized from the list above>,
    "overview": "<2–3 sentences addressed directly to the reader using 'you'>"
  },
  "summary": "<1–2 sentence overall assessment addressed directly to the reader using 'you'>",
  "nextSteps": ["<actionable tip using 'you'>", "<actionable tip using 'you'>"]
}`;
}

// Calls Claude and extracts the first JSON object from the response.
// Using a regex to strip any accidental markdown fences Claude might add.
async function callClaude(anthropic, userPrompt) {
  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = msg.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned no JSON object');
  return JSON.parse(match[0]);
}

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Missing ANTHROPIC_API_KEY.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { segments, duration, passage } = body ?? {};

  if (!Array.isArray(segments) || segments.length === 0 || !passage?.trim()) {
    return NextResponse.json(
      { error: 'Expected a non-empty segments array and a passage string.' },
      { status: 400 }
    );
  }

  const transcript      = segments.map((s) => s.text).join(' ');
  const passageWords    = passage.split(/\s+/).filter(Boolean);
  const transcriptWords = transcript.split(/\s+/).filter(Boolean);

  try {
    const anthropic = new Anthropic();
    let report;

    if (transcriptWords.length <= CHUNK_WORDS) {
      // ── Short reading: one Claude call covers everything ──────────────
      report = await callClaude(anthropic, singleCallPrompt(passage, transcript));
    } else {
      // ── Long reading: fan out pronunciation analysis in parallel ──────
      const ratio = transcriptWords.length / passageWords.length;
      const chunkPromises = [];

      for (let i = 0; i < passageWords.length; i += CHUNK_WORDS) {
        const passageChunk    = passageWords.slice(i, i + CHUNK_WORDS).join(' ');
        const tStart          = Math.round(i * ratio);
        const tEnd            = Math.round((i + CHUNK_WORDS) * ratio);
        const transcriptChunk = transcriptWords.slice(tStart, tEnd).join(' ');
        chunkPromises.push(callClaude(anthropic, chunkCallPrompt(passageChunk, transcriptChunk)));
      }

      const chunkResults   = await Promise.all(chunkPromises);
      const allFlagged     = chunkResults.flatMap((r) => r.flaggedWords ?? []);
      const passageExcerpt = passageWords.slice(0, 300).join(' ');

      report = await callClaude(anthropic, mergeCallPrompt(allFlagged, passageExcerpt));
    }

    return NextResponse.json({ report });
  } catch (err) {
    console.error('Feedback error:', err);
    return NextResponse.json(
      { error: 'Feedback generation failed. Please try again.' },
      { status: 502 }
    );
  }
}
