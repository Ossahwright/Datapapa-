import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaystackPayment } from 'react-paystack';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, ChevronDown, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { openWhatsApp } from '../lib/whatsapp';

import { NETWORK_CONFIG, NETWORKS, findNetworkConfig } from '../lib/networkConfig';
import { BUNDLE_CONFIG, findNormalizedBundle } from '../lib/bundleConfig';

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

  const [currentTxId, setCurrentTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentTxId) return;

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
          console.log("🔄 REALTIME UPDATE:", payload);
          const updated = payload.new;
          if (updated.id === currentTxId) {
            if (updated.delivery_status === "delivered" || updated.vtu_status === "delivered") {
              setDeliveryStatus("delivered");
            }
            if (updated.vtu_status === "provider_accepted" || updated.vtu_status === "awaiting_provider_confirmation") {
              setDeliveryStatus("processing");
            }
            if (updated.delivery_status === "failed" || updated.vtu_status === "provider_rejected") {
              setDeliveryStatus("failed");
              alert("❌ Data delivery failed. Please contact support if you were debited.");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTxId]);

  const [paystackRef, setPaystackRef] = useState<string>(`tx_${new Date().getTime()}`);

  const handlePaymentSuccess = async (paystackResponse: any) => {
    console.log("💰 PAYMENT SUCCESS CALLBACK", paystackResponse);
    setPaymentStatus("success");
    setSuccess(true); 
    setIsLoading(false);
    setCountdown(10);
    
    try {
      const currentPaystackRef = paystackResponse.reference;
      setTransactionId(currentPaystackRef);
      console.log("✅ Payment successful. Awaiting webhook fulfillment...");
    } catch (err: any) {
      console.error("Payment post-processing error:", err);
    }
  };

  // Countdown timer effect
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

  const handlePaymentClose = () => {
    console.log("🔒 PAYSTACK WINDOW CLOSED");
    setIsLoading(false);
    setCurrentTxId(null);
  };

  const handlePayment = async () => {
    // 🚀 STEP 1: PAYMENT-LAYER PRE-FLIGHT VALIDATION (MINIMAL)
    if (!phone || phone.length < 10) {
      console.error("=== PAYMENT INITIALIZATION BLOCKED ===");
      console.error("Reason: Invalid Recipient Phone", { phone });
      setError('Please enter a valid recipient phone number');
      return;
    }

    if (!selectedBundleObj) {
      console.error("=== PAYMENT INITIALIZATION BLOCKED ===");
      console.error("Reason: No bundle selected");
      setError('Please select a data bundle package');
      return;
    }

    const amount = selectedBundleObj.price;
    if (!amount || amount <= 0) {
      console.error("=== PAYMENT INITIALIZATION BLOCKED ===");
      console.error("Reason: Invalid Amount", { amount });
      setError('Invalid bundle price. Please try another bundle.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      console.log("=== PAYMENT-LAYER DECOUPLING ACTIVATED ===");
      console.log("=== PAYSTACK INITIALIZATION START ===");

      // Create a stable reference for the entire session
      const clientRef = `tx_${new Date().getTime()}_${Math.random().toString(36).substring(7)}`;
      setPaystackRef(clientRef);

      const { data: { user } } = await supabase.auth.getUser();

      // 🚀 STEP 2: ASSEMBLE TELECOM PAYLOAD (STRICTLY NON-BLOCKING FOR PAYMENT)
      console.log("=== TELECOM ROUTING ISOLATION FLOW ===");
      
      const netConfig = findNetworkConfig(network);
      
      const payload: any = {
        user_id: user?.id || null,
        amount: amount,
        recipient_phone: phone,
        payer_phone_number: payerPhone || phone,
        paystack_reference: clientRef,
        created_at: new Date().toISOString(),
        metadata: {
          browser: navigator.userAgent,
          platform: 'web_v2_resilient'
        }
      };

      // Best-effort telecom metadata enrichment
      if (netConfig) {
        payload.display_network = netConfig.label;
        payload.internal_network_id = netConfig.id;
        payload.network = netConfig.id;
      }

      if (selectedBundleObj) {
        payload.display_bundle = selectedBundleObj.volume;
        payload.internal_bundle_id = selectedBundleObj.id;
        payload.provider_network_key = selectedBundleObj.provider_network_key;
        payload.provider_capacity = selectedBundleObj.provider_capacity;
        
        const costPrice = parseFloat(selectedBundleObj.original?.cost_price || '0') || 0;
        payload.profit = Math.max(0, amount - costPrice);

        // Registry Fallbacks
        payload.network_key = selectedBundleObj.provider_network_key || netConfig?.networkKey;
        payload.datahub_network_key = payload.network_key;
        payload.datahub_capacity = selectedBundleObj.provider_capacity;
        payload.capacity = selectedBundleObj.provider_capacity;
      }

      console.log("=== FINALIZED SERVER PAYLOAD ===");
      console.log(payload);

      // 🚀 STEP 3: INITIATE TRANSACTION STORAGE (RESILIENT RETRY)
      let storageSuccess = false;
      let tx = null;
      let attempts = 0;
      
      while (!storageSuccess && attempts < 2) {
        try {
          const response = await fetch("/api/initiate-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const initResult = await response.json();
          if (response.ok && initResult.success) {
            tx = initResult.transaction;
            storageSuccess = true;
          } else {
            attempts++;
            if (attempts >= 2) throw new Error(initResult.error || "Failed to record transaction intent.");
            console.warn("Retrying transaction storage...");
          }
        } catch (e) {
          attempts++;
          if (attempts >= 2) throw e;
        }
      }

      if (!tx) throw new Error("Could not initialize transaction reference.");
      
      console.log("✅ Intent recorded. Transaction ID:", tx.id);

      // 🚀 STEP 4: TRIGGER PAYMENT POPUP
      console.log("=== PAYSTACK POPUP REQUESTED ===");
      setCurrentTxId(tx.id);
      
    } catch (err: any) {
      console.error("=== PAYMENT FLOW FAILURE ===");
      console.error(err);
      setError(err.message || 'Transaction initialization failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (success) {
    const netConfig = findNetworkConfig(network);
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-8 border border-slate-100 max-w-lg mx-auto w-full relative overflow-hidden my-auto"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-400 to-emerald-500" />
          
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </motion.div>
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">TRANSACTION SUCCESS</h2>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-[0.2em]">Official Receipt • {appName}</p>
            
            {/* Main Receipt Content */}
            <div className="w-full mt-8 bg-slate-50 rounded-3xl p-6 border border-slate-200/60 relative">
              {/* Cut-out circles for receipt look */}
              <div className="absolute top-1/2 -left-3 w-6 h-6 bg-white rounded-full border border-slate-200/60 -translate-y-1/2" />
              <div className="absolute top-1/2 -right-3 w-6 h-6 bg-white rounded-full border border-slate-200/60 -translate-y-1/2" />
              
              <div className="space-y-4 font-mono text-xs text-slate-600 uppercase">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex justify-between items-center"
                >
                  <span>Delivery</span>
                  {deliveryStatus === 'delivered' ? (
                    <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-black text-[10px]">DELIVERED</span>
                  ) : deliveryStatus === 'failed' ? (
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-black text-[10px]">FAILED</span>
                  ) : (
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black text-[10px] animate-pulse">PROCESSING</span>
                  )}
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex justify-between"
                >
                  <span>Date & Time</span>
                  <span className="text-slate-900 font-bold">{new Date().toLocaleString()}</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex justify-between"
                >
                  <span>Network</span>
                  <span className="text-slate-900 font-bold">{netConfig?.label}</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex justify-between"
                >
                  <span>Bundle</span>
                  <span className="text-slate-900 font-bold truncate max-w-[150px] text-right">{selectedBundleObj?.volume}</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex justify-between"
                >
                  <span>Recipient</span>
                  <span className="text-slate-900 font-bold text-sm tracking-tighter">{phone}</span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex justify-between"
                >
                  <span>Payer</span>
                  <span className="text-slate-900 font-bold">{payerPhone || phone}</span>
                </motion.div>
                
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 }}
                  className="pt-4 border-t border-dashed border-slate-300"
                >
                  <div className="flex justify-between items-center text-base">
                    <span className="font-bold text-slate-400">Amount Paid</span>
                    <span className="text-indigo-600 font-black text-xl">GHS {selectedBundleObj?.price.toFixed(2)}</span>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center gap-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Reference</div>
              <div className="text-[10px] font-mono text-slate-400 break-all text-center px-4 bg-slate-50 py-2 rounded-lg border border-slate-100">{transactionId}</div>
            </div>

            <div className="mt-8 flex flex-col items-center w-full gap-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                Refreshing in <span className="text-indigo-600 font-bold tabular-nums">{countdown}s</span>...
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => {
                    window.location.reload();
                  }}
                  className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                >
                  Continue Now
                </button>
                <button
                  onClick={() => openWhatsApp({ phone: adminWhatsApp, message: `Hi, I'm checking on my data purchase for ${phone} (Ref: ${transactionId})` })}
                  className="px-6 py-4 bg-white text-slate-900 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Support
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div id="buy-data" className="w-full max-w-2xl mx-auto scroll-mt-24 relative">
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 sm:p-8 md:p-10 border border-slate-100">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Buy Data in 3 Steps
          </h2>
          {!supabaseReady && (
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
                    disabled={isLoading || phone.length < 10}
                    className="w-full relative flex flex-col items-center justify-center rounded-2xl bg-slate-900 px-8 py-4 text-base font-bold text-white shadow-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <div className="flex items-center">
                      {isLoading ? (
                        <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
                      ) : (
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 15.31 15.31 18 12 18Z" fill="currentColor" fillOpacity="0.3"/>
                          <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8ZM12 14C10.9 14 10 13.1 10 12C10 10.9 10.9 10 12 10C13.1 10 14 10.9 14 12C14 13.1 13.1 14 12 14Z" fill="currentColor"/>
                        </svg>
                      )}
                      {isLoading ? 'Processing Payment...' : `Pay securely with Paystack`}
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

      {/* 🚀 ROBUST PAYSTACK TRIGGER */}
      {currentTxId && selectedBundleObj && (
        <PaystackTrigger
          transactionId={currentTxId}
          amount={Math.round(selectedBundleObj.price * 100)}
          reference={paystackRef}
          phone={phone}
          network={network}
          bundleVolume={selectedBundleObj.volume}
          onSuccess={handlePaymentSuccess}
          onClose={handlePaymentClose}
        />
      )}
    </div>
  );
}

/**
 * 🎯 ROBUST PAYSTACK INITIALIZER COMPONENT
 * Ensures hook is called with absolutely fresh props and clean lifecycle.
 */
function PaystackTrigger({ 
  transactionId, 
  amount, 
  reference, 
  phone, 
  network, 
  bundleVolume, 
  onSuccess, 
  onClose 
}: any) {
  // 🚀 HARDENED PAYSTACK CONFIGURATION
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_live_8d8dd295e02fd6a55f8461a33055f5d0a94b4541";
  
  const config = {
    reference,
    email: 'customer@datapapa.com',
    amount, // In pesewas
    publicKey,
    currency: 'GHS' as const,
    channels: ['card', 'mobile_money'],
    metadata: {
      transaction_id: transactionId,
      phone: phone,
      network: network,
      bundle: bundleVolume,
      platform: 'datapapa_v2',
      custom_fields: [
        { display_name: "Phone Number", variable_name: "phone", value: phone },
        { display_name: "Network", variable_name: "network", value: network },
        { display_name: "Bundle", variable_name: "bundle", value: bundleVolume }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  useEffect(() => {
    console.log("=== PAYSTACK INITIALIZATION START ===");
    console.log("🏗️ Resilient PaystackTrigger mounted.", { 
      amount, 
      ref: reference,
      tx: transactionId,
      keyUsed: publicKey.substring(0, 7) + "..."
    });
    
    // Safety check for amount
    if (amount > 0) {
      try {
        // @ts-ignore
        initializePayment(onSuccess, onClose);
        console.log("=== PAYSTACK POPUP TRIGGERED SUCCESSFULLY ===");
      } catch (err) {
        console.error("❌ Critical Paystack Hook Failure:", err);
        onClose();
      }
    } else {
      console.error("❌ Aborting Payment: ZERO amount detected");
      onClose();
    }
  }, [transactionId]); // Only trigger when transactionId changes

  return null;
}
