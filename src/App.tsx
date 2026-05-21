import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AdminAuth from './pages/AdminAuth';
import AdminDashboard from './pages/AdminDashboard';
import Receipt from './pages/Receipt';
import MaintenanceScreen from './components/MaintenanceScreen';

interface AppSettings {
  app_name: string;
  currency: string;
  support_email: string;
  maintenance_mode: boolean;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGlobalSettings = useCallback(async (retryCount = 0) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'general')
        .single();

      if (error) throw error;
      if (data) {
        setSettings(data.value as AppSettings);
      }
    } catch (err: any) {
      console.error(`Error fetching settings (attempt ${retryCount + 1}):`, err);
      
      // Retry logic for network errors
      if (retryCount < 2 && (err.message?.includes('Failed to fetch') || err.message?.includes('Network Error'))) {
        setTimeout(() => fetchGlobalSettings(retryCount + 1), 1500);
        return;
      }

      // Fallback settings to prevent total breakage
      setSettings({
        app_name: 'Datapapa',
        currency: 'GHS',
        support_email: 'support@datapapa.com',
        maintenance_mode: false,
      });
    }
  }, []);

  const isFetchingRole = useRef(false);

  const fetchUserRole = useCallback(async (existingUser?: any, retryCount = 0) => {
    if (isFetchingRole.current) return;
    isFetchingRole.current = true;

    try {
      let user = existingUser;
      
      if (!user) {
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
          // If refresh token is missing or invalid, clear everything
<<<<<<< HEAD
          const errMsg = (error.message || '').toLowerCase();
          if (
            errMsg.includes('refresh token') ||
            errMsg.includes('session missing') ||
            errMsg.includes('invalid_grant') ||
            error.status === 400 ||
            error.status === 401
          ) {
            console.warn('Auth issue detected in App.tsx, signing out...');
            localStorage.removeItem('datapapa-auth-token');
            await supabase.auth.signOut().catch(() => {});
=======
          if (
            error.message?.includes('Refresh Token Not Found') ||
            error.message?.includes('Auth session missing')
          ) {
            console.warn('Auth issue detected in App.tsx, signing out...');
            await supabase.auth.signOut();
>>>>>>> e6fd22d669f549986d7f8c754e04fcae1247078b
            setUserRole(null);
            return;
          }
          throw error;
        }
        
        user = data?.user;
      }
      
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setUserRole(data?.role || 'user');
      } else {
        setUserRole(null);
      }
    } catch (err: any) {
      if ((err.message?.includes('Lock') || err.message?.includes('steal')) && retryCount < 3) {
        // Retry silently
        console.log(`User role fetch lock conflict, retrying (${retryCount + 1}/3)...`);
        isFetchingRole.current = false;
        setTimeout(() => fetchUserRole(existingUser, retryCount + 1), 500);
        return;
      } else {
        console.error('Error fetching user role:', err);
        setUserRole(null);
      }
    } finally {
      isFetchingRole.current = false;
    }
  }, []);

  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    
    // Set a maximum wait time for initialization
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 5000));
    
    const initPromise = (async () => {
      await fetchUserRole();
      await fetchGlobalSettings();
    })();
    
    await Promise.race([initPromise, timeoutPromise]);
    setIsLoading(false);
  }, [fetchGlobalSettings, fetchUserRole]);

  useEffect(() => {
    initializeApp();

    // Set up real-time subscription for settings
    const settingsSubscription = supabase
      .channel('public:settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'settings', filter: 'key=eq.general' },
        (payload) => {
          if (payload.new && payload.new.value) {
            setSettings(payload.new.value as AppSettings);
          }
        }
      )
      .subscribe();

    // Listen for auth state changes
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      fetchUserRole(session?.user);
    });

    return () => {
      settingsSubscription.unsubscribe();
      authSub.unsubscribe();
    };
  }, [initializeApp, fetchUserRole]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Maintenance mode logic: Block non-admins if maintenance_mode is active
  const isMaintenanceMode = settings?.maintenance_mode === true;
  const isAdmin = userRole === 'admin';

  if (isMaintenanceMode && !isAdmin) {
    return <MaintenanceScreen supportEmail={settings?.support_email} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Navbar settings={settings} />
        <main>
          <Routes>
            <Route path="/" element={<Home settings={settings} />} />
            <Route path="/receipt/:id" element={<Receipt />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

