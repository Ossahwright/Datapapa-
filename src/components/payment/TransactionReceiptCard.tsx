import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Copy, Check } from 'lucide-react';

export type TransactionStatus = 'success' | 'processing' | 'failed';

export interface TransactionReceiptProps {
  status: TransactionStatus;
  amount: number | string;
  network?: string;
  bundle?: string;
  recipient: string;
  payerPhone?: string;
  reference: string;
  paymentMethod?: string;
  date?: string;
  appName?: string;
  onReturnHome: () => void;
  onRetry?: () => void;
  onSupport?: () => void;
}

export function TransactionReceiptCard({
  status,
  amount,
  network,
  bundle,
  recipient,
  payerPhone,
  reference,
  paymentMethod = 'Paystack',
  date = new Date().toLocaleString(),
  appName = 'Datapapa',
  onReturnHome,
  onRetry,
  onSupport,
}: TransactionReceiptProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-100';
      case 'processing':
        return 'text-amber-600 bg-amber-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-slate-600 bg-slate-100';
    }
  };

  const getHeaderContent = () => {
    switch (status) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-10 h-10 text-green-600" />,
          title: 'Payment Successful',
          message: 'Your transaction was completed successfully.',
          badge: <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase">Successful</span>,
        };
      case 'processing':
        return {
          icon: <Loader2 className="w-10 h-10 text-amber-600 animate-spin" />,
          title: 'Payment Received',
          message: 'Your transaction is being processed. Please wait while we complete delivery.',
          badge: <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase animate-pulse">Processing</span>,
        };
      case 'failed':
        return {
          icon: <XCircle className="w-10 h-10 text-red-600" />,
          title: 'Transaction Failed',
          message: 'We could not complete your request. If funds were deducted, support will resolve it shortly.',
          badge: <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase">Failed</span>,
        };
    }
  };

  const header = getHeaderContent();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-8 border border-slate-100 max-w-md mx-auto w-full relative overflow-hidden my-auto"
      >
        <div 
          className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${
            status === 'success' ? 'from-green-400 to-emerald-500' :
            status === 'processing' ? 'from-amber-400 to-orange-500' :
            'from-red-400 to-rose-500'
          }`} 
        />
        
        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${getStatusColor().split(' ')[1]}`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              {header.icon}
            </motion.div>
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">{header.title}</h2>
          <p className="text-slate-500 text-sm mt-2">{header.message}</p>
          <div className="mt-4">
             {header.badge}
          </div>
          
          {/* Main Receipt Content */}
          <div className="w-full mt-8 bg-slate-50 rounded-3xl p-6 border border-slate-200/60 relative text-left">
            {/* Cut-out circles for receipt look */}
            <div className="absolute top-1/2 -left-3 w-6 h-6 bg-white rounded-full border border-slate-200/60 -translate-y-1/2" />
            <div className="absolute top-1/2 -right-3 w-6 h-6 bg-white rounded-full border border-slate-200/60 -translate-y-1/2" />
            
            <div className="space-y-4 font-mono text-xs text-slate-600">
              <div className="flex justify-between items-center bg-slate-100/50 p-2 rounded-lg -mx-2 mb-4">
                <span className="uppercase text-[10px] font-bold text-slate-400">Reference</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-bold">{reference}</span>
                  <button 
                    onClick={handleCopy}
                    className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-500 hover:text-slate-900 flex items-center justify-center"
                    title="Copy Reference"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {network && (
                <div className="flex justify-between">
                  <span className="uppercase text-[10px] font-bold text-slate-400">Network</span>
                  <span className="text-slate-900 font-bold">{network}</span>
                </div>
              )}
              {bundle && (
                <div className="flex justify-between">
                  <span className="uppercase text-[10px] font-bold text-slate-400">Bundle</span>
                  <span className="text-slate-900 font-bold truncate max-w-[150px] text-right">{bundle}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="uppercase text-[10px] font-bold text-slate-400">Recipient</span>
                <span className="text-slate-900 font-bold text-sm tracking-tighter">{recipient}</span>
              </div>
              {payerPhone && (
                <div className="flex justify-between">
                  <span className="uppercase text-[10px] font-bold text-slate-400">Payer No.</span>
                  <span className="text-slate-900 font-bold text-sm tracking-tighter">{payerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="uppercase text-[10px] font-bold text-slate-400">Method</span>
                <span className="text-slate-900 font-bold">{paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="uppercase text-[10px] font-bold text-slate-400">Date</span>
                <span className="text-slate-900 font-bold">{date}</span>
              </div>
              
              <div className="pt-4 border-t border-dashed border-slate-300">
                <div className="flex justify-between items-center text-base">
                  <span className="font-bold text-slate-400 uppercase text-xs tracking-wider">Amount</span>
                  <span className="text-slate-900 font-black text-xl">GHS {Number(amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex flex-col items-center w-full gap-3">
            <button
              onClick={onReturnHome}
              className="w-full px-6 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
            >
              Return to Dashboard
            </button>
            
            {(status === 'failed' || status === 'processing') && onSupport && (
              <button
                onClick={onSupport}
                className="w-full px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-2xl font-bold text-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                 Contact Support
              </button>
            )}
            
            {status === 'failed' && onRetry && (
               <button
                 onClick={onRetry}
                 className="w-full px-6 py-3 bg-red-50 text-red-700 border border-red-100 rounded-2xl font-bold text-sm hover:bg-red-100 transition-all active:scale-95"
               >
                 Try Again
               </button>
            )}
          </div>
          
          <div className="mt-6">
             <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">{appName} Secure Checkout</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
