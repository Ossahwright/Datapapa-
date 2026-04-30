import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AdminAuth from './pages/AdminAuth';
import AdminDashboard from './pages/AdminDashboard';
import MaintenanceScreen from './components/MaintenanceScreen';

interface AppSettings {
  app_name: string;
  currency: string;
  support_email: string;
  maintenance_mode: boolean;
  sms_enabled: boolean;
  sms_sender_id: string;
  sms_template_success: string;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGlobalSettings = useCallback(async () => {
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
    } catch (err) {
      console.error('Error fetching settings:', err);
      // Fallback settings to prevent total breakage
      setSettings({
        app_name: 'Datapapa',
        currency: 'GHS',
        support_email: 'support@datapapa.com',
        maintenance_mode: false,
        sms_enabled: true,
        sms_sender_id: 'Datapapa',
        sms_template_success: 'Hello! You have successfully received {volume} data on your {network} line. Thank you for using {app_name}.'
      });
    }
  }, []);

  const fetchUserRole = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
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
    } catch (err) {
      console.error('Error fetching user role:', err);
      setUserRole(null);
    }
  }, []);

  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchGlobalSettings(), fetchUserRole()]);
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
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(() => {
      fetchUserRole();
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
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

