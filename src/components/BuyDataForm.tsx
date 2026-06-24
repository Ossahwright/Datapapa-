import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, ChevronDown, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import axios from 'axios';
import { openWhatsApp } from '../lib/whatsapp';

import { NETWORK_CONFIG, NETWORKS, findNetworkConfig } from '../lib/networkConfig';
import { BUNDLE_CONFIG, findNormalizedBundle } from '../lib/bundleConfig';
import { TransactionReceiptCard, TransactionStatus } from './payment/TransactionReceiptCard';
import { 
  API_ROUTES, 
  PAYMENT_STATUSES, 
  VTU_STATUSES 
} from '../../lib/constants';

interface BuyDataFormProps {
  settings: {
    app_name: string;
    currency: string;
    support_email: string;
    maintenance_mode: boolean;
    bece_active?: boolean;
    wassce_active?: boolean;
    airtime_active?: boolean;
    data_active?: boolean;
  } | null;
  activeService?: 'DATA' | 'AIRTIME' | 'WASSCE' | 'BECE';
  setActiveService?: (service: 'DATA' | 'AIRTIME' | 'WASSCE' | 'BECE') => void;
}

export default function BuyDataForm({ settings, activeService: propsActiveService, setActiveService: propsSetActiveService }: BuyDataFormProps) {
  const navigate = useNavigate();
  const [localActiveService, setLocalActiveService] = useState<'DATA' | 'AIRTIME' | 'WASSCE' | 'BECE'>('DATA');
  const activeService = propsActiveService !== undefined ? propsActiveService : localActiveService;
  const setActiveService = propsSetActiveService !== undefined ? propsSetActiveService : setLocalActiveService;

  const [network, setNetwork] = useState('');
  const [bundle, setBundle] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [dbBundles, setDbBundles] = useState<any[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [providerStatus, setProviderStatus] = useState<'operational' | 'degraded' | 'outage' | 'unreachable' | 'checking'>('checking');

  const [supabaseReady] = useState(isSupabaseConfigured);
  
  const adminWhatsApp = "233244014207"; // Admin's native WhatsApp

  const appName = settings?.app_name || "Datapapa";
  const currency = settings?.currency || "GHS";
  const supportEmail = settings?.support_email || "support@datapapa.site";

  const fetchBundles = async (retryCount = 0) => {
    if (supabaseReady) {
      if (retryCount === 0) setIsLoadingBundles(true);
      setLoadError('');
      try {
        const { data, error } = await supabase
          .from('bundles')
          .select('*')
          .eq('is_active', true) // Only fetch active ones originally
          .order('selling_price', { ascending: true });
          
        if (error) {
          throw error;
        } else if (data) {
          console.log("🚀 [Bundle Sync] Fetched authoritative bundles:", data.length);
          
          // Map and resolve service_type & provider dynamically to bypass missing database columns
          const enriched = data.map((b: any) => {
            const netKey = String(b.network_key || '').toUpperCase();
            const dhNetKey = String(b.datahub_network_key || '').toUpperCase();
            const isBECE = netKey === 'BECE' || dhNetKey === 'BECE';
            const isWASSCE = netKey === 'WASSCE' || dhNetKey === 'WASSCE';
            const isAirtime = netKey === 'AIRTIME' || dhNetKey === 'AIRTIME';

            return {
              ...b,
              service_type: isBECE ? 'BECE' : isWASSCE ? 'WASSCE' : isAirtime ? 'AIRTIME' : (b.service_type || 'DATA'),
              provider: isAirtime ? 'HUBTEL' : (b.provider || 'DATAHUBGH')
            };
          });

          setDbBundles(enriched);
        }
      } catch (error: any) {
        if ((error.message?.includes('Lock broken') || error.message?.includes('steal')) && retryCount < 3) {
          console.warn(`⚠️ Supabase lock error, retrying (${retryCount + 1}/3)...`);
          setTimeout(() => fetchBundles(retryCount + 1), 700);
          return;
        }
        console.error("❌ [Bundle Sync] Critical error:", error.message);
        setLoadError(error.message || 'Failed to sync bundles with server');
      } finally {
        setIsLoadingBundles(false);
      }
    } else {
      setIsLoadingBundles(false);
    }
  };

  useEffect(() => {
    if (activeService === 'DATA' && settings?.data_active === false) {
      if (settings?.airtime_active !== false) {
        setActiveService('AIRTIME');
      } else if (settings?.wassce_active !== false) {
        setActiveService('WASSCE');
      } else if (settings?.bece_active !== false) {
        setActiveService('BECE');
      }
    } else if (activeService === 'BECE' && settings?.bece_active === false) {
      setActiveService(settings?.data_active !== false ? 'DATA' : 'AIRTIME');
    } else if (activeService === 'WASSCE' && settings?.wassce_active === false) {
      setActiveService(settings?.data_active !== false ? 'DATA' : 'AIRTIME');
    } else if (activeService === 'AIRTIME' && settings?.airtime_active === false) {
      setActiveService(settings?.data_active !== false ? 'DATA' : 'WASSCE');
    }
  }, [activeService, settings, setActiveService]);

  useEffect(() => {
    fetchBundles();

    const fetchProviderHealth = async () => {
      try {
        const res = await axios.get(API_ROUTES.PROVIDER_HEALTH);
        setProviderStatus(res.data.status);
      } catch (err) {
        console.warn("Health check failed in client:", err);
        setProviderStatus('degraded'); // Fail gracefully to degraded
      }
    };

    fetchProviderHealth();
    const healthInterval = setInterval(fetchProviderHealth, 60000); // Check once a minute

    // 🚀 REAL-TIME BUNDLE ORCHESTRATION
    // We subscribe to all bundle changes to keep the UI in perfect sync with the provider
    let channel: any;
    if (supabaseReady) {
      channel = supabase
        .channel('bundles-realtime-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bundles' },
          (payload) => {
            console.log("⚡ [Real-time] Bundle change detected:", payload.eventType);
            
            // OPTIMIZED: Instead of full refetch, we could update state, 
            // but for data integrity as a telecom app, a clean refetch is safer
            fetchBundles();
          }
        )
        .subscribe((status) => {
          console.log("📡 Bundle Realtime Status:", status);
        });
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
      clearInterval(healthInterval);
    };
  }, [supabaseReady]);

  const allBundles = useMemo(() => {
    return dbBundles
      .filter(b => b.is_active === true && (!b.service_type || b.service_type === 'DATA'))
      .reduce((acc: any, b: any) => {
        const dbNetKey = (b.network_key || b.network || '').toUpperCase();
        const dbCapacity = (b.capacity || b.volume || '').toUpperCase();
        
        // 🚀 ATTEMPT AUTHORITATIVE NORMALIZATION
        const normalized = findNormalizedBundle(dbNetKey, dbCapacity);
        
        let bundleItem: any;
        let netId: string;

        if (normalized) {
          netId = normalized.networkId;
          bundleItem = {
            id: normalized.id,
            db_id: b.id,
            name: normalized.displayLabel,
            price: parseFloat(b.selling_price) || normalized.price,
            volume: normalized.displayLabel,
            provider_capacity: normalized.providerCapacity,
            provider_network_key: normalized.providerNetworkKey,
            is_normalized: true,
            original: b
          };
        } else {
          // 🚀 ALTERNATIVE APPROACH: DIRECT DB SYNC (ROCK SOLID FALLBACK)
          // If not in local config, we trust the DB values 100%
          const netConfig = findNetworkConfig(dbNetKey);
          netId = netConfig?.id || dbNetKey;
          
          bundleItem = {
            id: `db_${b.id}`,
            db_id: b.id,
            name: b.name || `${dbCapacity} Bundle`,
            price: parseFloat(b.selling_price) || 0,
            volume: b.volume || dbCapacity,
            provider_capacity: b.datahub_capacity || b.provider_capacity || dbCapacity,
            provider_network_key: b.datahub_network_key || b.provider_network_key || dbNetKey,
            is_normalized: false,
            original: b
          };
        }

        if (!acc[netId]) acc[netId] = [];
        acc[netId].push(bundleItem);
        return acc;
      }, {});
  }, [dbBundles]);

  const activeServiceOptions = useMemo(() => {
    if (activeService === 'DATA') {
      return network 
        ? [...(allBundles[network] || [])].sort((a: any, b: any) => a.price - b.price) 
        : [];
    } else {
      // For other services, filter the raw fetched database bundles or fallback to correct structures
      return dbBundles
        .filter(b => {
          if (b.is_active !== true) return false;
          
          // Fallback check: if database has empty/missing service_type column, treat it as DATA
          const resolvedService = b.service_type || 'DATA';
          if (resolvedService !== activeService) return false;

          if (activeService === 'BECE' || activeService === 'WASSCE') {
            return true; // WAEC Provider
          }

          const dbNet = String(b.network || '').toUpperCase();
          const selNet = String(network || '').toUpperCase();
          return dbNet === selNet || (selNet === 'AIRTELTIGO' && (dbNet === 'AIRTELTIGO_PREMIUM' || dbNet === 'AIRTELTIGO_BIGTIME' || dbNet === 'AIRTELTIGO' || dbNet === 'AT'));
        })
        .map(b => ({
          id: b.id,
          db_id: b.id,
          name: b.name || b.capacity || `${b.volume || b.capacity || ''}`,
          price: parseFloat(b.selling_price) || 0,
          volume: b.capacity || b.volume || b.name || '',
          provider_capacity: b.datahub_capacity || b.provider_capacity || b.capacity,
          provider_network_key: b.datahub_network_key || b.provider_network_key || b.network,
          is_normalized: false,
          original: b
        }))
        .sort((a, b) => a.price - b.price);
    }
  }, [dbBundles, activeService, network, allBundles]);

  const networksToRender = useMemo(() => {
    if (activeService === 'AIRTIME') {
      const allAirtime = [
        { id: 'MTN', label: 'MTN', logoUrl: 'https://i.postimg.cc/BvS8nyGS/download.jpg', activeKey: 'network_mtn_active' },
        { id: 'AIRTELTIGO', label: 'AirtelTigo', logoUrl: 'https://i.postimg.cc/sfqT8kkW/images.jpg', activeKey: 'network_airteltigo_premium_active' },
        { id: 'TELECEL', label: 'Telecel', logoUrl: 'https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg', activeKey: 'network_telecel_active' }
      ];
      return allAirtime.filter(net => {
        const isMtnActive = (settings as any)?.network_mtn_active !== false;
        const isTelecelActive = (settings as any)?.network_telecel_active !== false;
        const isAirtelTigoActive = (settings as any)?.network_airteltigo_premium_active !== false || (settings as any)?.network_airteltigo_bigtime_active !== false;
        
        if (net.id === 'MTN') return isMtnActive;
        if (net.id === 'TELECEL') return isTelecelActive;
        if (net.id === 'AIRTELTIGO') return isAirtelTigoActive;
        return true;
      });
    }
    // Standard DATA selector returning active networks from config
    return NETWORKS.filter(net => {
      const activeKey = `network_${net.id.toLowerCase()}_active`;
      return (settings as any)?.[activeKey] !== false;
    }).map(net => ({
      id: net.id,
      label: net.label,
      logoUrl: net.id === 'MTN' ? 'https://i.postimg.cc/BvS8nyGS/download.jpg' :
              net.id === 'TELECEL' ? 'https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg' :
              'https://i.postimg.cc/sfqT8kkW/images.jpg'
    }));
  }, [activeService, settings]);

  useEffect(() => {
    if (network) {
      const isAvailable = networksToRender.some(net => net.id === network);
      if (!isAvailable) {
        setNetwork('');
        setBundle('');
      }
    }
  }, [networksToRender, network]);

  const selectedBundleObj = activeServiceOptions.find((b: any) => String(b.id) === String(bundle));

  const AUTHORITATIVE_PUB_KEY = "";
  const rawKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const PAYSTACK_PUB_KEY = (!rawKey || rawKey === "" || rawKey.includes("VITE_")) 
    ? AUTHORITATIVE_PUB_KEY 
    : rawKey;

  const handlePaymentSuccess = async (paystackResponse: any) => {
    console.log("=== PAYSTACK_CALLBACK_RECEIVED ===");
    console.log("💰 Callback Reference:", paystackResponse.reference);
    console.log("💰 Type:", typeof paystackResponse.reference);

    navigate(`/receipt/${paystackResponse.reference}`);
  };

  const handlePaymentClose = () => {
    console.log("🔒 [Frontend] PAYSTACK WINDOW CLOSED BY USER");
    setIsLoading(false);
  };

  const handlePayment = async () => {
    console.log("=== [Frontend] PAYMENT INITIALIZATION START ===");
    
    if (providerStatus === 'outage' || providerStatus === 'unreachable') {
      console.warn("⚠️ [Frontend] Gating: Provider outage/unreachable detected. Blocking initialization.");
      setError('Purchases are temporarily unavailable. Please try again soon.');
      return;
    }

    if (!phone || phone.length < 10) {
      setError('Please enter a valid recipient phone number');
      return;
    }

    if (!selectedBundleObj) {
      setError(
        activeService === 'DATA' ? 'Please select a data bundle package' :
        activeService === 'AIRTIME' ? 'Please select an airtime value' :
        'Please select a voucher package'
      );
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log("📝 Initializing payment intent on server...");
      const { data: { user } } = await supabase.auth.getUser();
      
      const response = await fetch(API_ROUTES.PAYSTACK_INITIALIZE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: selectedBundleObj.db_id || selectedBundleObj.id,
          phone,
          payerPhone: payerPhone || phone,
          networkId: network,
          userId: user?.id,
          service_type: activeService,
          amount: selectedBundleObj.price
        }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to initialize payment');
      }

      console.log("✅ Server intent successful.");
      console.log("🚀 Transaction reference:", result.config.reference);

      // 1. 🚀 REDIRECT FLOW: Check if the server successfully created a standard Paystack checkout URL
      if (result.config.authorizationUrl) {
        try {
          console.log("=== PAYSTACK_REDIRECT_STARTED ===");
          console.log("🚀 Redirecting to standard Paystack checkout URL:", result.config.authorizationUrl);
          // We use top-level or direct window redirection to bypass nested iframe constraints
          window.location.href = result.config.authorizationUrl;
          return;
        } catch (redirErr) {
          console.error("=== PAYSTACK_REDIRECT_FAILED ===");
          console.error("Failed to execute redirect:", redirErr);
          throw new Error("Could not redirect to Paystack hosted payment page. Please try again.");
        }
      }

      // Determine public key and check if mock/demo configuration is needed
      const activePublicKey = result.config.publicKey || PAYSTACK_PUB_KEY;
      const isDummyKey = !activePublicKey || activePublicKey.trim() === "" || activePublicKey.includes("VITE_");

      // 2. 🚀 SIMULATION MODE: If we are in preview/development and no live public key is set, simulate payment success
      if (isDummyKey) {
        console.warn("⚠️ No active Paystack Public Key found on server or build configuration. Launching simulation mode...");
        
        // Let's emulate a quick, realistic 1.2-second network delivery spinner
        setTimeout(() => {
          console.log("🎯 [Simulated Checkout Success] Directing to receipt page:", result.config.reference);
          navigate(`/receipt/${result.config.reference}`);
        }, 1200);
        return;
      }

      // 3. 🚀 INLINE POPUP FALLBACK: Launch inline pop if script is available
      // @ts-ignore
      if (!window.PaystackPop) {
        console.error("❌ Paystack inline.js script not loaded on window object.");
        throw new Error("Paystack secure script could not be loaded. Please check your internet connection.");
      }

      const config = {
        reference: result.config.reference,
        amount: result.config.amount,
        email: result.config.email,
        metadata: result.config.metadata,
        key: activePublicKey,
        currency: 'GHS',
        channels: ['mobile_money', 'card'],
      };
      
      console.log("🚀 Launching Paystack inline gateway with reference:", config.reference);

      // @ts-ignore
      const handler = window.PaystackPop.setup({
        ...config,
        callback: (response: any) => handlePaymentSuccess(response),
        onClose: () => handlePaymentClose(),
      });
      handler.openIframe();
      
    } catch (err: any) {
      console.error("❌ Payment Initiation Error:", err);
      setError(err.message || 'Could not launch secure payment window.');
      setIsLoading(false);
    }
  };

  return (
    <div id="buy-data" className="w-full max-w-2xl mx-auto scroll-mt-24 relative">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 md:p-10 border border-slate-100">
        
        {/* Service Type Tab Bar */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 border border-slate-200/50 max-w-lg mx-auto">
          {[
            { id: 'DATA', label: 'Data', icon: '📱', disabled: settings?.data_active === false },
            { id: 'AIRTIME', label: 'Airtime', icon: '📞', disabled: settings?.airtime_active === false },
            { id: 'WASSCE', label: 'WASSCE', icon: '🎓', disabled: settings?.wassce_active === false },
            { id: 'BECE', label: 'BECE', icon: '📝', disabled: settings?.bece_active === false },
          ].filter(srv => !srv.disabled).map((srv) => (
            <button
              key={srv.id}
              onClick={() => {
                setActiveService(srv.id as any);
                setBundle('');
                if (srv.id === 'WASSCE' || srv.id === 'BECE') {
                  setNetwork('WAEC');
                } else if (network === 'WAEC') {
                  setNetwork(''); // Reset WAEC to let user configure carrier network
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeService === srv.id
                  ? 'bg-white text-indigo-700 shadow-md ring-1 ring-slate-200/50 scale-[1.02]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>{srv.icon}</span>
              <span className="inline">{srv.label}</span>
            </button>
          ))}
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl text-center">
            {activeService === 'DATA' ? 'Buy Data in 3 Steps' :
             activeService === 'AIRTIME' ? 'Buy Airtime in 3 Steps' :
             activeService === 'WASSCE' ? 'WASSCE Voucher in 3 Steps' :
             'BECE Voucher in 3 Steps'}
          </h2>
          
          {/* 🚀 STEP 9 — IMPLEMENT PURCHASE SAFETY GATING UI */}
          {['outage', 'unreachable'].includes(providerStatus) && (
            <div className="mt-6 mx-auto animate-pulse flex items-center gap-3 p-4 bg-rose-50 text-rose-700 border-2 border-rose-100 rounded-2xl text-left">
              <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Service Disruption Detected</p>
                <p className="text-[11px] font-bold leading-tight opacity-80">Data provider currently unreachable or experiencing issues. Purchases temporarily paused to protect your funds.</p>
              </div>
            </div>
          )}

          {!supabaseReady && providerStatus !== 'outage' && (
            <div className="mt-4 mx-auto inline-flex items-center gap-2 px-3 py-1 text-xs font-medium text-amber-800 bg-amber-50 rounded-full border border-amber-200">
              <AlertCircle size={14} />
              Preview Mode (Demo Transactions)
            </div>
          )}
        </div>

        <div className="space-y-12">
          {/* STEP 1: NETWORK / PROVIDER */}
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${network ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white'}`}>
                {network ? <CheckCircle2 size={18} /> : '1'}
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {activeService === 'WASSCE' || activeService === 'BECE' ? 'Service Provider' : 'Select Network'}
              </h3>
            </div>
            
            {(activeService === 'WASSCE' || activeService === 'BECE') ? (
              <div className="grid grid-cols-1 gap-4 pl-0 sm:pl-12">
                <div className="p-6 rounded-2xl border-2 border-indigo-600 bg-indigo-50/20 ring-4 ring-indigo-600/5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white text-indigo-600 flex items-center justify-center font-bold text-2xl shadow-sm border border-slate-100 shrink-0">
                    {activeService === 'WASSCE' ? '🎓' : '📝'}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-indigo-950 uppercase tracking-wide">WAEC Certified Official Provider</h4>
                    <p className="text-xs text-indigo-700 font-semibold leading-relaxed">Official national checker card PINs and codes generated securely in real-time.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 ${activeService === 'AIRTIME' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-4 pl-0 sm:pl-12`}>
                {networksToRender.map((net) => (
                  <button
                    key={net.id}
                    onClick={() => { setNetwork(net.id); setBundle(''); }}
                    className={`relative overflow-hidden p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${
                      network === net.id 
                        ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-600/10' 
                        : 'border-slate-100 hover:border-slate-300 shadow-sm hover:shadow-md bg-white'
                    }`}
                  >
                    {/* Radio Button Indicator */}
                    <div className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      network === net.id
                        ? 'border-indigo-600 bg-indigo-600'
                        : 'border-slate-300 bg-white'
                    }`}>
                      <div className={`w-2 h-2 rounded-full bg-white transition-transform duration-200 ${
                        network === net.id ? 'scale-100' : 'scale-0'
                      }`} />
                    </div>

                    <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 overflow-hidden bg-slate-100">
                       <img 
                         src={net.logoUrl} 
                         alt={net.label} 
                         className="w-full h-full object-cover" 
                       />
                    </div>
                    <span className="font-semibold text-slate-800 text-sm text-center">{net.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* STEP 2: BUNDLE / PLAN */}
          <div className={`relative transition-opacity duration-300 ${!network ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
             <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${bundle ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                  {bundle ? <CheckCircle2 size={18} /> : '2'}
                </div>
                <h3 className="text-xl font-bold text-slate-900">
                  {activeService === 'DATA' ? 'Choose Bundle' :
                   activeService === 'AIRTIME' ? 'Select Airtime Value' :
                   'Choose Quantity'}
                </h3>
              </div>
            </div>
            
            <div className="pl-0 sm:pl-12">
              {isLoadingBundles ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    <span className="text-sm font-black uppercase tracking-tighter text-slate-600">Checking Available Plans</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">Please wait a moment...</span>
                </div>
              ) : loadError ? (
                <div className="p-4 bg-red-50 text-red-700 border-2 border-red-100 rounded-2xl flex flex-col items-center text-center">
                  <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                  <p className="font-semibold mb-1">Failed to load bundles</p>
                  <p className="text-sm opacity-80 mb-3">{loadError}</p>
                  <button onClick={() => fetchBundles()} className="text-xs font-bold uppercase tracking-wider bg-red-100 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors">
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="bundle-select"
                    value={bundle}
                    onChange={(e) => setBundle(e.target.value)}
                    className="block w-full appearance-none rounded-2xl border-2 py-4 px-5 pr-12 text-slate-900 font-black text-xl outline-none transition-all cursor-pointer bg-white border-slate-100 hover:border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 shadow-sm"
                  >
                    <option value="" disabled>
                      {activeService === 'DATA' ? 'Select a data bundle' :
                       activeService === 'AIRTIME' ? 'Select an airtime value' :
                       'Select quantity / package'}
                    </option>
                    {activeServiceOptions.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {activeService === 'DATA' ? `${b.volume} Data Package - ${currency} ${b.price.toFixed(2)}` :
                         activeService === 'AIRTIME' ? `${b.name} Airtime - ${currency} ${b.price.toFixed(2)}` :
                         `${b.name} - ${currency} ${b.price.toFixed(2)}`}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5">
                    <ChevronDown className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
              )}
              {network && !isLoadingBundles && !loadError && activeServiceOptions.length === 0 && (
                <div className="mt-4 p-6 text-slate-400 text-center border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
                  <AlertCircle size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-bold">NO PACKAGES FOUND</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">
                    There are no {activeService} packages configured in the database {network !== 'WAEC' && `for ${findNetworkConfig(network)?.label}`}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: PHONE & PAY */}
          <div className={`relative transition-opacity duration-300 ${!bundle ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold bg-slate-200 text-slate-600">
                3
              </div>
              <h3 className="text-xl font-bold text-slate-900">Payment Details</h3>
            </div>

            <div className="pl-0 sm:pl-12">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label htmlFor="payer_phone" className="block text-sm font-semibold leading-6 text-slate-900 mb-2">
                      Payer Phone Number (Wallet)
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="tel"
                        name="payer_phone"
                        id="payer_phone"
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="block w-full rounded-xl border-0 py-4 px-5 text-slate-900 font-medium text-lg ring-1 ring-inset ring-slate-300 focus:ring-indigo-600 placeholder:text-slate-400 focus:ring-2 focus:ring-inset"
                        placeholder="e.g. 0244112233"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-semibold leading-6 text-slate-900 mb-2">
                      {activeService === 'DATA' ? 'Recipient Phone Number' : activeService === 'AIRTIME' ? 'Recipient Mobile Phone Number' : 'Recipient Phone Number (PIN Delivery via SMS)'}
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className={`block w-full rounded-xl border-0 py-4 px-5 text-slate-900 font-medium text-lg ring-1 ring-inset ${error ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-indigo-600'} placeholder:text-slate-400 focus:ring-2 focus:ring-inset`}
                        placeholder={activeService === 'DATA' || activeService === 'AIRTIME' ? 'e.g. 0244123456' : 'e.g. 0244123456 (for SMS PIN delivery)'}
                      />
                    </div>
                  </div>
                </div>
                {error && <p className="mb-4 text-sm text-red-600 font-medium">{error}</p>}

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-slate-600 font-medium text-lg">Total Amount</span>
                    <span className="font-extrabold text-3xl text-indigo-600">
                      ₵{selectedBundleObj?.price.toFixed(2) || '0.00'}
                    </span>
                  </div>

                  <button
                    onClick={handlePayment}
                    disabled={isLoading || phone.length < 10 || ['outage', 'unreachable'].includes(providerStatus)}
                    className="w-full relative flex flex-col items-center justify-center rounded-2xl bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <div className="flex items-center">
                      {isLoading ? (
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                      ) : ['outage', 'unreachable'].includes(providerStatus) ? (
                        <XCircle className="-ml-1 mr-2 h-5 w-5 text-rose-400" />
                      ) : (
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z" fill="currentColor" fillOpacity="0.3"/>
                          <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8ZM12 14C10.9 14 10 13.1 10 12C10 10.9 10.9 10 12 10C13.1 10 14 10.9 14 12C14 13.1 13.1 14 12 14Z" fill="currentColor"/>
                        </svg>
                      )}
                      {isLoading ? 'Processing Payment...' : providerStatus === 'outage' ? 'Purchases Paused' : `Pay securely with Paystack`}
                    </div>
                  </button>
                  <p className="text-center text-[11px] sm:text-xs font-bold text-slate-600 mt-3 animate-pulse">
                     If payment delays, dial *170#, option 6, option 3 (Approvals)
                  </p>
                  <p className="text-center text-sm font-medium text-slate-500 mt-4 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={16} className="text-green-600" /> Guaranteed safe & secure checkout
                  </p>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
