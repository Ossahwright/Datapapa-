import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAyOTcsImV4cCI6MjA5MjU5NjI5N30.ZQZFhxQgzy9JBGUBW9wRfRDs44wcFkmDFu78PUJIags';

export const isSupabaseConfigured = true;

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});
