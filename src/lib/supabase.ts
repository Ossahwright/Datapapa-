import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qsxzarhxgfwnogvuqomf.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzeHphcmh4Z2Z3bm9ndnVxb21mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAyOTcsImV4cCI6MjA5MjU5NjI5N30.ZQZFhxQgzy9JBGUBW9wRfRDs44wcFkmDFu78PUJIags';

export const isSupabaseConfigured = true;

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'datapapa-auth-token',
  },
});

/**
 * Safely gets the session and handles the common "Refresh Token Not Found" error
 * which happens when the local storage session is stale or invalid.
 */
export const getSafeSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      if (
        errMsg.includes('refresh token') ||
        errMsg.includes('session missing') ||
        errMsg.includes('invalid_grant') ||
        error.status === 400 ||
        error.status === 401
      ) {
        console.warn('Stale session detected, signing out...');
        localStorage.removeItem('datapapa-auth-token');
        await supabase.auth.signOut().catch(() => {});
        return { session: null, error: null };
      }

      return { session: null, error };
    }
     
    return { session: data?.session || null, error: null };
  } catch (err) {
    console.error('Session retrieval failed:', err);
    return { session: null, error: err };
  }
};
