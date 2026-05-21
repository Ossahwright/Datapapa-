import React, { useState, useEffect } from 'react';
import { supabase, getSafeSession } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail, AlertCircle, ShieldCheck, Eye, EyeOff, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminAuth() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in on initial load
    const checkSession = async () => {
      const { session, error } = await getSafeSession();
      if (error) {
        console.error("Session check error:", error);
        return;
      }
      if (session) {
        // If session exists, try to verify role quickly
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile?.role === 'admin') {
          navigate('/admin');
        }
      }
    };
    
    checkSession();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'admin' // Attempt to set role in metadata as fallback
            }
          }
        });
        if (error) {
          if (error.message.includes('Database error saving new user')) {
            throw new Error(
              'Database error saving new user: This happens when a Database Trigger on Supabase auth.users fails (e.g., trying to write to a table that doesn\'t exist). Please copy and run the contents of "supabase-setup.sql" in your Supabase SQL Editor.'
            );
          }
          throw error;
        }
        if (data?.user && data?.session === null) {
          setSuccessMsg('Registration successful. Please check your email to verify your account.');
        } else {
          setSuccessMsg('Registration successful! Logging you in...');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const user = data.user;
        if (!user) throw new Error("No user returned");

        // 🔥 FETCH ROLE FROM PROFILES TABLE (correct way)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error("Profile fetch error:", profileError);
          // If profile doesn't exist, they might not be an admin
          await supabase.auth.signOut();
          throw new Error("Access denied. Admin profile not found.");
        }

        if (profile?.role !== 'admin') {
          await supabase.auth.signOut();
          throw new Error("Access denied. Administrator privileges required.");
        }

        // ✅ Success
        navigate('/admin');
      }
    } catch (err: any) {
      let errorMessage = err.message || 'An error occurred during authentication.';
      
      if (errorMessage === 'Invalid login credentials') {
        errorMessage = 'Invalid login credentials. This usually means your email/password is incorrect, or you need to confirm your email address. If you just registered, check your inbox for a confirmation link (or disable "Confirm Email" in your Supabase project settings -> Authentication -> Providers -> Email).';
      }

      setError(errorMessage);
      console.error("Auth error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100 overflow-hidden relative">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-slate-200">
            <ShieldCheck size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Admin Login' : 'Admin Registration'}
          </h2>
          <p className="text-slate-500 mt-2 text-sm">
            {mode === 'login' ? 'Enter your credentials to access the dashboard' : 'Create an admin account to manage the platform'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-start gap-3 text-sm"
            >
              <AlertCircle size={20} className="shrink-0 mt-0.5 text-red-500" />
              <p>{error}</p>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-start gap-3 text-sm"
            >
              <ShieldCheck size={20} className="shrink-0 mt-0.5 text-green-500" />
              <p>{successMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth} className="space-y-5">
          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="block text-sm font-semibold text-slate-900 mb-1.5" htmlFor="fullName">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  id="fullName"
                  type="text"
                  required={mode === 'register'}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                  placeholder="John Doe"
                />
              </div>
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5" htmlFor="email">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                placeholder="admin@datapapa.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5" htmlFor="password">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm shadow-indigo-200 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-slate-100 pt-6">
          <p className="text-sm text-slate-500">
            {mode === 'login' ? "Don't have an admin account? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setSuccessMsg('');
              }}
              className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {mode === 'login' ? 'Register here' : 'Login here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
