-- Drive Kochi database schema
-- Apply with: npm run db:init
-- Safe to run multiple times (IF NOT EXISTS everywhere).

-- Admin users. This app never creates admin rows automatically.
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rental cars
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  type TEXT,
  seats INT,
  transmission TEXT,
  fuel TEXT,
  price_per_day NUMERIC NOT NULL CHECK (price_per_day >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  images TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_order INT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Car types (SUV, sedan, ...), managed from the admin panel.
-- cars.type stores a slug from here; the app checks it on every car save
-- and refuses to delete a type while cars still use it.
CREATE TABLE IF NOT EXISTS car_types (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  label TEXT NOT NULL,
  blurb TEXT,
  image TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The original six types. ON CONFLICT keeps any edits made in the admin
-- panel when this file runs again on the next deploy.
INSERT INTO car_types (slug, label, blurb, image, sort_order) VALUES
  ('suv', 'SUV', 'Room for family and luggage', '/images/suv.webp', 1),
  ('sedan', 'Sedan', 'Comfort for city and highway', '/images/sedan.webp', 2),
  ('hatchback', 'Hatchback', 'Easy to park, light on fuel', '/images/hatchback.webp', 3),
  ('van', 'Van', 'For groups and long trips', '/images/van.webp', 4),
  ('luxury', 'Luxury', 'For weddings and special days', '/images/luxury.webp', 5),
  ('pickup', 'Pickup', 'Tough roads and cargo', '/images/pickup.webp', 6)
ON CONFLICT (slug) DO NOTHING;

-- Pickup / drop-off locations, managed from the admin panel. The website
-- offers them in the search box and booking form, and shows them in the
-- scrolling band. Enquiries store the chosen name as text, so editing or
-- deleting a location never changes past enquiries.
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tag TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS locations_name_unique ON locations (LOWER(name));

-- The starting list, only when the table is empty (admin edits are kept)
INSERT INTO locations (name, tag, sort_order)
SELECT v.name, v.tag, v.sort_order
FROM (VALUES
  ('Kochi Airport', 'pickup', 1),
  ('KSRTC Ernakulam', 'pickup', 2),
  ('Nedumbassery', 'pickup', 3),
  ('TVM Airport', 'pickup', 4),
  ('Varkala Branch', 'yard', 5),
  ('Vytilla Hub', 'pickup', 6)
) AS v(name, tag, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM locations);

-- Customer enquiries (no payments involved)
CREATE TABLE IF NOT EXISTS enquiries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  car_id INT REFERENCES cars (id) ON DELETE SET NULL,
  pickup_location TEXT,
  dropoff_location TEXT,
  start_date DATE,
  end_date DATE,
  pickup_time TIME,
  dropoff_time TIME,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'confirmed', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Empty dates are allowed; if both are present, end must be on/after start
  CHECK (end_date >= start_date)
);

-- Speed up the queries the site makes most
CREATE INDEX IF NOT EXISTS idx_cars_is_featured ON cars (is_featured);
CREATE INDEX IF NOT EXISTS idx_cars_type ON cars (type);
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries (status);
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries (created_at);

-- Session version: every admin JWT carries it, and logging out or changing
-- the password bumps it, so older tokens stop working immediately (a stolen
-- cookie dies at logout instead of living for the full 8 hours).
ALTER TABLE admins ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;

-- Prices are in Indian rupees. Tables created before this change had a
-- 'PKR' default; this keeps them in line (safe to run repeatedly).
ALTER TABLE cars ALTER COLUMN currency SET DEFAULT 'INR';

-- Google Sheet sync (src/services/sheetSync.js): for every row on each tab,
-- a hash of the editable cells as last written to the sheet, so a sync can
-- tell which rows were edited in the sheet since.
CREATE TABLE IF NOT EXISTS sheet_sync_rows (
  tab TEXT NOT NULL,
  row_id INT NOT NULL,
  hash TEXT NOT NULL,
  PRIMARY KEY (tab, row_id)
);
