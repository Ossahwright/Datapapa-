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

  useEffect(() => {
    if (!id) return;

    const fetchTransaction = async () => {
      console.log("📍 Receipt Route Param (id):", id);
      
      // Simple UUID validation check (can use regex)
      const isUUID = (str: string | undefined): boolean => {
        if (!str) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(str);
      };

      console.log("📍 UUID Validation Result:", isUUID(id));

      try {
        console.log("📍 Fetching receipt by ID:", id);
        const { data, error: fetchError } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        console.log("📍 Receipt Query Result:", data);
        console.log("📍 Receipt Query Error:", fetchError);

        if (fetchError) {
          // Check for invalid UUID syntax (error code 22P02)
          if (fetchError.code === '22P02') {
            setError('Invalid receipt identifier');
          } else {
            throw fetchError;
          }
          return;
        }
        
        if (data) {
          setTransaction(data);
        } else {
          setError('Transaction not found');
        }
      } catch (err: any) {
        console.error('Error fetching receipt:', err);
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();

    // Subscribe to realtime updates for this specific transaction
    const channel = supabase
      .channel(`receipt-${id}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'transactions', 
          filter: `id=eq.${id}` 
        },
        (payload) => {
          console.log('🔄 Receipt update:', payload.new);
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

  const getStatusInfo = (tx: any): { status: string; title: string; message: string; color: string; icon: React.ReactNode } => {
    if (!tx) return { status: 'processing', title: 'Loading...', message: 'Please wait...', color: 'slate', icon: <Loader2 className="animate-spin" /> };

    const isPaid = tx.payment_status === 'success' || 
                   tx.status === 'success' || 
                   tx.status === 'payment_success' || 
                   tx.status === 'fulfilled' || 
                   tx.status === 'paid';
                   
    const isDelivered = tx.vtu_status === 'delivered' || tx.delivery_status === 'delivered' || tx.status === 'fulfilled';
    const isFailed = tx.vtu_status === 'failed' || tx.delivery_status === 'failed' || tx.vtu_status === 'provider_rejected' || tx.status === 'failed';

    if (isDelivered) {
      return {
        status: 'Delivered',
        title: 'Transaction Successful',
        message: 'Your data has been delivered successfully.',
        color: 'emerald',
        icon: <CheckCircle2 className="w-12 h-12 text-emerald-600" />
      };
    }

    if (isPaid) {
      return {
        status: 'Processing',
        title: 'Payment Received',
        message: 'Your payment is confirmed. Data delivery is in progress.',
        color: 'indigo',
        icon: <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
      };
    }

    if (isFailed) {
      return {
        status: 'Failed',
        title: 'Transaction Failed',
        message: 'We could not complete your request. Please contact support.',
        color: 'rose',
        icon: <XCircle className="w-12 h-12 text-rose-600" />
      };
    }

    return {
      status: 'Initialized',
      title: 'Payment Pending',
      message: 'Awaiting payment confirmation from Paystack.',
      color: 'slate',
      icon: <Loader2 className="w-12 h-12 text-slate-400 animate-spin" />
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Fetching Auth Receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 text-center">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-rose-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Receipt Error</h2>
          <p className="text-slate-500 text-sm mb-8">{error || 'The reference provided does not match any transaction.'}</p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95"
          >
            Return to Homepage
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(transaction);
  const netConfig = findNetworkConfig(transaction.network_id || transaction.network || '');
  const adminWhatsApp = "233244014207";

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Receipt Container */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
          {/* Top colored bar */}
          <div className={`h-2 w-full bg-${statusInfo.color}-500`} />
          
          <div className="p-8 md:p-10">
            {/* Success Icon & Header */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner bg-${statusInfo.color}-50`}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  {statusInfo.icon}
                </motion.div>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                {statusInfo.title}
              </h2>
              <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                {statusInfo.message}
              </p>
              
              <div className="mt-4">
                <span className={`px-3 py-1 rounded-full font-black text-[10px] tracking-widest uppercase border ${
                  statusInfo.status === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  statusInfo.status === 'processing' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                  'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                  {statusInfo.status}
                </span>
              </div>
            </div>

            {/* Separator */}
            <div className="flex items-center gap-4 mb-8">
              <div className="h-px border-t border-dashed border-slate-200 flex-1" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Transaction Summary</p>
              <div className="h-px border-t border-dashed border-slate-200 flex-1" />
            </div>

            {/* Receipt Content */}
            <div className="space-y-6">
              <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Total Amount</span>
                </div>
                <div className="text-3xl font-black text-slate-900 tracking-tighter">
                  ₵{Number(transaction.amount).toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Network</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${netConfig?.color || 'bg-slate-400'}`} />
                    <span className="text-slate-900 font-black text-sm">{netConfig?.label || transaction.network || 'Unknown'}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Service</span>
                  <span className="text-slate-900 font-black text-sm">{transaction.display_bundle || transaction.capacity || 'Data Package'}</span>
                </div>

                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Recipient</span>
                  <span className="text-slate-900 font-mono font-black text-sm tracking-tight">{transaction.recipient_phone || transaction.phone}</span>
                </div>

                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Status</span>
                  <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                    statusInfo.color === 'emerald' ? 'bg-emerald-100 text-emerald-700' :
                    statusInfo.color === 'rose' ? 'bg-rose-100 text-rose-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {statusInfo.status}
                  </span>
                </div>

                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Reference</span>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 transition-colors hover:border-indigo-200">
                    <span className="text-slate-900 font-mono text-[10px] font-black">{displayReference}</span>
                    <button 
                      onClick={handleCopy}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center px-2">
                  <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Date & Time</span>
                  <span className="text-slate-500 font-bold text-[11px]">{new Date(transaction.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-12 space-y-4">
              <button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-center gap-2 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-base hover:bg-slate-800 transition-all active:scale-95 shadow-2xl shadow-slate-300"
              >
                Return to Homepage
              </button>
              
              <div className="flex gap-3">
                <button
                  onClick={() => openWhatsApp({ phone: adminWhatsApp, message: `Hi, I have an issue with my transaction ${displayReference}. Recipient: ${transaction.recipient_phone}.` })}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all active:scale-95"
                >
                  <MessageCircle size={14} />
                  Support
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-xs hover:bg-slate-50 transition-all active:scale-95"
                >
                  <Smartphone size={14} />
                  Print
                </button>
              </div>
            </div>
          </div>
          
          {/* Footer branding */}
          <div className="bg-slate-50/50 p-6 flex flex-col items-center border-t border-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-indigo-600" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bank-Grade Security</p>
            </div>
            <p className="text-[9px] text-slate-300 font-medium">Datapapa Financial Services • Authorized Merchant</p>
          </div>
        </div>
        
        {/* Help Link */}
        <p className="text-center mt-8 text-slate-400 text-sm">
          Having trouble? <button onClick={() => navigate('/support')} className="text-indigo-600 font-bold hover:underline">Visit Support Center</button>
        </p>
      </motion.div>
    </div>
  );
}
