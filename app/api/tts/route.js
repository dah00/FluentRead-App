import { NextResponse } from 'next/server';

export const maxDuration = 15;

const VOICE = 'alloy'; // neutral, clear, consistent across all requests
const MODEL = 'tts-1';  // standard quality — fast and cheap for single words

export async function POST(request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const { word } = body ?? {};

  if (!word || typeof word !== 'string' || word.length > 100) {
    return NextResponse.json(
      { error: 'Expected a "word" string (max 100 chars).' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        voice: VOICE,
        input: word,
        response_format: 'mp3',
        speed: 0.9,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('OpenAI TTS error:', err);
      return NextResponse.json(
        { error: 'Pronunciation audio generation failed.' },
        { status: 502 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${base64}`,
    });
  } catch (err) {
    console.error('TTS error:', err);
    return NextResponse.json(
      { error: 'Pronunciation audio generation failed.' },
      { status: 502 }
    );
  }
}
