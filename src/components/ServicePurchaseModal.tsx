import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { CheckCircle2, AlertCircle, Loader2, X, ShieldCheck, CreditCard, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NETWORKS } from '../lib/networkConfig';

interface ServicePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: 'AIRTIME' | 'BECE' | 'WASSCE';
  settings: {
    app_name: string;
    currency: string;
    support_email: string;
    maintenance_mode: boolean;
    bece_active?: boolean;
    wassce_active?: boolean;
    airtime_active?: boolean;
  } | null;
}

export default function ServicePurchaseModal({ isOpen, onClose, serviceType, settings }: ServicePurchaseModalProps) {
  const navigate = useNavigate();
  const [network, setNetwork] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [phone, setPhone] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [dbBundles, setDbBundles] = useState<any[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [supabaseReady] = useState(isSupabaseConfigured);

  const currency = settings?.currency || "GHS";

  // Fetch bundles corresponding to the exact service type
  useEffect(() => {
    if (!isOpen) return;

    const fetchServicePlans = async () => {
      setIsLoadingBundles(true);
      setError('');
      try {
        const { data, error: err } = await supabase
          .from('bundles')
          .select('*')
          .eq('is_active', true)
          .order('selling_price', { ascending: true });

        if (err) throw err;

        // Map and resolve service_type & provider dynamically to bypass missing database columns
        const mappedData = (data || []).map((b: any) => {
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
        }).filter((b: any) => b.service_type === serviceType);

        setDbBundles(mappedData);
        
        if (data && data.length > 0) {
          // Select the first bundle by default
          setSelectedBundleId(data[0].id);
          if (serviceType === 'BECE' || serviceType === 'WASSCE') {
            setNetwork('WAEC');
          } else {
            setNetwork('MTN');
          }
        }
      } catch (e: any) {
        console.error("Error fetching service bundles:", e);
        setError("Unable to sync plans with the database.");
      } finally {
        setIsLoadingBundles(false);
      }
    };

    fetchServicePlans();

    // Set up standard real-time subscription for bundles
    let channel: any;
    if (supabaseReady) {
      channel = supabase
        .channel(`service-realtime-${serviceType}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bundles' },
          () => {
            fetchServicePlans();
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [isOpen, serviceType, supabaseReady]);

  // Compute filtered plans based on current network (only for airtime)
  const filteredPlans = useMemo(() => {
    if (serviceType === 'BECE' || serviceType === 'WASSCE') {
      return dbBundles;
    }
    return dbBundles.filter(b => {
      const dbNet = String(b.network || '').toUpperCase();
      const selNet = String(network || '').toUpperCase();
      return dbNet === selNet || (selNet === 'AIRTELTIGO' && (dbNet === 'AIRTELTIGO_PREMIUM' || dbNet === 'AIRTELTIGO_BIGTIME' || dbNet === 'AIRTELTIGO' || dbNet === 'AT'));
    });
  }, [dbBundles, network, serviceType]);

  // Select automatically if filtered plans changes
  useEffect(() => {
    if (filteredPlans.length > 0) {
      const exists = filteredPlans.some(p => p.id === selectedBundleId);
      if (!exists) {
        setSelectedBundleId(filteredPlans[0].id);
      }
    } else {
      setSelectedBundleId('');
    }
  }, [filteredPlans, selectedBundleId]);

  const selectedPlanObj = useMemo(() => {
    return dbBundles.find(b => b.id === selectedBundleId);
  }, [dbBundles, selectedBundleId]);

  // Paystack trigger handler
  const handleCheckout = async () => {
    setError('');

    if (!phone || phone.length < 10) {
      setError('Please enter a valid recipient phone number');
      return;
    }

    if (!selectedBundleId || !selectedPlanObj) {
      setError('Please select a package/amount to purchase');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Initialize payment on Server
      const { data: { user } } = await supabase.auth.getUser();
      const prepResponse = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleId: selectedPlanObj.id,
          phone,
          payerPhone: payerPhone || phone,
          networkId: network,
          userId: user?.id,
          service_type: serviceType,
          amount: selectedPlanObj.selling_price
        })
      });

      const prepResult = await prepResponse.json();
      if (!prepResponse.ok) {
        throw new Error(prepResult.error || 'Failed to initialize payment.');
      }

      console.log("✅ Checkout initialization success:", prepResult.config.reference);

      // 1. 🚀 REDIRECT FLOW: Check if the server successfully generated a direct Paystack checkout URL
      if (prepResult.config.authorizationUrl) {
        try {
          console.log("=== PAYSTACK_REDIRECT_STARTED ===");
          console.log("🚀 Redirecting to standard Paystack checkout URL:", prepResult.config.authorizationUrl);
          window.location.href = prepResult.config.authorizationUrl;
          return;
        } catch (redirErr) {
          console.error("=== PAYSTACK_REDIRECT_FAILED ===");
          console.error("Failed to execute redirect:", redirErr);
          throw new Error("Could not redirect to Paystack hosted payment page. Please try again.");
        }
      }

      const AUTHORITATIVE_PUB_KEY = "";
      const rawKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      const PAYSTACK_PUB_KEY = (!rawKey || rawKey === "" || rawKey.includes("VITE_"))
        ? AUTHORITATIVE_PUB_KEY
        : rawKey;

      const activePublicKey = prepResult.config.publicKey || PAYSTACK_PUB_KEY;
      const isDummyKey = !activePublicKey || activePublicKey.trim() === "" || activePublicKey.includes("VITE_");

      // 2. 🚀 SIMULATION MODE: If we are in sandboxed preview/development with no keys, simulate payment success
      if (isDummyKey) {
        console.warn("⚠️ No live Paystack Public Key found. Launching simulation mode...");
        
        // Emulate realistic payment network transition spinner
        setTimeout(() => {
          console.log("🎯 [Simulated Checkout Success] Navigating to receipt page:", prepResult.config.reference);
          navigate(`/receipt/${prepResult.config.reference}`);
        }, 1200);
        return;
      }

      // 3. 🚀 INLINE POPUP FALLBACK: Ensure PaystackPop is loaded
      // @ts-ignore
      if (!window.PaystackPop) {
        throw new Error("Paystack secure script could not be loaded. Please check your network connection.");
      }

      const checkoutConfig = {
        reference: prepResult.config.reference,
        amount: prepResult.config.amount,
        email: prepResult.config.email,
        metadata: prepResult.config.metadata,
        key: activePublicKey,
        currency: 'GHS',
        channels: ['mobile_money', 'card'],
      };

      console.log("🚀 Launching Paystack inline gateway with reference:", checkoutConfig.reference);

      // @ts-ignore
      const handler = window.PaystackPop.setup({
        ...checkoutConfig,
        callback: (resp: any) => {
          console.log("=== PAYSTACK_CALLBACK_RECEIVED ===");
          console.log("💰 Checkout payment success:", resp.reference);
          navigate(`/receipt/${resp.reference}`);
        },
        onClose: () => {
          console.log("🔒 Checkout modal was closed by the user.");
          setIsLoading(false);
        }
      });

      handler.openIframe();
    } catch (err: any) {
      console.error("Checkout initiation failure:", err);
      setError(err.message || 'Could not launch secure Paystack gateway.');
      setIsLoading(false);
    }
  };

  const serviceTitle = serviceType === 'AIRTIME' ? 'Airtime Top-up' : `${serviceType} WAEC Voucher`;
  const iconBg = serviceType === 'AIRTIME' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center font-bold text-lg`}>
                  {serviceType === 'AIRTIME' ? '📞' : '🎓'}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Buy {serviceTitle}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Fast, secure and fully automated</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 cursor-pointer hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Form */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-2xl border-2 border-red-100">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                  <span className="text-sm font-semibold">{error}</span>
                </div>
              )}

              {/* Service Type 1: Networks Choice (only for AIRTIME) */}
              {serviceType === 'AIRTIME' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2.5">
                    Select Carrier Network
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'MTN', label: 'MTN', logoUrl: 'https://i.postimg.cc/BvS8nyGS/download.jpg' },
                      { id: 'AIRTELTIGO', label: 'AirtelTigo', logoUrl: 'https://i.postimg.cc/sfqT8kkW/images.jpg' },
                      { id: 'TELECEL', label: 'Telecel', logoUrl: 'https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg' }
                    ].map((net) => {
                      const id = net.id;
                      const selected = network === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNetwork(id)}
                          className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all group ${
                            selected
                              ? 'border-indigo-600 bg-indigo-50/20 ring-4 ring-indigo-600/5'
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-100">
                            <img
                              src={net.logoUrl}
                              alt={net.label}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <span className={`text-[11px] font-black tracking-tight ${selected ? 'text-indigo-900 font-extrabold' : 'text-slate-500'}`}>
                            {net.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vouchers Exam Body Display */}
              {(serviceType === 'BECE' || serviceType === 'WASSCE') && (
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/60 flex items-center gap-4">
                  <div className="bg-emerald-600 text-white font-bold p-2.5 rounded-xl shrink-0 text-xs">
                    WAEC
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wide">Official Exam Voucher</h4>
                    <p className="text-xs text-emerald-700 font-medium leading-relaxed">Genuine National result and index checker PINs generated in real-time.</p>
                  </div>
                </div>
              )}

              {/* Select Denomination or Package */}
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {serviceType === 'AIRTIME' ? 'Select Airtime Value' : 'Select Voucher Quantity / Plan'}
                </label>
                {isLoadingBundles ? (
                  <div className="flex items-center justify-center py-6 bg-slate-50 border border-slate-100 rounded-2xl">
                    <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mr-2" />
                    <span className="text-xs font-semibold text-slate-500">Loading live rates...</span>
                  </div>
                ) : filteredPlans.length === 0 ? (
                  <div className="p-4 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 text-center">
                    <p className="text-xs font-bold font-mono">No active {serviceTitle} bundles configured yet.</p>
                    <p className="text-[10px] mt-1 text-amber-600">Please check back shortly or contact our customer support.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
                    {filteredPlans.map((plan) => {
                      const selected = selectedBundleId === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedBundleId(plan.id)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${
                            selected
                              ? 'border-indigo-600 bg-indigo-50/10 ring-4 ring-indigo-600/5'
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-extrabold text-sm text-slate-900">{plan.capacity}</span>
                            <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full bg-white scale-${selected ? '100' : '0'} transition-transform`} />
                            </div>
                          </div>
                          <p className="text-xs font-medium text-slate-500 shrink-0">{plan.description || "Instant Delivery"}</p>
                          <p className="text-sm font-black text-indigo-600 mt-2">{currency} {plan.selling_price}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recipient Number */}
              <div>
                <label htmlFor="recipient-phone" className="block text-sm font-bold text-slate-700 mb-2">
                  {serviceType === 'AIRTIME' ? 'Recipient Mobile Phone Number' : 'Recipient Phone Number (PIN Delivery via SMS)'}
                </label>
                <div className="relative">
                  <input
                    id="recipient-phone"
                    type="tel"
                    placeholder="e.g. 0244002233"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\s+/g, ''))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-medium"
                    required
                  />
                  {phone.length >= 10 && (
                    <div className="absolute inset-y-0 right-3.5 flex items-center">
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-black uppercase">Valid</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Payer Phone */}
              <div>
                <label htmlFor="payer-phone" className="block text-sm font-bold text-slate-700 mb-2">
                  Payer Phone Number (Option for payment confirmation)
                </label>
                <input
                  id="payer-phone"
                  type="tel"
                  placeholder="e.g. 0244002233 (Leave black to use Recipient Phone)"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value.replace(/\s+/g, ''))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800 transition-all placeholder:text-slate-400 placeholder:font-medium"
                />
              </div>
            </div>

            {/* Footer / Submit */}
            <div className="px-6 py-5 border-t border-slate-100 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isLoading || !selectedBundleId || filteredPlans.length === 0}
                className="w-full py-4 bg-indigo-600 text-white font-black text-sm uppercase tracking-wider rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-200/50 flex justify-center items-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Processing Secure Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    <span>Pay {currency} {selectedPlanObj?.selling_price || "0.00"} securely</span>
                  </>
                )}
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <ShieldCheck size={14} className="text-indigo-600" />
                <span>100% Secure SSL Paystack Checkout</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
