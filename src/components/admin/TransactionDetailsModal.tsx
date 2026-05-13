import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { supabase } from '../../lib/supabase';
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
  AlertCircle,
  MoreVertical,
  RefreshCw,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { openWhatsApp } from '../../lib/whatsapp';
import { API_ROUTES } from '../../../lib/constants';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: any;
  onUpdate?: () => void;
}

export const TransactionDetailsModal: React.FC<TransactionDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  transaction,
  onUpdate
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResendMenu, setShowResendMenu] = useState(false);

  if (!transaction) return null;

  const deliveredStatuses = ['delivered', 'success', 'fulfilled', 'completed'];
  const isDelivered = deliveredStatuses.includes(transaction.vtu_status?.toLowerCase());

  const generateWhatsAppMessage = () => {
    const network = String(transaction.network || "N/A").toUpperCase();
    const bundle = transaction.display_bundle || transaction.capacity || "N/A";
    const recipient = transaction.recipient_phone || "N/A";
    const refId = transaction.reference || `DP-${transaction.id.slice(0, 8)}`;
    const amount = Number(transaction.amount).toFixed(2);

    return `Hello 👋\n\nYour Datapapa transaction has been successfully delivered.\n\nReference: ${refId}\nNetwork: ${network}\nBundle: ${bundle}\nRecipient: ${recipient}\nAmount: GHS ${amount}\n\nThank you for choosing Datapapa.`;
  };

  const trackWhatsAppContact = async (message: string) => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await axios.post(API_ROUTES.ADMIN_TX_ACTION, {
        action: 'track_whatsapp',
        transactionId: transaction.id,
        message
      }, { headers });

      if (res.data.success) {
        if (onUpdate) onUpdate();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error("WhatsApp Tracking Error:", err);
      toast.error("Failed to track communication state");
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWhatsAppClick = async () => {
    if (!isDelivered) {
      toast.error("Transaction must be delivered before initiating confirmation.");
      return;
    }

    const message = generateWhatsAppMessage();
    
    // 1. Open WhatsApp
    openWhatsApp({
      phone: transaction.recipient_phone || transaction.payer_phone_number,
      message
    });

    // 2. Track in DB
    await trackWhatsAppContact(message);
  };

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

  const DetailRow = ({ icon: Icon, label, value, copyable = false, isJson = false }: any) => {
    let displayValue = value;
    let jsonContent = '';

    if (isJson) {
      if (typeof value === 'string') {
        try {
          displayValue = JSON.parse(value);
        } catch (e) {
          displayValue = value;
        }
      }
      
      // Only stringify if it's an object and NOT a React element
      if (typeof displayValue === 'object' && displayValue !== null && !React.isValidElement(displayValue)) {
        try {
          jsonContent = JSON.stringify(displayValue, null, 2);
        } catch (e) {
          jsonContent = String(displayValue);
        }
      } else {
        jsonContent = String(displayValue);
      }
    }

    return (
      <div className="flex flex-col gap-1 py-3 border-b border-slate-50 last:border-0">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-slate-400" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          {isJson ? (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 mt-2 overflow-x-auto max-h-80 group relative shadow-inner">
              <pre className="text-[11px] font-mono text-slate-600 leading-relaxed">
                {jsonContent}
              </pre>
              <button 
                onClick={() => copyToClipboard(jsonContent, label)}
                className="absolute top-3 right-3 p-2 bg-white shadow-sm border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110"
                title="Copy JSON Payload"
              >
                <Copy size={14} />
              </button>
            </div>
          ) : (
            <span className={`text-sm font-bold text-slate-900 ${copyable ? 'font-mono' : ''}`}>
              {value || '—'}
            </span>
          )}
          {copyable && !isJson && value && typeof value !== 'object' && (
            <button 
              onClick={() => copyToClipboard(String(value), label)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <Copy size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

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
                  
                  {/* Extract info from payload if available */}
                  {(() => {
                    let payload: any = {};
                    if (typeof transaction.provider_payload === 'string') {
                      try { payload = JSON.parse(transaction.provider_payload); } catch(e) {}
                    } else if (transaction.provider_payload) {
                      payload = transaction.provider_payload;
                    }

                    return (
                      <>
                        {payload.message && (
                          <div className="md:col-span-2">
                            <DetailRow icon={MessageCircle} label="Provider Message" value={payload.message} />
                          </div>
                        )}
                        {payload.balance && (
                          <DetailRow 
                            icon={Database} 
                            label="Provider Balance" 
                            value={`₵${Number(payload.balance.current || payload.balance).toFixed(2)}`} 
                          />
                        )}
                      </>
                    );
                  })()}
                </div>
                
                <div className="mt-4">
                  <DetailRow icon={Database} label="Provider Payload" value={transaction.provider_payload} isJson />
                </div>

                {/* WhatsApp Contact Info */}
                {transaction.whatsapp_sent && (
                  <div className="mt-6 p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MessageCircle size={12} />
                      Communication History
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Last Contacted:</span>
                        <span className="text-slate-900 font-bold">{new Date(transaction.whatsapp_sent_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Initiated By:</span>
                        <span className="text-indigo-600 font-bold bg-white px-2 py-0.5 rounded-lg border border-indigo-50">
                          {(() => {
                            const lastWaLog = transaction.audit_log?.filter((l: any) => l.action === 'WHATSAPP_CONTACT_INITIATED').pop();
                            return lastWaLog?.admin || transaction.whatsapp_sent_by_email || 'System/Admin';
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Total Messages:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 font-bold">{transaction.whatsapp_send_count || 1}</span>
                          <div className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-[9px] text-emerald-600 font-black uppercase tracking-tighter">Verified Operational Contact</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

              <div className="flex items-center gap-2">
                {transaction.whatsapp_sent ? (
                  <>
                    <div className="relative group/whatsapp">
                      <button 
                        disabled
                        className="px-6 py-3 bg-slate-100 text-slate-400 font-black text-sm rounded-2xl border border-slate-200 flex items-center gap-2 cursor-not-allowed"
                      >
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        WHATSAPP SENT
                      </button>
                      
                      {/* Detailed Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-4 py-2 bg-slate-900 text-white text-[10px] rounded-xl opacity-0 invisible group-hover/whatsapp:opacity-100 group-hover/whatsapp:visible transition-all whitespace-nowrap z-50 shadow-xl">
                        <div className="font-bold border-b border-slate-700 pb-1 mb-1">Message already initiated</div>
                        <div>Sent: {new Date(transaction.whatsapp_sent_at).toLocaleDateString()} • {new Date(transaction.whatsapp_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="mt-0.5 text-slate-400 italic">Double-send prevention active</div>
                        <div className="bg-white/10 h-[1px] w-full my-1" />
                        <div className="text-emerald-400">Status: ADMIN_INITIATED_SUPPORT</div>
                      </div>
                    </div>
                    
                    <div className="relative">
                      <button 
                        onClick={() => setShowResendMenu(!showResendMenu)}
                        className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all shadow-sm"
                        title="More Actions"
                      >
                        <MoreVertical size={20} />
                      </button>
                      
                      <AnimatePresence>
                        {showResendMenu && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full right-0 mb-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-[120]"
                          >
                            <div className="px-4 py-2 border-b border-slate-50 bg-slate-50/50">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secondary Actions</span>
                            </div>
                            <button 
                              onClick={() => {
                                setShowResendMenu(false);
                                handleWhatsAppClick();
                              }}
                              className="w-full px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 group transition-colors"
                            >
                              <div className="p-1.5 bg-indigo-50 text-indigo-500 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                <RefreshCw size={14} />
                              </div>
                              Resend WhatsApp
                            </button>
                            <button 
                              onClick={() => {
                                setShowResendMenu(false);
                                copyToClipboard(generateWhatsAppMessage(), "WhatsApp Message");
                              }}
                              className="w-full px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 group transition-colors border-t border-slate-50"
                            >
                              <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                <Copy size={14} />
                              </div>
                              Copy Message Template
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                ) : (
                  <button 
                    onClick={handleWhatsAppClick}
                    disabled={!isDelivered || isProcessing}
                    className={`px-8 py-3 font-black text-sm rounded-2xl transition-all flex items-center gap-2 shadow-lg min-w-[200px] justify-center ${
                      !isDelivered 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 active:scale-95'
                    }`}
                  >
                    {isProcessing ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <MessageCircle size={18} />
                    )}
                    {isDelivered ? 'WHATSAPP CUSTOMER' : 'DELIVERY REQUIRED'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
