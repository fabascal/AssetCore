CREATE TABLE "device_useful_life" (
  "device_type"       device_type PRIMARY KEY,
  "useful_life_years" INTEGER     NOT NULL DEFAULT 5,
  "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed default values per device type
INSERT INTO "device_useful_life" ("device_type", "useful_life_years") VALUES
  ('LAPTOP',  5),
  ('DESKTOP', 6),
  ('SERVER',  7),
  ('PRINTER', 5),
  ('MONITOR', 6),
  ('OTHER',   5)
ON CONFLICT DO NOTHING;
