import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaystackPayment } from 'react-paystack';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, ChevronDown, RefreshCw } from 'lucide-react';
import axios from 'axios';

const NETWORKS = [
  { id: 'mtn', name: 'MTN', color: 'bg-yellow-500', text: 'text-yellow-950', logo: 'https://i.postimg.cc/BvS8nyGS/download.jpg' },
  { id: 'telecel', name: 'Telecel', color: 'bg-red-600', text: 'text-white', logo: 'https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg' },
  { id: 'airteltigo', name: 'AirtelTigo', color: 'bg-red-500', text: 'text-white', logo: 'https://i.postimg.cc/sfqT8kkW/images.jpg' },
];

interface BuyDataFormProps {
  settings: {
    app_name: string;
    currency: string;
    support_email: string;
    maintenance_mode: boolean;
    sms_enabled: boolean;
    sms_sender_id: string;
    sms_template_success: string;
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

  const [supabaseReady] = useState(isSupabaseConfigured);
  
  const appName = settings?.app_name || "Datapapa";
  const currency = settings?.currency || "GHS";
  const supportEmail = settings?.support_email || "support@datapapa.com";

  const fetchBundles = async () => {
    if (supabaseReady) {
      setIsLoadingBundles(true);
      setLoadError('');
      try {
        const { data, error } = await supabase.from('bundles').select('*').order('capacity', { ascending: true });
        if (error) {
          console.error("Supabase error fetching bundles:", error.message);
          setLoadError(error.message);
        } else if (data) {
          setDbBundles(data);
        }
      } catch (err: any) {
        console.error("Failed to fetch bundles:", err);
        let msg = err.message || 'Unknown error occurred';
        if (msg.includes('Failed to fetch')) {
          msg = "Connectivity issue: Could not reach the data server. Please check your internet or try again later.";
        }
        setLoadError(msg);
      } finally {
        setIsLoadingBundles(false);
      }
    } else {
      setIsLoadingBundles(false);
    }
  };

  useEffect(() => {
    fetchBundles();

    let channel: any;
    if (supabaseReady) {
      channel = supabase
        .channel('public:bundles:live:buy')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bundles' },
          (payload) => {
            console.log("Bundles realtime update:", payload);
            fetchBundles();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabaseReady]);

  const allBundles = dbBundles
    .filter(b => b.is_active === true || b.is_active === null || b.is_active === undefined) // More explicit active check
    .reduce((acc: any, b: any) => {
      let net = (b.network || b.network_key || '').toLowerCase();
      // Expanded normalization for DataHubGH keys
      if (net === 'at' || net === 'airteltigo' || net === 'at_bigtime' || net === 'at_premium') net = 'airteltigo';
      if (net === 'vodafone' || net === 'telecel') net = 'telecel';
      if (net === 'mtn' || net === 'yello') net = 'mtn';

      if (!acc[net]) acc[net] = [];
      
      const sellingPrice = parseFloat(b.selling_price);
      const fallbackPrice = parseFloat(b.price || 0);
      
      acc[net].push({ 
        id: b.id, 
        name: b.description || '', 
        price: isNaN(sellingPrice) ? fallbackPrice : sellingPrice, 
        volume: b.capacity || b.volume || '',
        original: b 
      });
      return acc;
    }, {});

  const currentBundles = network ? (allBundles[network] || []) : [];
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
            if (updated.vtu_status === "success") {
              alert("✅ Data delivered successfully");
            }

            if (updated.vtu_status === "failed") {
              alert("❌ Delivery failed");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTxId]);

  const paystackConfig = useMemo(() => ({
    reference: `tx_${new Date().getTime().toString()}`,
    email: 'customer@datapapa.com',
    amount: selectedBundleObj ? Math.round(selectedBundleObj.price * 100) : 0, 
    publicKey: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_dummy",
    currency: 'GHS' as const,
    // @ts-ignore
    metadata: {
      transaction_id: currentTxId,
      phone: phone,
      network: network,
      bundle: selectedBundleObj?.volume,
      custom_fields: [
        { display_name: "Phone Number", variable_name: "phone", value: phone },
        { display_name: "Network", variable_name: "network", value: network }
      ]
    }
  }), [currentTxId, phone, network, selectedBundleObj]);

  const initializePayment = usePaystackPayment(paystackConfig);

  const handlePaymentSuccess = async (paystackResponse: any) => {
    console.log("Payment successful:", paystackResponse.reference);
    setIsLoading(true);
    setPaymentStatus("success");
    
    try {
      const currentPayerPhone = paystackResponse?.customer?.phone || paystackResponse?.phone || 'N/A';
      setPayerPhone(currentPayerPhone);
      setTransactionId(paystackResponse.reference);
      setSuccess(true);

      // Trigger VTU immediately as fallback/direct trigger
      if (currentTxId) {
        console.log("🚀 DATAHUB FUNCTION TRIGGERED VIA AXIOS");
        axios.post("/api/trigger-vtu", { transactionId: currentTxId })
          .catch(err => console.error("Frontend VTU trigger error:", err));
      }

      const onSuccess = () => {
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      };
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Payment processing failed. Please contact support.');
      setPaymentStatus("idle");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentClose = () => {
    setIsLoading(false);
    setCurrentTxId(null);
  };

  useEffect(() => {
    if (currentTxId) {
      // @ts-ignore
      initializePayment(handlePaymentSuccess, handlePaymentClose);
    }
  }, [currentTxId]);

  const handlePayment = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      // 1. Save transaction FIRST as requested
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error: txError } = await supabase
        .from("transactions")
        .insert({
          user_id: userData?.user?.id || null,
          amount: selectedBundleObj?.price || 0,
          network: network,
          recipient_phone: phone,
          status: "pending",
          capacity: selectedBundleObj ? (selectedBundleObj.volume || selectedBundleObj.capacity) : undefined,
          network_key: selectedBundleObj?.original?.network_key || network,
          datahub_network_key: selectedBundleObj?.original?.datahub_network_key || selectedBundleObj?.original?.network_key,
          datahub_capacity: selectedBundleObj?.original?.datahub_capacity || (selectedBundleObj?.volume || selectedBundleObj?.capacity || '').toUpperCase().replace("GB", "").trim()
        })
        .select()
        .single();

      if (txError) throw txError;
      
      console.log("Transaction created in Supabase:", data);

      // 2. Now trigger Paystack via state update that fires useEffect
      setCurrentTxId(data.id);
    } catch (err: any) {
      console.error("Initialization error:", err);
      setError(err.message || 'Failed to initiate transaction. Please try again.');
      setIsLoading(false);
    }
  };

  if (success) {
    const selectedNetwork = NETWORKS.find(n => n.id === network);
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl shadow-slate-200/60 p-8 md:p-12 border border-slate-100 text-center max-w-2xl mx-auto w-full relative overflow-hidden"
      >
        {/* Success Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-2 bg-green-500" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-50 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-50 rounded-full blur-3xl opacity-60" />

        <div className="relative z-10">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 mb-8 border-8 border-green-50">
            <CheckCircle2 className="h-12 w-12 text-green-600" aria-hidden="true" />
          </div>
          
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Payment Successful!</h2>
          <p className="mt-4 text-xl text-slate-600 max-w-md mx-auto">
            Your {selectedBundleObj?.volume} {selectedNetwork?.name} data is being processed and will be delivered to:
          </p>
          <div className="mt-3 inline-block bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
            <span className="text-2xl font-bold text-indigo-700">{phone}</span>
          </div>
          
          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-5 text-left border border-slate-200 shadow-sm transition-hover hover:border-slate-300">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Order Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Network</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${selectedNetwork?.color}`} />
                    <span className="text-sm font-bold text-slate-900">{selectedNetwork?.name}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Data Bundle</span>
                  <span className="text-sm font-bold text-slate-900">{selectedBundleObj?.volume}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Amount Paid</span>
                  <span className="text-sm font-extrabold text-indigo-600">₵{selectedBundleObj?.price.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 text-left border border-slate-200 shadow-sm transition-hover hover:border-slate-300">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Reference Info</h3>
              <div className="space-y-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Transaction ID</span>
                  <span className="text-sm font-mono text-slate-700 break-all">{transactionId}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Payer Phone</span>
                  <span className="text-sm font-semibold text-slate-900">{payerPhone}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Delivery Status</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                    <Loader2 className="h-3 w-3 animate-spin" /> Processing
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-sm font-medium flex items-center gap-3 justify-center">
            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
            <span>It may take 1-5 minutes for data to arrive. Please contact support if it delays longer.</span>
          </div>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => {
                setSuccess(false);
                setNetwork('');
                setBundle('');
                setPhone('');
                setTransactionId('');
              }}
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-10 py-4 text-base font-bold text-white shadow-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              Buy Another Bundle
            </button>
            <button
              onClick={() => window.open(`https://wa.me/233244014207?text=${encodeURIComponent(`Hi, I'm checking on my data purchase for ${phone} (Ref: ${transactionId})`)}`, '_blank')}
              className="inline-flex items-center justify-center rounded-2xl bg-white px-10 py-4 text-base font-bold text-slate-900 border-2 border-slate-200 hover:border-slate-400 transition-all active:scale-95"
            >
              Contact Support
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div id="buy-data" className="w-full max-w-2xl mx-auto scroll-mt-24 relative">
      <AnimatePresence>
        {paymentStatus === "success" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-sm w-full border border-slate-100"
            >
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful</h2>
              <p className="text-slate-500 font-medium animate-pulse">Refreshing app...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-0 sm:pl-12">
              {NETWORKS.map((net) => (
                <button
                  key={net.id}
                  onClick={() => { setNetwork(net.id); setBundle(''); }}
                  className={`relative overflow-hidden p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                    network === net.id 
                      ? 'border-indigo-600 bg-indigo-50/30 ring-4 ring-indigo-600/10' 
                      : 'border-slate-100 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center font-bold shadow-sm shrink-0 overflow-hidden ${net.color} ${net.text}`}>
                    {net.logo ? (
                      <img src={net.logo} alt={net.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">{net.name[0]}</span>
                    )}
                  </div>
                  <span className="font-semibold text-slate-800 text-base">{net.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* STEP 2: BUNDLE */}
          <div className={`relative transition-opacity duration-300 ${!network ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
             <div className="flex items-center gap-4 mb-6">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${bundle ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                {bundle ? <CheckCircle2 size={18} /> : '2'}
              </div>
              <h3 className="text-xl font-bold text-slate-900">Choose Bundle</h3>
            </div>
            
            <div className="pl-0 sm:pl-12">
              {isLoadingBundles ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-500 bg-slate-50 rounded-2xl border-2 border-slate-100">
                  <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mb-2" />
                  <span className="text-sm font-medium">Loading packages from database...</span>
                </div>
              ) : loadError ? (
                <div className="p-4 bg-red-50 text-red-700 border-2 border-red-100 rounded-2xl flex flex-col items-center text-center">
                  <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
                  <p className="font-semibold mb-1">Failed to load bundles</p>
                  <p className="text-sm opacity-80 mb-3">{loadError}</p>
                  <button onClick={fetchBundles} className="text-xs font-bold uppercase tracking-wider bg-red-100 px-3 py-1.5 rounded-lg hover:bg-red-200 transition-colors">
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="relative rounded-2xl shadow-sm">
                  <select
                    id="bundle-select"
                    value={bundle}
                    onChange={(e) => setBundle(e.target.value)}
                    className="block w-full appearance-none rounded-2xl border-2 py-4 px-5 pr-12 text-slate-900 font-medium text-lg outline-none transition-all cursor-pointer bg-white border-slate-100 hover:border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                  >
                    <option value="" disabled>Select a data bundle</option>
                    {currentBundles.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.volume} - {b.name} (₵{b.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-5">
                    <ChevronDown className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                </div>
              )}
              {network && !isLoadingBundles && !loadError && currentBundles.length === 0 && (
                <div className="mt-4 p-4 text-slate-500 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  No bundles available for this network in the database.
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
               <div className="mb-6">
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
                  {error && <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>}
                </div>

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
    </div>
  );
}
