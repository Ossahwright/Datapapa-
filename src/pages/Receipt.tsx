import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Loader2, 
  XCircle, 
  Copy, 
  Check, 
  ArrowLeft,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { findNetworkConfig } from '../lib/networkConfig';
import { openWhatsApp } from '../lib/whatsapp';

export type TransactionStatus = 'success' | 'processing' | 'failed';

export default function Receipt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'general').maybeSingle();
      if (data?.value) setSettings(data.value);
    };
    fetchSettings();
  }, []);

  // Robust UUID Validation Helper
  const isUUID = (str: string | undefined): boolean => {
    if (!str) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str.trim());
  };

  useEffect(() => {
    if (!id) {
      console.error("📍 Receipt Error: No ID found in URL params");
      setLoading(false);
      setError("Receipt identifier missing");
      return;
    }

    const fetchTransaction = async () => {
      // console.log("📍 Receipt Route Params - Raw ID:", id);
      const cleanId = (id || '').trim();
      
      if (!cleanId) {
        setError("Receipt identifier missing");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/receipt?id=${encodeURIComponent(cleanId)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const contentType = response.headers.get('content-type') || '';
        const text = await response.text();

        if (!response.ok) {
          let errorMsg = 'Receipt not found. If you just paid, it might still be initializing. Please check again in a moment.';
          if (contentType.includes('application/json')) {
            try {
              const result = JSON.parse(text);
              errorMsg = result.error || errorMsg;
            } catch (e) {}
          }
          setError(errorMsg);
          return;
        }

        let result;
        try {
          result = JSON.parse(text);
        } catch (e) {
          throw new Error('Incorrect response format received from the server. If this is a very new transaction, please wait a moment for payment synchronization.');
        }
        
        if (result && result.success && result.transaction) {
          setTransaction(result.transaction);
          setError(null);
        } else {
          setError('Receipt not found. If you just paid, it might still be initializing. Please check again in a moment.');
        }
      } catch (err: any) {
        if (!transaction) setError(err.message || 'An unexpected error occurred while loading your receipt.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
    
    // Fallback polling every 5 seconds if not yet processed
    const interval = setInterval(() => {
      fetchTransaction();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!transaction?.id || !isUUID(transaction.id)) return;

    console.log("📍 Initializing Realtime channel for UUID:", transaction.id);
    const channel = supabase
      .channel(`receipt-realtime-${transaction.id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'transactions', 
          filter: `id=eq.${transaction.id}` 
        },
        (payload) => {
          console.log('🔄 Realtime Receipt Update Received:', payload.new);
          setTransaction((prev: any) => ({ ...prev, ...payload.new }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [transaction?.id]);

  const displayReference = transaction?.reference || transaction?.paystack_receipt || transaction?.internal_reference || 'N/A';

  const handleCopy = () => {
    if (!displayReference) return;
    navigator.clipboard.writeText(displayReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusInfo = (tx: any): { status: string; title: string; message: string; color: string; icon: React.ReactNode; subMessage: string } => {
    if (!tx) return { status: 'processing', title: 'Loading...', message: 'Please wait...', color: 'slate', icon: <Loader2 className="animate-spin" />, subMessage: 'Verifying data with provider...' };

    const isPaid = tx.payment_status === 'success' || 
                   ['success', 'paid', 'payment_success', 'fulfilled'].includes(tx.status?.toLowerCase());
                   
    const isDelivered = tx.vtu_status === 'delivered' || tx.delivery_status === 'delivered' || tx.status?.toLowerCase() === 'fulfilled';
    const isFailed = tx.vtu_status === 'failed' || tx.delivery_status === 'failed' || tx.vtu_status === 'provider_rejected' || tx.status?.toLowerCase() === 'failed';

    if (isDelivered) {
      const isAirtime = tx.service_type === 'AIRTIME';
      return {
        status: 'Delivered',
        title: 'PAYMENT SUCCESS',
        message: isAirtime ? 'Airtime Delivered!' : 'Bundle Delivered!',
        subMessage: isAirtime 
          ? 'Your transaction was successful and the airtime has been credited to the recipient.'
          : 'Your transaction was successful and the data bundle has been credited to the recipient.',
        color: 'emerald',
        icon: (
          <div className="relative flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 2], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute w-10 h-10 bg-emerald-200 rounded-full"
            />
            <CheckCircle2 className="w-10 h-10 text-emerald-500 relative z-10" />
          </div>
        )
      };
    }

    if (isFailed) {
      return {
        status: 'Failed',
        title: 'ORDER ISSUE',
        message: 'Payment Received',
        subMessage: 'We received your payment but delivery failed. Our automated system is retrying or alerting an agent.',
        color: 'rose',
        icon: <XCircle className="w-10 h-10 text-rose-500" />
      };
    }

    const age = Date.now() - new Date(tx.created_at).getTime();
    const isStale = age > 3600000;

    if (isPaid) {
      const isAirtime = tx.service_type === 'AIRTIME';
      return {
        status: 'Processing',
        title: 'PAYMENT SUCCESS',
        message: 'Order Processing',
        subMessage: isAirtime 
          ? 'Successful payment! We are now sending the airtime to the recipient. This usually takes 10-30 seconds.'
          : 'Successful payment! We are now sending the data to the recipient. This usually takes 10-30 seconds.',
        color: 'indigo',
        icon: (
          <div className="relative flex items-center justify-center">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute w-12 h-12 border-2 border-dashed border-indigo-200 rounded-full"
            />
            <CheckCircle2 className="w-10 h-10 text-indigo-500 relative z-10" />
          </div>
        )
      };
    }

    return {
      status: isStale ? 'Expired' : 'Awaiting',
      title: isStale ? 'SESSION EXPIRED' : 'PAYMENT PENDING',
      message: isStale ? 'Payment Timed Out' : 'Checking status...',
      subMessage: isStale 
        ? 'This transaction session has expired as no payment was confirmed within 1 hour.' 
        : 'We are waiting for a final confirmation from the payment provider.',
      color: isStale ? 'slate' : 'amber',
      icon: isStale ? <XCircle className="w-10 h-10 text-slate-400" /> : <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
          />
          <div className="text-center">
            <h3 className="text-slate-900 font-black text-lg tracking-tight">Verifying Transaction</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Please hold on...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200 border border-slate-100 text-center"
        >
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <XCircle className="w-10 h-10 text-rose-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Receipt Error</h2>
          <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl mb-8">
            <p className="text-rose-700 text-sm font-medium">{error || 'No transaction found'}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
          >
            RETURN TO HOMEPAGE
          </button>
        </motion.div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(transaction);
  const netConfig = findNetworkConfig(transaction.network_id || transaction.network || '');
  const adminWhatsApp = "233244014207";

  return (
    <div className="min-h-screen bg-[#fcfcfd] py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
      <div className={`absolute top-0 left-0 w-full h-1 bg-${statusInfo.color}-600`} />
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[360px] z-10 px-2"
      >
        <div className="text-center mb-6">
            <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">{settings?.app_name || 'DATAPAPA'}</h2>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] border border-slate-100 overflow-hidden relative">
          {/* Status Banner */}
          <div className={`py-10 flex flex-col items-center text-center px-6 bg-gradient-to-b from-${statusInfo.color}-50/50 to-white`}>
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', damping: 15 }}
              className={`w-20 h-20 rounded-full bg-white shadow-xl shadow-${statusInfo.color}-100 flex items-center justify-center mb-5 border border-${statusInfo.color}-50 relative z-10`}
            >
              {statusInfo.icon}
            </motion.div>
            
            <h1 className={`text-xl font-black tracking-tighter mb-0.5 ${
              statusInfo.color === 'emerald' ? 'text-emerald-600' :
              statusInfo.color === 'rose' ? 'text-rose-600' : 'text-indigo-600'
            }`}>
              {statusInfo.title}
            </h1>
            
            <p className="text-slate-900 font-bold text-base mb-0.5">{statusInfo.message}</p>
            <p className="text-slate-500 text-[10px] max-w-[200px] mx-auto leading-tight font-medium">{statusInfo.subMessage}</p>
          </div>

          {/* Dotted separator */}
          <div className="relative py-1">
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-100" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2.5 w-5 h-5 rounded-full bg-[#fcfcfd] border border-slate-100" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2.5 w-5 h-5 rounded-full bg-[#fcfcfd] border border-slate-100" />
          </div>

          {/* Details Section */}
          <div className="px-6 pb-6">
            <div className="bg-slate-50 rounded-xl p-3 flex flex-col items-center mb-4 border border-slate-100/50 shadow-inner">
              <span className="text-slate-400 font-bold uppercase text-[7px] tracking-widest mb-0.5">Amount Paid</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-sm font-bold text-slate-400">₵</span>
                <span className="text-2xl font-black text-slate-900 tracking-tighter">
                  {Number(transaction.amount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center p-0.5">
                <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest">Network</span>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${netConfig?.color || 'bg-slate-400'}`} />
                  <span className="text-slate-900 font-black text-xs">{netConfig?.label || transaction.network || 'Generic'}</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-0.5">
                <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest">
                  {transaction.service_type === 'AIRTIME' ? 'Service' : 'Plan'}
                </span>
                <span className="text-slate-900 font-black text-xs">
                  {transaction.service_type === 'AIRTIME' ? 'Airtime Recharge' : (transaction.display_bundle || transaction.capacity || 'Data Pack')}
                </span>
              </div>

              <div className="flex justify-between items-center p-0.5">
                <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest">Recipient No.</span>
                <span className="text-slate-900 font-mono font-black text-xs tabular-nums bg-slate-100 px-2.5 py-0.5 rounded">
                  {transaction.recipient_phone || transaction.phone}
                </span>
              </div>

              {(transaction.payer_phone_number || transaction.payer_phone) && (
                <div className="flex justify-between items-center p-0.5">
                  <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest">Payer No.</span>
                  <span className="text-slate-900 font-mono font-black text-xs tabular-nums bg-slate-100 px-2.5 py-0.5 rounded">
                    {transaction.payer_phone_number || transaction.payer_phone}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center p-0.5">
                <span className="text-slate-400 font-bold uppercase text-[8px] tracking-widest">Ref</span>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 rounded hover:bg-indigo-50 transition-colors text-slate-500 font-mono text-[9px] font-bold"
                  >
                    {displayReference.slice(0, 10)}...
                    {copied ? <Check size={8} className="text-emerald-500" /> : <Copy size={8} className="text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Main Action */}
            <div className="mt-6 space-y-2">
              <button
                onClick={() => navigate('/')}
                className="w-full relative group"
              >
                <div className="relative flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all active:scale-[0.98] shadow-lg">
                  <span>BACK TO HOME</span>
                  <ArrowLeft size={14} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    const payerVal = transaction.payer_phone_number || transaction.payer_phone;
                    openWhatsApp({ 
                      phone: adminWhatsApp, 
                      message: `Hi, I need help with transaction: ${displayReference}.\nRecipient: ${transaction.recipient_phone || transaction.phone}${payerVal ? `\nPayer No: ${payerVal}` : ''}` 
                    });
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-slate-600 border border-slate-100 rounded-xl font-bold text-[10px] hover:bg-slate-50 transition-all"
                >
                  <MessageCircle size={12} className="text-emerald-500" />
                  Support
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-white text-slate-600 border border-slate-100 rounded-xl font-bold text-[10px] hover:bg-slate-50 transition-all"
                >
                  <Smartphone size={12} className="text-indigo-500" />
                  Print
                </button>
              </div>
            </div>
          </div>
          
          {/* Footer Card Section */}
          <div className="bg-slate-50 px-6 py-2 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={10} className="text-indigo-600" />
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Secured by Datapapa</p>
            </div>
            
            <div className="flex gap-0.5">
              {[1,2,3].map(i => <div key={i} className="w-0.5 h-0.5 rounded-full bg-slate-200" />)}
            </div>
          </div>
        </div>
        
        <p className="text-center mt-4 text-slate-400 text-[10px] font-medium">
          Issues? <button onClick={() => navigate('/support')} className="text-indigo-600 font-bold hover:underline underline-offset-4">Get Help</button>
        </p>
      </motion.div>
    </div>
  );
}
