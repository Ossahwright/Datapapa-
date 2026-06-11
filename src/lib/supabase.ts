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

// Monkey-patch Supabase Auth getSession and getUser to handle navigator locks and Web Locks API 'steal' issues gracefully
const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
const originalGetUser = supabase.auth.getUser.bind(supabase.auth);

supabase.auth.getSession = async function getSessionWithRetry(retryCount = 0): Promise<any> {
  try {
    const result = await originalGetSession();
    if (result.error) {
      const errMsg = (result.error.message || '').toLowerCase();
      if (
        errMsg.includes('refresh token') ||
        errMsg.includes('session missing') ||
        errMsg.includes('invalid_grant') ||
        result.error.status === 400 ||
        result.error.status === 401
      ) {
        console.warn('Stale session detected, signing out...');
        localStorage.removeItem('datapapa-auth-token');
        supabase.auth.signOut().catch(() => {});
        return { data: { session: null }, error: null };
      }
    }
    return result;
  } catch (err: any) {
    const errMsg = (err.message || '').toLowerCase();
    if ((errMsg.includes('lock') || errMsg.includes('steal')) && retryCount < 5) {
      console.warn(`⚠️ Supabase session lock conflict, retrying getSession (${retryCount + 1}/5)...`);
      await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1)));
      return getSessionWithRetry(retryCount + 1);
    }
    console.warn('Session retrieval encountered a permanent exception/lock conflict:', err);
    return { data: { session: null }, error: err };
  }
};

supabase.auth.getUser = async function getUserWithRetry(jwt?: string, retryCount = 0): Promise<any> {
  try {
    const result = await originalGetUser(jwt);
    return result;
  } catch (err: any) {
    const errMsg = (err.message || '').toLowerCase();
    if ((errMsg.includes('lock') || errMsg.includes('steal')) && retryCount < 5) {
      console.warn(`⚠️ Supabase getUser lock conflict, retrying getUser (${retryCount + 1}/5)...`);
      await new Promise(resolve => setTimeout(resolve, 300 * (retryCount + 1)));
      return getUserWithRetry(jwt, retryCount + 1);
    }
    console.warn('User retrieval encountered a permanent exception/lock conflict:', err);
    return { data: { user: null }, error: err };
  }
};

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
