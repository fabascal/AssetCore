BEGIN;

-- Add new ticket status values
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'PROVIDER';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'CANCELLED';

COMMIT;

-- Enum value additions must be committed before being used
BEGIN;

-- Migrate existing ESCALATED tickets to PROVIDER (only if ESCALATED was ever in the enum)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'ticket_status' AND e.enumlabel = 'ESCALATED'
  ) THEN
    UPDATE tickets SET status = 'PROVIDER' WHERE status::text = 'ESCALATED';
  END IF;
END $$;

-- Create ticket_attachments table
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS ticket_comments (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
