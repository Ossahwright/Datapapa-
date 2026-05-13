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
      console.log("📍 Receipt Route Params - Raw ID:", id);
      const cleanId = (id || '').trim();
      
      if (!cleanId) {
        setError("Receipt identifier missing");
        setLoading(false);
        return;
      }

      const isValidUUID = isUUID(cleanId);
      console.log("📍 UUID Validation:", isValidUUID);

      try {
        let query = supabase.from('transactions').select('*');

        if (isValidUUID) {
          // If it's a UUID, we can safely query the 'id' column (which is a PK UUID)
          console.log("📍 querying by UUID primary key...");
          query = query.eq('id', cleanId);
        } else {
          // If it's NOT a UUID, querying the 'id' column directly will cause a Postgres 22P02 error.
          // Instead, we query all valid TEXT-based reference columns.
          console.log("📍 querying by text reference fields...");
          query = query.or(`paystack_receipt.eq."${cleanId}",internal_reference.eq."${cleanId}",external_reference.eq."${cleanId}",provider_reference.eq."${cleanId}"`);
        }

        const { data, error: fetchError } = await query.maybeSingle();

        if (fetchError) {
          console.error("📍 Supabase Fetch Error:", fetchError);
          // 22P02 is specifically 'invalid input syntax for type uuid'
          // This should be unreachable now due to the check above, but we keep it for safety.
          if (fetchError.code === '22P02') {
            setError('Invalid receipt identifier format.');
          } else {
            setError(`Unable to load receipt: ${fetchError.message || 'Database error'}`);
          }
          return;
        }
        
        if (data) {
          console.log("✅ Receipt Found:", data.id);
          setTransaction(data);
        } else {
          console.warn("📍 No transaction found for identifier:", cleanId);
          setError('Receipt not found. If you just paid, it might still be initializing. Please check again in a moment.');
        }
      } catch (err: any) {
        console.error('📍 Critical Error in Receipt Fetch:', err);
        setError(err.message || 'An unexpected error occurred while loading your receipt.');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`receipt-realtime-${id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'transactions', 
          filter: `id=eq.${id}` 
        },
        (payload) => {
          console.log('🔄 Realtime Receipt Update Received:', payload.new);
          setTransaction(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

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
      return {
        status: 'Delivered',
        title: 'PAYMENT SUCCESS',
        message: 'Bundle Delivered!',
        subMessage: 'Your transaction was successful and the data bundle has been credited to the recipient.',
        color: 'emerald',
        icon: <div className="relative">
                <CheckCircle2 className="w-20 h-20 text-emerald-500" />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute inset-0 bg-emerald-400 rounded-full"
                />
              </div>
      };
    }

    if (isFailed) {
      return {
        status: 'Failed',
        title: 'ORDER ISSUE',
        message: 'Payment Received',
        subMessage: 'We received your payment but delivery failed. Our automated system is retrying or alerting an agent.',
        color: 'rose',
        icon: <XCircle className="w-20 h-20 text-rose-500" />
      };
    }

    if (isPaid) {
      return {
        status: 'Processing',
        title: 'PAYMENT SUCCESS',
        message: 'Order Processing',
        subMessage: 'Successful payment! We are now sending the data to the recipient. This usually takes 10-30 seconds.',
        color: 'indigo',
        icon: <div className="relative">
                <CheckCircle2 className="w-20 h-20 text-indigo-500" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-[-8px] border-2 border-dashed border-indigo-200 rounded-full"
                />
              </div>
      };
    }

    return {
      status: 'Awaiting',
      title: 'PAYMENT PENDING',
      message: 'Checking status...',
      subMessage: 'We are waiting for a final confirmation from the payment provider.',
      color: 'amber',
      icon: <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
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
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg z-10"
      >
        <div className="text-center mb-8">
            <h2 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">{settings?.app_name || 'DATAPAPA'} TRANSACTION</h2>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[1.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden relative">
          {/* Status Banner */}
          <div className={`py-12 flex flex-col items-center text-center px-8 bg-gradient-to-b from-${statusInfo.color === 'emerald' ? 'emerald' : statusInfo.color}-50/50 to-white`}>
            
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 15 }}
              className={`w-24 h-24 rounded-full bg-white shadow-xl shadow-${statusInfo.color}-100 flex items-center justify-center mb-6 border border-${statusInfo.color}-50 relative z-10`}
            >
              {statusInfo.icon}
            </motion.div>
            
            <h1 className={`text-3xl font-black tracking-tighter mb-2 ${
              statusInfo.color === 'emerald' ? 'text-emerald-600' :
              statusInfo.color === 'rose' ? 'text-rose-600' : 'text-indigo-600'
            }`}>
              {statusInfo.title}
            </h1>
            
            <p className="text-slate-900 font-bold text-xl mb-1">{statusInfo.message}</p>
            <p className="text-slate-500 text-[13px] max-w-[280px] mx-auto leading-relaxed font-medium">{statusInfo.subMessage}</p>
          </div>

          {/* Dotted separator with physical feel */}
          <div className="relative py-4">
            <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-slate-100" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-4 w-8 h-8 rounded-full bg-[#fcfcfd] border border-slate-100" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-4 w-8 h-8 rounded-full bg-[#fcfcfd] border border-slate-100" />
          </div>

          {/* Details Section */}
          <div className="px-10 pb-10">
            <div className="bg-slate-50 rounded-2xl p-6 flex flex-col items-center mb-8 border border-slate-100/50 shadow-inner">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mb-2">Amount Paid</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-400">₵</span>
                <span className="text-4xl font-black text-slate-900 tracking-tighter">
                  {Number(transaction.amount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex justify-between items-center transition-all hover:bg-slate-50 p-2 rounded-xl">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Network Provider</span>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${netConfig?.color || 'bg-slate-400'} shadow-sm`} />
                  <span className="text-slate-900 font-black text-base">{netConfig?.label || transaction.network || 'Generic'}</span>
                </div>
              </div>

              <div className="flex justify-between items-center transition-all hover:bg-slate-50 p-2 rounded-xl">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Bundle Package</span>
                <span className="text-slate-900 font-black text-base">{transaction.display_bundle || transaction.capacity || 'Data Pack'}</span>
              </div>

              <div className="flex justify-between items-center transition-all hover:bg-slate-50 p-2 rounded-xl">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Recipient Number</span>
                <span className="text-slate-900 font-mono font-black text-base tabular-nums bg-slate-100 px-3 py-1 rounded-lg">
                  {transaction.recipient_phone || transaction.phone}
                </span>
              </div>

              <div className="flex justify-between items-center transition-all hover:bg-slate-50 p-2 rounded-xl">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Transaction ID</span>
                <div className="flex items-center gap-2 group">
                  <a 
                    href={`https://checkout.paystack.com/receipt/${transaction.paystack_receipt || transaction.reference}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-500 font-mono text-[11px] font-bold hover:text-indigo-600 transition-colors flex items-center gap-1"
                  >
                    {displayReference.slice(0, 18)}...
                    <ExternalLink size={10} />
                  </a>
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 bg-slate-100 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-slate-400" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center transition-all hover:bg-slate-50 p-2 rounded-xl">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Date & Time</span>
                <span className="text-slate-500 font-bold text-[13px]">{new Date(transaction.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            {/* Main Action */}
            <div className="mt-12 space-y-4">
              <button
                onClick={() => navigate('/')}
                className="w-full relative group"
              >
                <div className="absolute inset-0 bg-indigo-600 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <div className="relative flex items-center justify-center gap-3 py-6 bg-slate-900 text-white rounded-[2.5rem] font-black text-lg hover:bg-black transition-all active:scale-[0.98] shadow-2xl">
                  <span>RETURN TO HOMEPAGE</span>
                  <ArrowLeft size={20} className="rotate-180 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => openWhatsApp({ phone: adminWhatsApp, message: `Hi, I need help with transaction: ${displayReference}. For number: ${transaction.recipient_phone}` })}
                  className="flex items-center justify-center gap-2 py-4 bg-white text-slate-600 border-2 border-slate-100 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-slate-200 transition-all"
                >
                  <MessageCircle size={18} className="text-emerald-500" />
                  Support
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 py-4 bg-white text-slate-600 border-2 border-slate-100 rounded-2xl font-bold text-sm hover:bg-slate-50 hover:border-slate-200 transition-all"
                >
                  <Smartphone size={18} className="text-indigo-500" />
                  Save App
                </button>
              </div>
            </div>
          </div>
          
          {/* Footer Card Section */}
          <div className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
                <ShieldCheck size={16} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Secured by Datapapa</p>
                <p className="text-[9px] text-slate-300 font-medium leading-none">Instant Bundle Delivery Guaranteed</p>
              </div>
            </div>
            
            {/* Tiny receipt cut effect */}
            <div className="flex gap-1">
              {[1,2,3,4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-200" />)}
            </div>
          </div>
        </div>
        
        <p className="text-center mt-10 text-slate-400 text-sm font-medium">
          Is the data not showing up? <button onClick={() => navigate('/support')} className="text-indigo-600 font-bold hover:underline underline-offset-4">Open a Ticket</button>
        </p>
      </motion.div>
    </div>
  );
}
