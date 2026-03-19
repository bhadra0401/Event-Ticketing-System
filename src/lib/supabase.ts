import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Student = {
  id: string;
  roll_number: string;
  name: string;
  email: string;
  created_at: string;
};

export type Ticket = {
  id: string;
  student_id: string;
  qr_hash: string;
  status: 'pending' | 'sent' | 'checked_in';
  checked_in_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type EventSettings = {
  id: string;
  event_name: string;
  date: string;
  time: string;
  venue: string;
  updated_at: string;
};

export type StudentWithTicket = Student & {
  ticket: Ticket | null;
};
