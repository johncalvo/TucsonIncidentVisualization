import React, { useState, useEffect, useRef } from 'react'
import LiveIndicator from './LiveIndicator'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Court transcript viewer component.
 * - Lists sessions (live + past)
 * - Live session: shows real-time segments via Supabase Realtime subscription
 * - Past sessions: paginated transcript with full-text search
 */
function TranscriptViewer() {
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [segments, setSegments] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingSegments, setLoadingSegments] = useState(false)
  const [error, setError] = useState(null)
  const [supabaseClient, setSupabaseClient] = useState(null)
  const realtimeRef = useRef(null)
  const segmentsEndRef = useRef(null)

  const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

  // Initialize Supabase client dynamically to avoid bundle bloat when not configured
  useEffect(() => {
    if (!configured) return

    import('@supabase/supabase-js').then(({ createClient }) => {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      setSupabaseClient(client)
    }).catch((err) => {
      console.warn('[TranscriptViewer] Could not load Supabase client:', err)
    })
  }, [configured])

  // Fetch sessions list
  useEffect(() => {
    if (!supabaseClient) return

    const fetchSessions = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabaseClient
          .from('court_sessions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(30)

        if (error) throw error
        setSessions(data || [])

        // Auto-select live session if exists
        const live = (data || []).find(s => s.status === 'live')
        if (live) setSelectedSessionId(live.id)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [supabaseClient])

  // Fetch segments for selected session
  useEffect(() => {
    if (!supabaseClient || !selectedSessionId) return

    const fetchSegments = async () => {
      setLoadingSegments(true)
      try {
        const { data, error } = await supabaseClient
          .from('transcript_segments')
          .select('*')
          .eq('session_id', selectedSessionId)
          .order('start_ms', { ascending: true })
          .limit(500)

        if (error) throw error
        setSegments(data || [])
      } catch (err) {
        console.error('[TranscriptViewer] fetchSegments error:', err)
      } finally {
        setLoadingSegments(false)
      }
    }

    fetchSegments()
  }, [supabaseClient, selectedSessionId])

  // Subscribe to real-time updates for live sessions
  useEffect(() => {
    if (!supabaseClient || !selectedSessionId) return

    const selectedSession = sessions.find(s => s.id === selectedSessionId)
    if (selectedSession?.status !== 'live') return

    // Unsubscribe from previous
    if (realtimeRef.current) {
      supabaseClient.removeChannel(realtimeRef.current)
    }

    const channel = supabaseClient
      .channel(`segments:${selectedSessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transcript_segments', filter: `session_id=eq.${selectedSessionId}` },
        (payload) => {
          setSegments(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    realtimeRef.current = channel

    return () => {
      supabaseClient.removeChannel(channel)
      realtimeRef.current = null
    }
  }, [supabaseClient, selectedSessionId, sessions])

  // Auto-scroll to bottom for live sessions
  useEffect(() => {
    const selectedSession = sessions.find(s => s.id === selectedSessionId)
    if (selectedSession?.status === 'live') {
      segmentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [segments, selectedSessionId, sessions])

  const selectedSession = sessions.find(s => s.id === selectedSessionId)

  const filteredSegments = searchQuery.trim()
    ? segments.filter(seg => seg.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments

  const formatTime = (ms) => {
    if (!ms && ms !== 0) return ''
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const formatDate = (iso) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  const exportTranscript = () => {
    if (!selectedSession || segments.length === 0) return
    const lines = segments.map(seg => `[${formatTime(seg.start_ms)}] ${seg.text}`)
    const content = `Tucson City Court — ${selectedSession.title}\n${formatDate(selectedSession.started_at)}\n\n${lines.join('\n')}`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `court-transcript-${selectedSession.id.slice(0, 8)}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Not configured state
  if (!configured) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#f9fafb', marginBottom: '1rem' }}>
          Court Transcripts
        </h2>
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Court transcription requires Supabase configuration.
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', lineHeight: 1.6 }}>
            To enable this feature:
          </p>
          <ol style={{ color: '#6b7280', fontSize: '0.8125rem', paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Create a Supabase project at <span style={{ color: '#06b6d4' }}>supabase.com</span></li>
            <li>Run the schema SQL (see SETUP_COMPLETE.md)</li>
            <li>Set <code style={{ color: '#a78bfa' }}>VITE_SUPABASE_URL</code> and <code style={{ color: '#a78bfa' }}>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code></li>
            <li>Deploy the Railway transcription service (see services/transcription/)</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '1.25rem', height: 'calc(100vh - 120px)', minHeight: '500px' }}>
      {/* Sessions sidebar */}
      <div
        style={{
          width: '280px',
          flexShrink: 0,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1rem', borderBottom: '1px solid #1f2937' }}>
          <h2 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f9fafb' }}>Court Sessions</h2>
          <p style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Tucson City Court livestreams
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {loading ? (
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>Loading sessions…</p>
          ) : error ? (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', padding: '0.75rem' }}>{error}</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '0.8125rem', textAlign: 'center', padding: '1rem' }}>
              No sessions recorded yet.
            </p>
          ) : (
            sessions.map(session => (
              <button
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  border: selectedSessionId === session.id ? '1px solid #06b6d4' : '1px solid transparent',
                  background: selectedSessionId === session.id ? 'rgba(6,182,212,0.1)' : 'transparent',
                  cursor: 'pointer',
                  marginBottom: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  {session.status === 'live' && <LiveIndicator startedAt={session.started_at} />}
                  {session.status !== 'live' && (
                    <span style={{ fontSize: '0.6875rem', color: '#4b5563', fontWeight: 600, textTransform: 'uppercase' }}>
                      {session.status}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#e5e7eb', marginBottom: '0.25rem', lineHeight: 1.3 }}>
                  {session.title || 'Court Session'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {formatDate(session.started_at)}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Transcript panel */}
      <div
        style={{
          flex: 1,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {!selectedSession ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Select a session to view the transcript</p>
          </div>
        ) : (
          <>
            {/* Session header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#f9fafb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedSession.title || 'Court Session'}
                  </h3>
                  {selectedSession.status === 'live' && <LiveIndicator startedAt={selectedSession.started_at} />}
                </div>
                <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatDate(selectedSession.started_at)}</p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Search transcript…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    background: '#0a0f1e',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    color: '#f9fafb',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.8125rem',
                    width: '180px',
                  }}
                />
                <button
                  onClick={exportTranscript}
                  disabled={segments.length === 0}
                  style={{
                    padding: '0.375rem 0.875rem',
                    background: 'transparent',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    color: '#9ca3af',
                    cursor: segments.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '0.8125rem',
                    opacity: segments.length > 0 ? 1 : 0.5,
                  }}
                >
                  Export
                </button>
              </div>
            </div>

            {/* Segments */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              {loadingSegments ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading transcript…</p>
              ) : filteredSegments.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                  {searchQuery ? 'No segments match your search.' : selectedSession.status === 'live' ? 'Waiting for speech…' : 'No transcript segments recorded.'}
                </p>
              ) : (
                filteredSegments.map((seg, idx) => (
                  <div
                    key={seg.id || idx}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      marginBottom: '0.75rem',
                      alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', color: '#4b5563', fontVariantNumeric: 'tabular-nums', flexShrink: 0, marginTop: '0.1rem', minWidth: '50px' }}>
                      {formatTime(seg.start_ms)}
                    </span>
                    {seg.speaker && (
                      <span style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: 600, flexShrink: 0, minWidth: '60px' }}>
                        {seg.speaker}
                      </span>
                    )}
                    <p style={{ fontSize: '0.875rem', color: '#d1d5db', lineHeight: 1.6, margin: 0 }}>
                      {searchQuery ? highlightMatch(seg.text, searchQuery) : seg.text}
                    </p>
                  </div>
                ))
              )}
              <div ref={segmentsEndRef} />
            </div>

            {/* Live streaming footer */}
            {selectedSession.status === 'live' && (
              <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #1f2937', background: 'rgba(239,68,68,0.05)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#9ca3af' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 1.4s infinite', flexShrink: 0 }} />
                Streaming live — transcript updates in real-time
                <span style={{ marginLeft: 'auto', color: '#4b5563' }}>{segments.length} segments</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Highlight matching text in a segment.
 */
function highlightMatch(text, query) {
  if (!text || !query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: 'rgba(6,182,212,0.3)', color: '#06b6d4', borderRadius: '2px', padding: '0 2px' }}>{part}</mark>
      : part
  )
}

export default TranscriptViewer
