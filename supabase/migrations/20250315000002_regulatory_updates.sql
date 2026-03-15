CREATE TABLE IF NOT EXISTS regulatory_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  link TEXT NOT NULL,
  framework TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, title)
);

ALTER TABLE regulatory_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read regulatory updates"
  ON regulatory_updates FOR SELECT
  TO authenticated
  USING (true);
