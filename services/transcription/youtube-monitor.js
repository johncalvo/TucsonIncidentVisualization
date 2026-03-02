/**
 * youtube-monitor.js
 * Polls the YouTube Data API v3 to detect when the target channel goes live.
 *
 * Required env vars:
 *   YOUTUBE_API_KEY
 *   YOUTUBE_CHANNEL_ID  (default: UCQBaDvrEXMh86Puma5yZkNQ — Tucson City Court)
 */

import { EventEmitter } from 'events'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || 'UCQBaDvrEXMh86Puma5yZkNQ'
const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

if (!YOUTUBE_API_KEY) {
  console.warn('[youtube-monitor] YOUTUBE_API_KEY not set — live detection disabled')
}

export class YouTubeMonitor extends EventEmitter {
  constructor() {
    super()
    this._timer = null
    this._activeVideoId = null
    this._running = false
  }

  start() {
    if (this._running) return
    this._running = true
    console.log(`[youtube-monitor] Starting — channel: ${CHANNEL_ID}, poll: ${POLL_INTERVAL_MS / 1000}s`)
    this._poll()
    this._timer = setInterval(() => this._poll(), POLL_INTERVAL_MS)
  }

  stop() {
    this._running = false
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  async _poll() {
    if (!YOUTUBE_API_KEY) return

    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('channelId', CHANNEL_ID)
      url.searchParams.set('eventType', 'live')
      url.searchParams.set('type', 'video')
      url.searchParams.set('key', YOUTUBE_API_KEY)

      const res = await fetch(url.toString())
      if (!res.ok) {
        console.warn(`[youtube-monitor] API error: ${res.status} ${res.statusText}`)
        return
      }

      const json = await res.json()
      const items = json.items || []

      if (items.length > 0) {
        const item = items[0]
        const videoId = item.id?.videoId
        const title = item.snippet?.title || 'Court Session'
        const publishedAt = item.snippet?.publishedAt || new Date().toISOString()

        if (videoId && videoId !== this._activeVideoId) {
          console.log(`[youtube-monitor] Live stream detected: ${videoId} — "${title}"`)
          this._activeVideoId = videoId
          this.emit('live', { videoId, title, startedAt: publishedAt })
        }
      } else {
        // No live streams found
        if (this._activeVideoId) {
          console.log(`[youtube-monitor] Stream ended: ${this._activeVideoId}`)
          this.emit('ended', { videoId: this._activeVideoId })
          this._activeVideoId = null
        }
      }
    } catch (err) {
      console.error(`[youtube-monitor] Poll error: ${err.message}`)
    }
  }
}
