/**
 * transcriber.js
 * Real-time speech-to-text using AssemblyAI's real-time streaming API.
 * Receives audio chunks, sends to AssemblyAI WebSocket, receives transcript segments.
 *
 * Required env var:
 *   ASSEMBLYAI_API_KEY
 */

import { AssemblyAI } from 'assemblyai'
import { EventEmitter } from 'events'

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const SAMPLE_RATE = 16000

if (!ASSEMBLYAI_API_KEY) {
  console.warn('[transcriber] ASSEMBLYAI_API_KEY not set — transcription will be a no-op')
}

export class Transcriber extends EventEmitter {
  constructor({ sessionId }) {
    super()
    this.sessionId = sessionId
    this._client = null
    this._rt = null
    this._connected = false
    this._audioBuffer = []
    this._stopped = false
  }

  async connect() {
    if (!ASSEMBLYAI_API_KEY) {
      console.warn('[transcriber] No API key, skipping connection')
      return
    }

    console.log('[transcriber] Connecting to AssemblyAI real-time...')
    this._client = new AssemblyAI({ apiKey: ASSEMBLYAI_API_KEY })

    this._rt = this._client.realtime.transcriber({
      sampleRate: SAMPLE_RATE,
      // Request speaker diarization (when supported)
      speakerLabels: true,
    })

    this._rt.on('open', ({ sessionId }) => {
      console.log(`[transcriber] Connected — AssemblyAI session: ${sessionId}`)
      this._connected = true

      // Flush any buffered audio
      for (const chunk of this._audioBuffer) {
        this._rt.sendAudio(chunk)
      }
      this._audioBuffer = []
    })

    this._rt.on('transcript', (transcript) => {
      if (!transcript.text?.trim()) return

      const isFinal = transcript.message_type === 'FinalTranscript'

      if (isFinal) {
        console.log(`[transcriber] Final: "${transcript.text}"`)
        this.emit('segment', {
          session_id: this.sessionId,
          start_ms: transcript.audio_start,
          end_ms: transcript.audio_end,
          text: transcript.text,
          confidence: transcript.confidence ?? null,
          speaker: transcript.words?.[0]?.speaker ?? null,
        })
      }
    })

    this._rt.on('error', (err) => {
      console.error('[transcriber] AssemblyAI error:', err)
      this.emit('error', err)
    })

    this._rt.on('close', (code, reason) => {
      console.log(`[transcriber] WebSocket closed: ${code} ${reason}`)
      this._connected = false
      if (!this._stopped) {
        this.emit('closed')
      }
    })

    await this._rt.connect()
  }

  /**
   * Send a chunk of raw PCM audio (Buffer) to AssemblyAI.
   */
  sendAudio(chunk) {
    if (!ASSEMBLYAI_API_KEY) return

    if (!this._connected || !this._rt) {
      // Buffer until connected
      this._audioBuffer.push(chunk)
      return
    }
    this._rt.sendAudio(chunk)
  }

  async close() {
    this._stopped = true
    if (this._rt) {
      try { await this._rt.close() } catch (e) {}
      this._rt = null
    }
    this._connected = false
  }
}
