-- Tucson City Court Transcription — Supabase Schema
-- Run this in the Supabase SQL editor to set up the required tables.

-- ── Court sessions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS court_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_video_id TEXT UNIQUE,
  title          TEXT,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  status         TEXT CHECK (status IN ('live', 'completed', 'archived')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_sessions_status ON court_sessions(status);
CREATE INDEX IF NOT EXISTS idx_court_sessions_started_at ON court_sessions(started_at DESC);

-- ── Transcript segments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transcript_segments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES court_sessions(id) ON DELETE CASCADE,
  start_ms   INTEGER,
  end_ms     INTEGER,
  text       TEXT,
  confidence FLOAT,
  speaker    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_session ON transcript_segments(session_id, start_ms);

-- Full-text search index on transcript text
CREATE INDEX IF NOT EXISTS idx_transcript_segments_fts ON transcript_segments USING gin(to_tsvector('english', text));

-- ── Row-level security ───────────────────────────────────────────────────────
-- Allow public (anon) read access for the frontend
ALTER TABLE court_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on court_sessions"
  ON court_sessions FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public read on transcript_segments"
  ON transcript_segments FOR SELECT TO anon USING (true);

-- Service role has full access (used by Railway transcription service)
CREATE POLICY "Service role full access to court_sessions"
  ON court_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access to transcript_segments"
  ON transcript_segments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Enable real-time ──────────────────────────────────────────────────────────
-- Run via Supabase dashboard: Database → Replication → enable for transcript_segments
-- Or via SQL (supabase_realtime publication must already exist):
-- ALTER PUBLICATION supabase_realtime ADD TABLE transcript_segments;
