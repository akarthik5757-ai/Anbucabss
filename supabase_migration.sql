-- Run this in Supabase SQL Editor after the bookings table has been created.
-- Adds the return-date field used by the current website form.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS return_date DATE;

-- The Node.js server uses the service-role key only on the server.
-- RLS remains enabled; do not add a public INSERT policy for this setup.

CREATE INDEX IF NOT EXISTS bookings_created_at_idx
  ON public.bookings (created_at DESC);
