-- Magnexis Maps initial schema (PostgreSQL + PostGIS)
-- Applied via docker-entrypoint on first boot or via migrate script.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ---------------------------------------------------------------------------
-- Users & auth
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN (
    'guest', 'user', 'verified_business_owner', 'moderator', 'administrator'
  )),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  units TEXT NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
  approximate_location_only BOOLEAN NOT NULL DEFAULT FALSE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- Geographic data provenance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  license TEXT NOT NULL,
  attribution TEXT NOT NULL,
  homepage_url TEXT,
  refresh_frequency TEXT,
  permitted_uses TEXT,
  operational_restrictions TEXT,
  production_ready BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dataset_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id),
  version_label TEXT NOT NULL,
  release_date DATE,
  coverage TEXT,
  checksum TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (data_source_id, version_label)
);

CREATE TABLE IF NOT EXISTS place_categories (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  parent_id TEXT REFERENCES place_categories(id)
);

CREATE TABLE IF NOT EXISTS places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL REFERENCES place_categories(id),
  description TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  geom GEOMETRY(Point, 4326) NOT NULL,
  source_name TEXT NOT NULL,
  source_id TEXT,
  source_dataset_version TEXT,
  data_source_id UUID REFERENCES data_sources(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending', 'deleted')),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  search_vector TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS places_geom_gix ON places USING GIST (geom);
CREATE INDEX IF NOT EXISTS places_category_idx ON places(category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS places_source_idx ON places(source_name, source_id);
CREATE INDEX IF NOT EXISTS places_search_idx ON places USING GIN (search_vector);

CREATE OR REPLACE FUNCTION places_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS places_search_vector_trigger ON places;
CREATE TRIGGER places_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, address, city, description
  ON places
  FOR EACH ROW EXECUTE FUNCTION places_search_vector_update();

CREATE TABLE IF NOT EXISTS place_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_source TEXT NOT NULL,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (place_id, version_number)
);

CREATE TABLE IF NOT EXISTS geographic_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  feature_type TEXT NOT NULL,
  geom GEOMETRY(Geometry, 4326) NOT NULL,
  source_name TEXT NOT NULL,
  source_id TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS geographic_features_geom_gix
  ON geographic_features USING GIST (geom);

-- ---------------------------------------------------------------------------
-- Community corrections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS correction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  place_id UUID REFERENCES places(id),
  proposed_changes JSONB,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
    'submitted', 'under_review', 'more_info_needed', 'approved',
    'rejected', 'applied', 'reverted'
  )),
  submitter_id UUID REFERENCES users(id),
  guest_email TEXT,
  automated_recommendation JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS correction_reports_geom_gix
  ON correction_reports USING GIST (geom);
CREATE INDEX IF NOT EXISTS correction_reports_status_idx
  ON correction_reports(status);

CREATE TABLE IF NOT EXISTS correction_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES correction_reports(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  proposed_value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES correction_reports(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES correction_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stance TEXT NOT NULL CHECK (stance IN ('confirm', 'dispute', 'flag_abuse')),
  observation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_id, user_id)
);

CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES correction_reports(id) ON DELETE CASCADE,
  moderator_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  notes TEXT,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES correction_reports(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Business portal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id),
  claimant_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'needs_verification', 'verified', 'rejected'
  )),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id),
  claimant_id UUID NOT NULL REFERENCES users(id),
  field_changes JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- GeoSync / ingestion
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id),
  dataset_release_id UUID REFERENCES dataset_releases(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'succeeded', 'failed', 'cancelled'
  )),
  region TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_removed INTEGER DEFAULT 0,
  records_conflicted INTEGER DEFAULT 0,
  error_message TEXT,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS geographic_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID REFERENCES places(id),
  ingestion_job_id UUID REFERENCES ingestion_jobs(id),
  change_type TEXT NOT NULL CHECK (change_type IN (
    'added', 'modified', 'removed', 'duplicate_candidate', 'conflict'
  )),
  before_snapshot JSONB,
  after_snapshot JSONB,
  confidence REAL,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Incidents (Magnexis Live foundation — no fabricated traffic)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incident_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (
    verification_status IN ('unverified', 'community', 'official')
  ),
  source TEXT NOT NULL DEFAULT 'user',
  reporter_id UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS incident_reports_geom_gix
  ON incident_reports USING GIST (geom);

-- ---------------------------------------------------------------------------
-- Saved places & audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id),
  label TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_places_user_idx ON saved_places(user_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

-- Seed place categories
INSERT INTO place_categories (id, label) VALUES
  ('country', 'Country'),
  ('state', 'State'),
  ('county', 'County'),
  ('city', 'City'),
  ('neighborhood', 'Neighborhood'),
  ('road', 'Road'),
  ('intersection', 'Intersection'),
  ('address', 'Address'),
  ('building', 'Building'),
  ('business', 'Business'),
  ('park', 'Park'),
  ('landmark', 'Landmark'),
  ('transit', 'Transit'),
  ('parking', 'Parking'),
  ('public_facility', 'Public Facility'),
  ('water', 'Water'),
  ('poi', 'Point of Interest'),
  ('restaurant', 'Restaurant'),
  ('cafe', 'Cafe'),
  ('hotel', 'Hotel'),
  ('fuel', 'Fuel'),
  ('ev_charging', 'EV Charging'),
  ('hospital', 'Hospital'),
  ('pharmacy', 'Pharmacy'),
  ('school', 'School'),
  ('shopping', 'Shopping'),
  ('grocery', 'Grocery'),
  ('museum', 'Museum'),
  ('library', 'Library'),
  ('airport', 'Airport'),
  ('attraction', 'Attraction'),
  ('sports', 'Sports'),
  ('entertainment', 'Entertainment')
ON CONFLICT (id) DO NOTHING;

-- Seed known data sources (metadata only — not claiming production readiness)
INSERT INTO data_sources (
  name, license, attribution, homepage_url, refresh_frequency,
  permitted_uses, operational_restrictions, production_ready
) VALUES
  (
    'OpenStreetMap',
    'ODbL 1.0',
    '© OpenStreetMap contributors',
    'https://www.openstreetmap.org/copyright',
    'periodic regional extracts',
    'Share-alike geographic database use with attribution',
    'Do not use public OSM tile servers as unlimited production infrastructure; do not abuse Nominatim',
    FALSE
  ),
  (
    'Overture Maps',
    'Mixed (CDLA-Permissive / ODbL upstream)',
    'Overture Maps Foundation — preserve upstream attribution',
    'https://overturemaps.org/',
    'release-based',
    'Per-theme license compliance required',
    'Preserve provenance and share-alike obligations from upstream OSM-derived records',
    FALSE
  ),
  (
    'MapLibre Demo Tiles',
    'Demo / non-production',
    'MapLibre demotiles',
    'https://demotiles.maplibre.org/',
    'n/a',
    'Development basemap only',
    'Not for production; replace with licensed vector tile provider',
    FALSE
  )
ON CONFLICT (name) DO NOTHING;
