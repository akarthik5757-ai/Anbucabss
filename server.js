import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const port = Number(process.env.PORT || 3000);
const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }));

const bookingSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(20).regex(/^[+0-9()\-\s]+$/),
  type: z.string().trim().min(2).max(80),
  date: z.iso.date(),
  returnDate: z.union([z.iso.date(), z.literal('')]).optional(),
  pickup: z.string().trim().min(2).max(160),
  destination: z.string().trim().min(2).max(160),
  passengers: z.string().regex(/^(?:[1-7]|8\+)$/).optional(),
  notes: z.string().trim().max(600).optional()
}).refine((v) => !v.returnDate || !v.returnDate || v.returnDate >= v.date, {
  message: 'Return date must be on or after the travel date', path: ['returnDate']
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'anbu-tour-travels-api' }));

app.post('/api/bookings', async (req, res) => {
  const parsed = bookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please check the booking details and try again.' });
  }
  const b = parsed.data;
  if (b.date < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ error: 'Travel date cannot be in the past.' });
  }
  const passengers = b.passengers === '8+' ? 8 : Number(b.passengers || '1');
  const { data, error } = await supabase.from('bookings').insert({
    customer_name: b.name,
    customer_phone: b.phone,
    pickup_location: b.pickup,
    drop_location: b.destination,
    travel_date: b.date,
    return_date: b.returnDate || null,
    passengers,
    trip_type: b.type,
    special_requests: b.notes || null,
    status: 'pending'
  }).select('id, booking_reference, status, created_at').single();

  if (error) {
    console.error('Supabase booking insert failed:', error.message);
    return res.status(500).json({ error: 'Booking could not be saved right now. Please call 7604905989.' });
  }
  return res.status(201).json({
    id: data.id,
    booking_reference: data.booking_reference,
    status: data.status,
    created_at: data.created_at
  });
});

app.use(express.static(path.join(here, 'public')));
app.get('*splat', (_req, res) => res.sendFile(path.join(here, 'public', 'index.html')));

app.listen(port, () => console.log(`ANBU Tour & Travels server listening on port ${port}`));
