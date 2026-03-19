/*
  # Farewell Party Ticketing System Schema

  ## Overview
  Complete database schema for managing student tickets, check-ins, and event settings.

  ## New Tables

  ### 1. students
  - `id` (uuid, primary key) - Unique student identifier
  - `roll_number` (text, unique, not null) - Student roll number
  - `name` (text, not null) - Student full name
  - `email` (text, not null) - Student email address
  - `created_at` (timestamptz) - Record creation timestamp

  ### 2. tickets
  - `id` (uuid, primary key) - Unique ticket identifier (used in URL)
  - `student_id` (uuid, foreign key) - Reference to students table
  - `qr_hash` (text, unique) - Hash for QR code validation
  - `status` (text) - Ticket status: 'pending', 'sent', 'checked_in'
  - `checked_in_at` (timestamptz) - Timestamp of check-in
  - `created_at` (timestamptz) - Ticket creation timestamp
  - `sent_at` (timestamptz) - Email sent timestamp

  ### 3. event_settings
  - `id` (uuid, primary key) - Settings identifier
  - `event_name` (text) - Event title
  - `date` (text) - Event date
  - `time` (text) - Event time
  - `venue` (text) - Event venue location
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Public read access for tickets and event_settings (for student viewing)
  - Authenticated write access for admin operations
  - Validator can update check-in status

  ## Notes
  - QR codes will contain the ticket ID and qr_hash for validation
  - Event settings are globally shared and updated by admins
  - Check-in timestamps are recorded for duplicate detection
*/

-- Create students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text UNIQUE NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  qr_hash text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  checked_in_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'checked_in'))
);

-- Create event_settings table
CREATE TABLE IF NOT EXISTS event_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL DEFAULT 'FAREWELL PARTY',
  date text NOT NULL DEFAULT 'TBD',
  time text NOT NULL DEFAULT 'TBD',
  venue text NOT NULL DEFAULT 'To be decided',
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_student_id ON tickets(student_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_hash ON tickets(qr_hash);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for students table
CREATE POLICY "Public can read students for ticket generation"
  ON students FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert students"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
  ON students FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tickets table
CREATE POLICY "Public can read tickets"
  ON tickets FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tickets"
  ON tickets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update ticket check-in status"
  ON tickets FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for event_settings table
CREATE POLICY "Public can read event settings"
  ON event_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can update event settings"
  ON event_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert event settings"
  ON event_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default event settings
INSERT INTO event_settings (event_name, date, time, venue)
VALUES ('FAREWELL PARTY', 'TBD', 'TBD', 'To be decided')
ON CONFLICT DO NOTHING;