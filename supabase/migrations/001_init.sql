-- ============================================================
-- 001_init.sql
-- Initial schema for the Greece Vacation Accommodation Search app.
--
-- Tables:
--   searches  – one record per user search session
--   results   – individual accommodation listings linked to a search
-- ============================================================

-- Enable UUID generation (available by default in Supabase)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- already enabled in Supabase

-- ----------------------------------------------------------
-- searches
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS searches (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location            TEXT        NOT NULL,
  accommodation_type  TEXT,
  num_people          INTEGER,
  num_rooms           INTEGER,
  check_in            DATE,
  check_out           DATE,
  options             TEXT[]      DEFAULT '{}',
  result_count        INTEGER     NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------
-- results
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS results (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id       UUID        REFERENCES searches(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location        TEXT,
  name            TEXT,
  description     TEXT,
  type            TEXT,
  price_per_night NUMERIC(10, 2),
  total_price     NUMERIC(10, 2),
  currency        TEXT        NOT NULL DEFAULT 'EUR',
  source          TEXT,
  url             TEXT,
  image_url       TEXT,
  rating          NUMERIC(4, 2),
  amenities       TEXT[]      DEFAULT '{}',
  bedrooms        INTEGER,
  max_guests      INTEGER,
  saved           BOOLEAN     NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_results_search_id  ON results(search_id);
CREATE INDEX IF NOT EXISTS idx_results_saved       ON results(saved) WHERE saved = TRUE;
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches(created_at DESC);

-- ----------------------------------------------------------
-- Row Level Security (RLS)
-- Enable RLS so the anon key can only read/write its own data.
-- For a single-user local app you can skip this, but it's good
-- practice when using the anon key.
-- ----------------------------------------------------------
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE results  ENABLE ROW LEVEL SECURITY;

-- Allow all operations from the anon role (public app, no auth required)
CREATE POLICY "Allow all for anon" ON searches
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for anon" ON results
  FOR ALL USING (true) WITH CHECK (true);
