import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Copy, 
  Check, 
  Calendar, 
  ShieldCheck, 
  Smartphone, 
  Globe, 
  Database, 
  ExternalLink,
  MessageCircle,
  Hash,
  User,
  Clock,
  Activity,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  transaction 
}) => {
  if (!transaction) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const getStatusBadge = (status: string, type: 'payment' | 'vtu') => {
    const s = status?.toLowerCase();
    let bg = 'bg-slate-100';
    let text = 'text-slate-700';
    let label = status || 'Unknown';

    if (type === 'payment') {
      if (['success', 'paid', 'payment_success', 'completed'].includes(s)) {
        bg = 'bg-emerald-100';
        text = 'text-emerald-700';
        label = 'PAID';
      } else if (['failed', 'declined'].includes(s)) {
        bg = 'bg-rose-100';
        text = 'text-rose-700';
      } else {
        bg = 'bg-amber-100';
        text = 'text-amber-700';
      }
    } else {
      if (['delivered', 'success', 'fulfilled', 'completed'].includes(s)) {
        bg = 'bg-emerald-100';
        text = 'text-emerald-700';
      } else if (['failed', 'provider_rejected'].includes(s)) {
        bg = 'bg-rose-100';
        text = 'text-rose-700';
      } else if (['processing', 'provider_accepted', 'provider_execution_started'].includes(s)) {
        bg = 'bg-indigo-100';
        text = 'text-indigo-700';
      } else if (s === 'manual_override') {
        bg = 'bg-purple-100';
        text = 'text-purple-700';
      } else {
        bg = 'bg-amber-100';
        text = 'text-amber-700';
      }
    }

    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  const DetailRow = ({ icon: Icon, label, value, copyable = false, isJson = false }: any) => (
    <div className="flex flex-col gap-1 py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-slate-400" />
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        {isJson ? (
          <div className="w-full bg-slate-900 rounded-lg p-3 mt-1 overflow-x-auto max-h-40">
            <pre className="text-[11px] font-mono text-indigo-300">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
            </pre>
          </div>
        ) : (
          <span className={`text-sm font-bold text-slate-900 ${copyable ? 'font-mono' : ''}`}>
            {value || '—'}
          </span>
        )}
        {copyable && value && (
          <button 
            onClick={() => copyToClipboard(value, label)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Copy size={14} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Transaction Details</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">
                    ID: {transaction.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                {/* Identity Section */}
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <User size={12} />
                    Customer & Identity
                  </h4>
                  <DetailRow icon={Smartphone} label="Recipient Phone" value={transaction.recipient_phone || transaction.phone} copyable />
                  <DetailRow icon={Globe} label="Network" value={transaction.network} />
                  <DetailRow icon={Database} label="Bundle Package" value={transaction.display_bundle || transaction.capacity} />
                  <DetailRow icon={Hash} label="External Ref" value={transaction.reference || transaction.external_reference} copyable />
                </div>

                {/* Financial Section */}
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <ShieldCheck size={12} />
                    Financial & Status
                  </h4>
                  <DetailRow 
                    icon={Clock} 
                    label="Payment Status" 
                    value={getStatusBadge(transaction.payment_status || transaction.status, 'payment')} 
                  />
                  <DetailRow 
                    icon={Activity} 
                    label="VTU Status" 
                    value={getStatusBadge(transaction.vtu_status, 'vtu')} 
                  />
                  <DetailRow icon={Clock} label="Amount" value={`₵${Number(transaction.amount).toFixed(2)}`} />
                  <DetailRow icon={Calendar} label="Date" value={new Date(transaction.created_at).toLocaleString()} />
                </div>
              </div>

              {/* Advanced Section */}
              <div className="mt-8 pt-8 border-t border-slate-100">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Clock size={12} />
                  Operational Context
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                  <DetailRow icon={Clock} label="Updated At" value={transaction.updated_at ? new Date(transaction.updated_at).toLocaleString() : '—'} />
                  <DetailRow icon={Clock} label="Fulfilled At" value={transaction.fulfilled_at ? new Date(transaction.fulfilled_at).toLocaleString() : '—'} />
                  <DetailRow icon={Hash} label="Provider Ref" value={transaction.provider_reference} copyable />
                  <DetailRow icon={Activity} label="Fulfillment Attempts" value={transaction.fulfillment_attempts || '0'} />
                </div>
                
                <div className="mt-4">
                  <DetailRow icon={Database} label="Provider Payload" value={transaction.provider_payload} isJson />
                </div>

                {/* Audit Log Section */}
                {transaction.audit_log && Array.isArray(transaction.audit_log) && transaction.audit_log.length > 0 && (
                  <div className="mt-6 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <ShieldCheck size={12} />
                      Activity Audit Log
                    </h5>
                    <div className="space-y-3">
                      {transaction.audit_log.map((log: any, idx: number) => (
                        <div key={idx} className="flex gap-3 text-xs">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1" />
                            {idx !== transaction.audit_log.length - 1 && <div className="w-0.5 h-full bg-slate-200" />}
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-700">{log.action || 'Event'}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px] mt-0.5">{log.details || log.message || 'No details'}</p>
                            {log.admin && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-bold mt-1 inline-block">BY: {log.admin}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-2xl transition-all"
              >
                Close
              </button>
              {transaction.recipient_phone && (
                <button 
                  onClick={() => {
                    const msg = `Hello, your Datapapa transaction has been successfully delivered.\n\nReference: ${transaction.reference || 'DP-' + transaction.id.slice(0,6)}\nBundle: ${transaction.display_bundle || transaction.capacity}\nAmount: GHS ${Number(transaction.amount).toFixed(2)}\n\nThank you for choosing Datapapa.`;
                    window.open(`https://wa.me/${transaction.recipient_phone.replace(/\+/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                  }}
                  className="px-6 py-3 bg-emerald-600 text-white font-black text-sm rounded-2xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
                >
                  <MessageCircle size={18} />
                  WHATSAPP CUSTOMER
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
