import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaystackPayment } from 'react-paystack';
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
  } | null;
}

export default function BuyDataForm({ settings }: BuyDataFormProps) {
  const [network, setNetwork] = useState('');
  const [bundle, setBundle] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [dbBundles, setDbBundles] = useState<any[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success'>('idle');
  const [deliveryStatus, setDeliveryStatus] = useState<'idle' | 'processing' | 'delivered' | 'failed'>('idle');
  const [countdown, setCountdown] = useState(0);
  const [providerStatus, setProviderStatus] = useState<'operational' | 'degraded' | 'outage' | 'checking'>('checking');

  const [supabaseReady] = useState(isSupabaseConfigured);
  
  const adminWhatsApp = "233244014207"; // Admin's native WhatsApp

  const appName = settings?.app_name || "Datapapa";
  const currency = settings?.currency || "GHS";
  const supportEmail = settings?.support_email || "support@datapapa.com";

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
          setDbBundles(data);
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
    };
  }, [supabaseReady]);

  const allBundles = useMemo(() => {
    return dbBundles
      .filter(b => b.is_active === true)
      .reduce((acc: any, b: any) => {
        const dbNetKey = (b.network || b.network_key || '').toUpperCase();
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

  const currentBundles = network 
    ? [...(allBundles[network] || [])].sort((a: any, b: any) => a.price - b.price) 
    : [];
  const selectedBundleObj = currentBundles.find((b: any) => String(b.id) === String(bundle));

  useEffect(() => {
    if (!transactionId) return;

    let pollingInterval: NodeJS.Timeout;
    
    const fetchLatestTransactionState = async () => {
      try {
        const { data: updated } = await supabase
          .from("transactions")
          .select("delivery_status, vtu_status")
          .or(`internal_reference.eq."${transactionId}",id.eq."${transactionId}"`)
          .maybeSingle();

        if (updated) {
          if (updated.delivery_status === VTU_STATUSES.DELIVERED || 
              updated.vtu_status === VTU_STATUSES.DELIVERED || 
              updated.vtu_status === VTU_STATUSES.SUCCESS) {
            setDeliveryStatus("delivered");
            clearInterval(pollingInterval);
          } else if (updated.vtu_status === VTU_STATUSES.PROVIDER_ACCEPTED || 
                     updated.vtu_status === "awaiting_provider_confirmation") {
            setDeliveryStatus("processing");
          } else if (updated.delivery_status === VTU_STATUSES.FAILED || 
                     updated.vtu_status === VTU_STATUSES.PROVIDER_REJECTED || 
                     updated.vtu_status === VTU_STATUSES.FAILED) {
            setDeliveryStatus("failed");
            clearInterval(pollingInterval);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    // Step 6: 🚀 Post-Payment Active Polling
    // Bridges webhook latency, realtime propagation timing, and provider execution startup
    pollingInterval = setInterval(fetchLatestTransactionState, 3000);

    // Initial fetch just to be safe
    fetchLatestTransactionState();

    const channel = supabase
      .channel("transactions-status")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          console.log("🔄 REALTIME UPDATE VISIBLE:", payload);
          const updated = payload.new;
          if (updated.internal_reference === transactionId || updated.id === transactionId) {
            if (updated.delivery_status === VTU_STATUSES.DELIVERED || 
                updated.vtu_status === VTU_STATUSES.DELIVERED || 
                updated.vtu_status === VTU_STATUSES.SUCCESS) {
              setDeliveryStatus("delivered");
              clearInterval(pollingInterval);
            } else if (updated.vtu_status === VTU_STATUSES.PROVIDER_ACCEPTED || 
                       updated.vtu_status === "awaiting_provider_confirmation") {
              setDeliveryStatus("processing");
            } else if (updated.delivery_status === VTU_STATUSES.FAILED || 
                       updated.vtu_status === VTU_STATUSES.PROVIDER_REJECTED || 
                       updated.vtu_status === VTU_STATUSES.FAILED) {
              setDeliveryStatus("failed");
              clearInterval(pollingInterval);
            }
          }
        }
      )
      .subscribe();

    // Auto-stop polling after 30 seconds
    const timeout = setTimeout(() => {
      clearInterval(pollingInterval);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
      clearTimeout(timeout);
    };
  }, [transactionId]);

  const AUTHORITATIVE_PUB_KEY = "";
  const rawKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const PAYSTACK_PUB_KEY = (!rawKey || rawKey === "" || rawKey.includes("VITE_")) 
    ? AUTHORITATIVE_PUB_KEY 
    : rawKey;

  // Countdown timer effect for post-purchase UX
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && success) {
      window.location.reload();
    }
    return () => clearTimeout(timer);
  }, [countdown, success]);

  const [paystackRef, setPaystackRef] = useState<string>(`DP-${Date.now()}`);

  const paystackConfig = {
    reference: paystackRef,
    email: 'customer@datapapa.com',
    amount: Math.round((selectedBundleObj?.price || 0) * 100),
    publicKey: PAYSTACK_PUB_KEY,
    currency: 'GHS',
    channels: ['mobile_money', 'card'],
    phone: phone,
    metadata: {
      phone,
      network,
      bundle: selectedBundleObj?.volume,
      bundle_id: selectedBundleObj?.db_id || selectedBundleObj?.id,
      platform: 'datapapa_v2_sync',
      custom_fields: [
        {
          display_name: "Mobile Number",
          variable_name: "phone",
          value: phone
        },
        {
          display_name: "Network",
          variable_name: "network",
          value: network
        }
      ]
    }
  };

  // @ts-ignore
  const initializePayment = usePaystackPayment(paystackConfig);

  // Sync reference whenever selection changes to ensure unique refs per attempt
  useEffect(() => {
    if (selectedBundleObj) {
      const newRef = `DP-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      setPaystackRef(newRef);
      console.log("🆕 [Reference Generated]:", newRef);
    }
  }, [selectedBundleObj?.id, phone]);

  const handlePaymentSuccess = async (paystackResponse: any) => {
    console.log("=== PAYSTACK CALLBACK RECEIVED ===");
    console.log("💰 [Success] Reference:", paystackResponse.reference);
    
    setPaymentStatus("success");
    setSuccess(true); 
    setIsLoading(false);
    setCountdown(10);
    
    setTransactionId(paystackResponse.reference);
    console.log("✅ Payment successful. Awaiting webhook fulfillment...");
  };

  const handlePaymentClose = () => {
    console.log("🔒 PAYSTACK WINDOW CLOSED");
    setIsLoading(false);
  };

  const createPaymentIntent = async (ref: string) => {
    try {
      console.log("📝 [Async] Recording intent for ref:", ref);
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
          reference: ref // Force authoritative override
        }),
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error("❌ Intent Recording Failed:", result.error);
      } else {
        console.log("✅ Intent recorded successfully.");
      }
    } catch (err) {
      console.error("❌ Background Intent sync failed:", err);
    }
  };

  const handlePayment = () => {
    console.log("=== BUTTON CLICK DETECTED ===");
    
    // 1. VALIDATION (SYNC)
    if (!phone || phone.length < 10) {
      setError('Please enter a valid recipient phone number');
      console.error("=== PAYMENT BLOCKED: Invalid Phone ===");
      return;
    }

    if (!selectedBundleObj) {
      setError('Please select a data bundle package');
      console.error("=== PAYMENT BLOCKED: No Bundle ===");
      return;
    }

    if (!PAYSTACK_PUB_KEY || PAYSTACK_PUB_KEY.length < 5) {
      setError('Server configuration error. Please contact support.');
      console.error("=== PAYMENT BLOCKED: Missing Public Key ===");
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log("=== PAYSTACK INITIALIZATION START ===");
      console.log("📍 Amount:", paystackConfig.amount);
      console.log("📍 Ref:", paystackRef);
      console.log("📍 Key:", PAYSTACK_PUB_KEY.substring(0, 10) + "...");

      // 🚀 THE MAGIC: SYNCHRONOUS TRIGGER
      // No awaits, no fetches, no delays. Direct from user event.
      initializePayment({
        onSuccess: handlePaymentSuccess, 
        onClose: handlePaymentClose
      });
      
      console.log("=== PAYSTACK POPUP REQUESTED ===");

      // 🚀 STEP 2: BACKGROUND SYNC (FIRE AND FORGET)
      // This happens while the user sees the popup loading.
      createPaymentIntent(paystackRef);

    } catch (err: any) {
      console.error("=== PAYSTACK INIT FAILURE ===");
      console.error(err);
      setError('Could not launch payment window. Please try again.');
      setIsLoading(false);
    }
  };

  if (success) {
    const netConfig = findNetworkConfig(network);
    
    // Determine the general status for the receipt card
    let receiptStatus: TransactionStatus = 'processing';
    if (deliveryStatus === 'delivered' || deliveryStatus === 'success') receiptStatus = 'success';
    if (deliveryStatus === 'failed') receiptStatus = 'failed';

    return (
      <TransactionReceiptCard
        status={receiptStatus}
        amount={selectedBundleObj?.price || 0}
        network={netConfig?.label}
        bundle={selectedBundleObj?.volume}
        recipient={phone}
        reference={transactionId}
        appName={appName}
        onReturnHome={() => window.location.reload()}
        onRetry={() => window.location.reload()}
        onSupport={() => openWhatsApp({ phone: adminWhatsApp, message: `Hi, I'm checking on my data purchase for ${phone} (Ref: ${transactionId})` })}
      />
    );
  }

  return (
    <div id="buy-data" className="w-full max-w-2xl mx-auto scroll-mt-24 relative">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 md:p-10 border border-slate-100">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Buy Data in 3 Steps
          </h2>
          
          {/* 🚀 STEP 9 — IMPLEMENT PURCHASE SAFETY GATING UI */}
          {providerStatus === 'outage' && (
            <div className="mt-6 mx-auto animate-pulse flex items-center gap-3 p-4 bg-rose-50 text-rose-700 border-2 border-rose-100 rounded-2xl text-left">
              <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">Service Disruption Detected</p>
                <p className="text-[11px] font-bold leading-tight opacity-80">Data provider currently experiencing issues. Purchases temporarily paused to protect your funds.</p>
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
          {/* STEP 1: NETWORK */}
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${network ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white'}`}>
                {network ? <CheckCircle2 size={18} /> : '1'}
              </div>
              <h3 className="text-xl font-bold text-slate-900">Select Network</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pl-0 sm:pl-12">
              {NETWORKS.map((net) => (
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

                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 overflow-hidden ${
                    net.id === 'MTN' ? 'bg-yellow-500 text-yellow-950' : 
                    net.id === 'TELECEL' ? 'bg-red-600 text-white' : 
                    'bg-red-500 text-white'
                  }`}>
                     <img 
                       src={
                        net.id === 'MTN' ? 'https://i.postimg.cc/BvS8nyGS/download.jpg' :
                        net.id === 'TELECEL' ? 'https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg' :
                        'https://i.postimg.cc/sfqT8kkW/images.jpg'
                       } 
                       alt={net.label} 
                       className="w-full h-full object-cover" 
                     />
                  </div>
                  <span className="font-semibold text-slate-800 text-sm text-center">{net.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 2: BUNDLE */}
          <div className={`relative transition-opacity duration-300 ${!network ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
             <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${bundle ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                  {bundle ? <CheckCircle2 size={18} /> : '2'}
                </div>
                <h3 className="text-xl font-bold text-slate-900">Choose Bundle</h3>
              </div>
              {network && (
                <button 
                  onClick={() => fetchBundles()} 
                  disabled={isLoadingBundles}
                  className="text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5 hover:text-indigo-700 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBundles ? 'animate-spin' : ''}`} />
                  Sync
                </button>
              )}
            </div>
            
            <div className="pl-0 sm:pl-12">
              {isLoadingBundles ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                    <span className="text-sm font-black uppercase tracking-tighter">Live Connection Established</span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">Syncing with Supabase table...</span>
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
                    <option value="" disabled>Select a data bundle</option>
                    {currentBundles.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.volume} Data Package - {currency} {b.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5">
                    <ChevronDown className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                  
                  {currentBundles.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 px-1">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{currentBundles.length} Bundles Synced Locally</span>
                    </div>
                  )}
                </div>
              )}
              {network && !isLoadingBundles && !loadError && currentBundles.length === 0 && (
                <div className="mt-4 p-6 text-slate-400 text-center border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center">
                  <AlertCircle size={32} className="mb-2 opacity-20" />
                  <p className="text-sm font-bold">NO PACKAGES FOUND</p>
                  <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">There are no bundles for {findNetworkConfig(network)?.label} in the database.</p>
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
                      Recipient Phone Number
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <input
                        type="tel"
                        name="phone"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className={`block w-full rounded-xl border-0 py-4 px-5 text-slate-900 font-medium text-lg ring-1 ring-inset ${error ? 'ring-red-300 focus:ring-red-500' : 'ring-slate-300 focus:ring-indigo-600'} placeholder:text-slate-400 focus:ring-2 focus:ring-inset`}
                        placeholder="e.g. 0244123456"
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
                    disabled={isLoading || phone.length < 10 || providerStatus === 'outage'}
                    className="w-full relative flex flex-col items-center justify-center rounded-2xl bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <div className="flex items-center">
                      {isLoading ? (
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                      ) : providerStatus === 'outage' ? (
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
