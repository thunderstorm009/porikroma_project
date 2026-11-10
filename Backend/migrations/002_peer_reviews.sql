-- Migration: 002_peer_reviews.sql
-- Adds peer_reviews table for traveler-to-traveler reviews after completed trips.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS peer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_no_self_review CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT unq_peer_reviews_trip_reviewer_reviewee UNIQUE (trip_id, reviewer_id, reviewee_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_reviews_reviewee ON peer_reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_peer_reviews_trip ON peer_reviews(trip_id);
