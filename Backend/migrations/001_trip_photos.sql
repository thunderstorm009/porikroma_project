-- Migration: 001_trip_photos.sql
-- Adds/ensures trip_photos table with (id, trip_id, user_id, url, caption, taken_at, created_at)
-- Idempotent: can be safely executed multiple times without errors.

CREATE TABLE IF NOT EXISTS trip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  caption text NOT NULL DEFAULT '',
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_photos' AND column_name = 'user_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_photos' AND column_name = 'uploaded_by') THEN
      ALTER TABLE trip_photos RENAME COLUMN uploaded_by TO user_id;
    ELSE
      ALTER TABLE trip_photos ADD COLUMN user_id uuid REFERENCES users(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_photos' AND column_name = 'taken_at') THEN
    ALTER TABLE trip_photos ADD COLUMN taken_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;
