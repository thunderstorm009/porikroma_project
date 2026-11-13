CREATE TABLE IF NOT EXISTS annual_travel_budgets (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  budget_year integer NOT NULL CHECK (budget_year BETWEEN 2000 AND 2200),
  amount integer NOT NULL CHECK (amount >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, budget_year)
);
