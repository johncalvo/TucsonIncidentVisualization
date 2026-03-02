/**
 * supabase-client.js
 * Thin wrapper around Supabase client for saving court transcript data.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

/**
 * Creates a new court session record.
 * @param {{ youtube_video_id: string, title: string, started_at: string }} session
 * @returns {Promise<string>} session UUID
 */
export async function createSession({ youtube_video_id, title, started_at }) {
  const { data, error } = await supabase
    .from('court_sessions')
    .upsert(
      { youtube_video_id, title, started_at, status: 'live' },
      { onConflict: 'youtube_video_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) throw new Error(`createSession: ${error.message}`)
  return data.id
}

/**
 * Marks a court session as completed.
 * @param {string} sessionId
 */
export async function completeSession(sessionId) {
  const { error } = await supabase
    .from('court_sessions')
    .update({ status: 'completed', ended_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) console.error(`[supabase] completeSession error: ${error.message}`)
}

/**
 * Saves a transcript segment to the database.
 * @param {{ session_id: string, start_ms: number, end_ms: number, text: string, confidence: number, speaker?: string }} segment
 */
export async function saveSegment(segment) {
  const { error } = await supabase
    .from('transcript_segments')
    .insert({
      session_id: segment.session_id,
      start_ms: segment.start_ms,
      end_ms: segment.end_ms,
      text: segment.text,
      confidence: segment.confidence ?? null,
      speaker: segment.speaker ?? null,
    })

  if (error) throw new Error(`saveSegment: ${error.message}`)
}

/**
 * Fetches recent sessions for display.
 * @param {number} limit
 */
export async function getRecentSessions(limit = 20) {
  const { data, error } = await supabase
    .from('court_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentSessions: ${error.message}`)
  return data
}
