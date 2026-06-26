import Anthropic from "@anthropic-ai/sdk"
import { NextResponse } from "next/server"

export const maxDuration = 60

const MODEL = "claude-sonnet-4-6"

const OCR_SYSTEM = `You are a strict OCR (optical character recognition) tool. Your ONLY function is to output the exact text visible in images. You must NEVER summarize, describe, identify, or comment on an image. Output raw extracted text only — nothing else.`

const OCR_PROMPT = `Extract every word from this image exactly as written.

Rules:
- Return ONLY the words visible in the image — no other text at all.
- Do NOT extract anything other than text words
- Do NOT identify the book, article, author, or source.
- Do NOT summarize or describe the content.
- Preserve paragraph breaks and original punctuation exactly.
- Ignore page numbers, headers, footers, and watermarks.
- If a word is split across two lines in the image with a hyphen at the end of the first line, combine the split parts into a single word during extraction
- If no readable text exists, return exactly: NO_TEXT_FOUND`

export async function POST(request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error: "Server is missing the ANTHROPIC_API_KEY environment variable.",
      },
      { status: 500 },
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    )
  }

  const { image, mediaType } = body || {}
  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]

  if (!image || !allowedTypes.includes(mediaType)) {
    return NextResponse.json(
      {
        error:
          "Expected a base64 image and a mediaType of jpeg, png, gif, or webp.",
      },
      { status: 400 },
    )
  }

  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: OCR_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: OCR_PROMPT },
          ],
        },
      ],
    })

    const text = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim()

    if (!text || text === "NO_TEXT_FOUND") {
      return NextResponse.json(
        {
          error:
            "No readable text was found in the image. Try a clearer, well-lit photo.",
        },
        { status: 422 },
      )
    }

    return NextResponse.json({ text })
  } catch (err) {
    console.error("OCR error:", err)
    return NextResponse.json(
      { error: "Text extraction failed. Please try again." },
      { status: 502 },
    )
  }
}
