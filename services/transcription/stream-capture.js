/**
 * stream-capture.js
 * Captures audio from a YouTube livestream URL using yt-dlp + ffmpeg.
 * Pipes raw PCM audio to a consumer callback for real-time transcription.
 *
 * Requirements: yt-dlp and ffmpeg must be installed in the container.
 */

import { spawn } from 'child_process'
import { EventEmitter } from 'events'

const SAMPLE_RATE = 16000  // AssemblyAI real-time expects 16kHz PCM
const CHANNELS = 1         // Mono

export class StreamCapture extends EventEmitter {
  constructor({ videoId }) {
    super()
    this.videoId = videoId
    this.url = `https://www.youtube.com/watch?v=${videoId}`
    this._ytdlp = null
    this._ffmpeg = null
    this._stopped = false
  }

  /**
   * Start capturing audio. Emits:
   *   'data'  — Buffer of raw PCM (16-bit LE, 16kHz, mono)
   *   'end'   — stream finished cleanly
   *   'error' — Error
   */
  start() {
    console.log(`[stream-capture] Starting capture: ${this.url}`)

    // yt-dlp: download best audio stream, output raw audio to stdout
    this._ytdlp = spawn('yt-dlp', [
      '--no-playlist',
      '-f', 'bestaudio/best',
      '--no-part',
      '-o', '-',         // Output to stdout
      this.url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    this._ytdlp.stderr.on('data', (chunk) => {
      const msg = chunk.toString().trim()
      if (msg) console.log(`[yt-dlp] ${msg}`)
    })

    // ffmpeg: convert yt-dlp output to PCM 16-bit LE, 16kHz mono
    this._ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',          // Read from stdin
      '-f', 's16le',           // Output format: signed 16-bit little-endian PCM
      '-ar', String(SAMPLE_RATE),
      '-ac', String(CHANNELS),
      '-acodec', 'pcm_s16le',
      'pipe:1',                // Output to stdout
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    // Pipe yt-dlp stdout → ffmpeg stdin
    this._ytdlp.stdout.pipe(this._ffmpeg.stdin)

    this._ytdlp.on('error', (err) => {
      console.error('[stream-capture] yt-dlp error:', err.message)
      this.emit('error', err)
    })

    this._ffmpeg.on('error', (err) => {
      console.error('[stream-capture] ffmpeg error:', err.message)
      this.emit('error', err)
    })

    this._ffmpeg.stderr.on('data', (chunk) => {
      // ffmpeg stderr is very verbose; only log warnings
      const msg = chunk.toString()
      if (msg.includes('Error') || msg.includes('Invalid')) {
        console.warn(`[ffmpeg] ${msg.trim()}`)
      }
    })

    this._ffmpeg.stdout.on('data', (chunk) => {
      if (!this._stopped) {
        this.emit('data', chunk)
      }
    })

    this._ffmpeg.on('close', (code) => {
      if (!this._stopped) {
        console.log(`[stream-capture] ffmpeg exited with code ${code}`)
        this.emit('end')
      }
    })

    this._ytdlp.on('close', (code) => {
      console.log(`[stream-capture] yt-dlp exited with code ${code}`)
      // When yt-dlp exits, close ffmpeg's stdin to signal end
      if (this._ffmpeg && this._ffmpeg.stdin && !this._ffmpeg.stdin.destroyed) {
        this._ffmpeg.stdin.end()
      }
    })
  }

  stop() {
    this._stopped = true
    console.log('[stream-capture] Stopping capture')
    if (this._ytdlp) {
      try { this._ytdlp.kill('SIGTERM') } catch (e) {}
      this._ytdlp = null
    }
    if (this._ffmpeg) {
      try { this._ffmpeg.kill('SIGTERM') } catch (e) {}
      this._ffmpeg = null
    }
    this.emit('end')
  }
}
