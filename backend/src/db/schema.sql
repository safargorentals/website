-- SafarGo database schema
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
  currency TEXT NOT NULL DEFAULT 'PKR',
  images TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  featured_order INT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
