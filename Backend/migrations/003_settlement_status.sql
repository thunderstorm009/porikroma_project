-- Migration: 003_settlement_status.sql
-- Adds CONFIRMED to expense_settlements status check and adds settled_at column.
-- Idempotent: safe to run multiple times.

ALTER TABLE expense_settlements ADD COLUMN IF NOT EXISTS settled_at timestamptz;

DO $$
BEGIN
  ALTER TABLE expense_settlements DROP CONSTRAINT IF EXISTS expense_settlements_status_check;
  ALTER TABLE expense_settlements ADD CONSTRAINT expense_settlements_status_check
    CHECK (status IN ('PENDING', 'PAID', 'CONFIRMED', 'CANCELLED'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_expense_settlements_trip ON expense_settlements(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_settlements_from ON expense_settlements(from_user_id);
CREATE INDEX IF NOT EXISTS idx_expense_settlements_to ON expense_settlements(to_user_id);
