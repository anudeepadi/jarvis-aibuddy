import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// Edge TTS voices - https://github.com/rany2/edge-tts
// These are Microsoft Azure voices, completely FREE
const EDGE_VOICES: Record<string, string> = {
  // English - Male voices (best for JARVIS)
  'british-male': 'en-GB-RyanNeural', // British male - closest to JARVIS
  'american-male': 'en-US-GuyNeural', // American male
  'australian-male': 'en-AU-WilliamNeural', // Australian male
  // English - Female voices
  'british-female': 'en-GB-SoniaNeural', // British female
  'american-female': 'en-US-JennyNeural', // American female
  'australian-female': 'en-AU-NatashaNeural', // Australian female
}

// Language-specific voices (male preferred for JARVIS feel)
const LANGUAGE_VOICES: Record<string, string> = {
  'hi': 'hi-IN-MadhurNeural', // Hindi male
  'es': 'es-ES-AlvaroNeural', // Spanish male
  'fr': 'fr-FR-HenriNeural', // French male
  'de': 'de-DE-ConradNeural', // German male
  'it': 'it-IT-DiegoNeural', // Italian male
  'pt': 'pt-BR-AntonioNeural', // Portuguese male
  'ja': 'ja-JP-KeitaNeural', // Japanese male
  'ko': 'ko-KR-InJoonNeural', // Korean male
  'zh': 'zh-CN-YunxiNeural', // Chinese male
  'ar': 'ar-SA-HamedNeural', // Arabic male
  'ru': 'ru-RU-DmitryNeural', // Russian male
  'te': 'te-IN-MohanNeural', // Telugu male
  'ta': 'ta-IN-ValluvarNeural', // Tamil male
  'mr': 'mr-IN-ManoharNeural', // Marathi male
  'gu': 'gu-IN-NiranjanNeural', // Gujarati male
  'kn': 'kn-IN-GaganNeural', // Kannada male
  'ml': 'ml-IN-MidhunNeural', // Malayalam male
  'bn': 'bn-IN-BashkarNeural', // Bengali male
  'en': 'en-GB-RyanNeural', // English default
}

// Detect language from text using Unicode ranges
function detectLanguage(text: string): string {
  // Count characters in different scripts
  const counts: Record<string, number> = {
    hi: 0, // Devanagari (Hindi, Sanskrit, Marathi)
    ta: 0, // Tamil
    te: 0, // Telugu
    kn: 0, // Kannada
    ml: 0, // Malayalam
    gu: 0, // Gujarati
    bn: 0, // Bengali
    ar: 0, // Arabic
    zh: 0, // Chinese
    ja: 0, // Japanese (Hiragana/Katakana)
    ko: 0, // Korean
    ru: 0, // Cyrillic
    en: 0, // Latin
  }

  for (const char of text) {
    const code = char.charCodeAt(0)

    // Devanagari (Hindi, Marathi, Sanskrit)
    if (code >= 0x0900 && code <= 0x097F) counts.hi++
    // Tamil
    else if (code >= 0x0B80 && code <= 0x0BFF) counts.ta++
    // Telugu
    else if (code >= 0x0C00 && code <= 0x0C7F) counts.te++
    // Kannada
    else if (code >= 0x0C80 && code <= 0x0CFF) counts.kn++
    // Malayalam
    else if (code >= 0x0D00 && code <= 0x0D7F) counts.ml++
    // Gujarati
    else if (code >= 0x0A80 && code <= 0x0AFF) counts.gu++
    // Bengali
    else if (code >= 0x0980 && code <= 0x09FF) counts.bn++
    // Arabic
    else if (code >= 0x0600 && code <= 0x06FF) counts.ar++
    // CJK (Chinese)
    else if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)) counts.zh++
    // Japanese Hiragana/Katakana
    else if ((code >= 0x3040 && code <= 0x309F) || (code >= 0x30A0 && code <= 0x30FF)) counts.ja++
    // Korean Hangul
    else if ((code >= 0xAC00 && code <= 0xD7AF) || (code >= 0x1100 && code <= 0x11FF)) counts.ko++
    // Cyrillic (Russian)
    else if (code >= 0x0400 && code <= 0x04FF) counts.ru++
    // Latin (basic ASCII letters)
    else if ((code >= 0x0041 && code <= 0x005A) || (code >= 0x0061 && code <= 0x007A)) counts.en++
  }

  // Find the dominant script
  let maxLang = 'en'
  let maxCount = 0
  for (const [lang, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count
      maxLang = lang
    }
  }

  return maxLang
}

// Use /tmp directly on macOS (avoids permission issues with os.tmpdir())
const TEMP_DIR = '/tmp'

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = 'british-male', rate = '+0%', pitch = '+0Hz', language = 'en' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    // Use language from settings (no auto-detection unless explicitly set to 'auto')
    let voice: string

    if (language === 'auto') {
      // Only auto-detect if explicitly requested
      const detectedLang = detectLanguage(text)
      if (detectedLang !== 'en' && LANGUAGE_VOICES[detectedLang]) {
        voice = LANGUAGE_VOICES[detectedLang]
        console.log(`Auto-detected ${detectedLang}, using voice: ${voice}`)
      } else {
        voice = EDGE_VOICES[voiceId] || voiceId
      }
    } else if (language !== 'en' && LANGUAGE_VOICES[language]) {
      // Use user-selected language voice
      voice = LANGUAGE_VOICES[language]
      console.log(`Using ${language} voice: ${voice}`)
    } else {
      // Use user-selected English voice
      voice = EDGE_VOICES[voiceId] || voiceId
    }

    const tempFile = path.join(TEMP_DIR, `edge-tts-${randomUUID()}.mp3`)

    // Escape text for shell - replace quotes and special chars
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')

    try {
      // Call edge-tts CLI (Python version)
      await execAsync(
        `edge-tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text "${escapedText}" --write-media "${tempFile}"`,
        { timeout: 30000 }
      )

      // Read the generated audio
      const audioBuffer = await fs.readFile(tempFile)

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {})

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      })
    } catch (cmdError) {
      console.error('Edge TTS command error:', cmdError)
      // Clean up temp file if it exists
      await fs.unlink(tempFile).catch(() => {})
      throw cmdError
    }
  } catch (error) {
    console.error('Edge TTS error:', error)
    return NextResponse.json(
      { error: 'TTS failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
