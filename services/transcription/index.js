/**
 * index.js — Main orchestrator for Tucson City Court transcription service.
 *
 * Flow:
 *   1. YouTubeMonitor polls every 5 min for live streams on the channel
 *   2. When live stream detected → create Supabase court_sessions record
 *   3. StreamCapture starts yt-dlp + ffmpeg pipeline → raw PCM audio
 *   4. Transcriber sends audio chunks to AssemblyAI real-time WebSocket
 *   5. Transcript segments saved to Supabase transcript_segments table
 *   6. When stream ends → session marked completed
 *
 * Environment variables: see .env.example
 */

import { YouTubeMonitor } from './youtube-monitor.js'
import { StreamCapture } from './stream-capture.js'
import { Transcriber } from './transcriber.js'
import { createSession, completeSession, saveSegment } from './supabase-client.js'
import http from 'http'

// Validate required env vars
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[main] Missing required env var: ${key}`)
    process.exit(1)
  }
}

// State
let activeSession = null  // { id, videoId, capture, transcriber }

/**
 * Start a transcription session for a detected live stream.
 */
async function startSession({ videoId, title, startedAt }) {
  if (activeSession) {
    console.log(`[main] Already transcribing ${activeSession.videoId}, ignoring new stream ${videoId}`)
    return
  }

  console.log(`[main] Starting session for video ${videoId}: "${title}"`)

  // Create Supabase record
  let sessionId
  try {
    sessionId = await createSession({ youtube_video_id: videoId, title, started_at: startedAt })
    console.log(`[main] Session created in Supabase: ${sessionId}`)
  } catch (err) {
    console.error(`[main] Failed to create session: ${err.message}`)
    return
  }

  // Set up transcriber
  const transcriber = new Transcriber({ sessionId })

  transcriber.on('segment', async (segment) => {
    try {
      await saveSegment(segment)
      process.stdout.write('.')
    } catch (err) {
      console.error(`[main] saveSegment error: ${err.message}`)
    }
  })

  transcriber.on('error', (err) => {
    console.error(`[main] Transcriber error: ${err.message}`)
  })

  transcriber.on('closed', () => {
    console.log('[main] Transcriber WebSocket closed')
  })

  // Connect to AssemblyAI
  try {
    await transcriber.connect()
  } catch (err) {
    console.error(`[main] Failed to connect to AssemblyAI: ${err.message}`)
    return
  }

  // Set up stream capture
  const capture = new StreamCapture({ videoId })

  capture.on('data', (chunk) => {
    transcriber.sendAudio(chunk)
  })

  capture.on('end', () => {
    console.log('\n[main] Stream capture ended')
    endSession()
  })

  capture.on('error', (err) => {
    console.error(`[main] Capture error: ${err.message}`)
    endSession()
  })

  activeSession = { id: sessionId, videoId, capture, transcriber }
  capture.start()
}

/**
 * End the current transcription session.
 */
async function endSession() {
  if (!activeSession) return

  const { id, videoId, capture, transcriber } = activeSession
  activeSession = null

  console.log(`[main] Ending session ${id} for video ${videoId}`)

  try { capture.stop() } catch (e) {}
  try { await transcriber.close() } catch (e) {}

  try {
    await completeSession(id)
    console.log(`[main] Session ${id} marked completed`)
  } catch (err) {
    console.error(`[main] completeSession error: ${err.message}`)
  }
}

// Start YouTube monitor
const monitor = new YouTubeMonitor()
monitor.on('live', startSession)
monitor.on('ended', endSession)
monitor.start()

// Simple HTTP health endpoint for Railway
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      active: activeSession ? { videoId: activeSession.videoId, sessionId: activeSession.id } : null,
      uptime: process.uptime(),
    }))
  } else {
    res.writeHead(404)
    res.end()
  }
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`[main] Transcription service running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[main] SIGTERM received, shutting down...')
  monitor.stop()
  await endSession()
  server.close(() => process.exit(0))
})

process.on('SIGINT', async () => {
  console.log('[main] SIGINT received, shutting down...')
  monitor.stop()
  await endSession()
  server.close(() => process.exit(0))
})
