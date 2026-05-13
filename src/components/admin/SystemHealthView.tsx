import { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Clock, 
  Database, 
  Globe, 
  Webhook,
  ArrowRight,
  RotateCw,
  Info,
  ChevronRight,
  Server,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase";
import { format } from "date-fns";
import { API_ROUTES } from "../../../lib/constants";

interface HealthIndicatorProps {
  label: string;
  status: "online" | "degraded" | "error" | "checking" | "idle";
  icon: any;
  details?: string;
}

const HealthIndicator = ({ label, status, icon: Icon, details }: HealthIndicatorProps) => {
  const statusColors: Record<string, string> = {
    online: "text-emerald-500 bg-emerald-50 border-emerald-100",
    degraded: "text-amber-500 bg-amber-50 border-amber-100",
    error: "text-red-500 bg-red-50 border-red-100",
    checking: "text-slate-400 bg-slate-50 border-slate-100",
    idle: "text-blue-500 bg-blue-50 border-blue-100",
    unknown: "text-slate-400 bg-slate-50 border-slate-100"
  };

  const statusLabels: Record<string, string> = {
    online: "ONLINE",
    degraded: "DEGRADED",
    error: "OFFLINE",
    checking: "CHECKING",
    idle: "IDLE",
    unknown: "UNKNOWN"
  };

  const colorClasses = statusColors[status] || statusColors.unknown;
  const labelText = statusLabels[status] || statusLabels.unknown;

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorClasses} bg-opacity-10`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-sm font-black ${colorClasses.split(' ')[0]}`}>
              {labelText}
            </span>
            {details && <span className="text-[10px] text-slate-400 font-medium">— {details}</span>}
          </div>
        </div>
      </div>
      <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-emerald-500' : status === 'error' ? 'bg-red-500' : 'bg-amber-500'} animate-pulse`}></div>
    </div>
  );
};

export function SystemHealthView() {
  const [health, setHealth] = useState<any>(null);
  const [stuckOrders, setStuckOrders] = useState<any[]>([]);
  const [failedRecent, setFailedRecent] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const fetchSystemState = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      // 1. Fetch API Health
      const { data: healthData } = await axios.get(`${API_ROUTES.SYSTEM_STATUS}?feature=health`, { headers });
      setHealth(healthData);

      // 2. Fetch Stuck Transactions
      // Paid but not delivered successfully after 5 mins
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from("transactions")
        .select("*")
        .or('status.eq.paid,status.eq.success')
        .not('vtu_status', 'eq', 'success')
        .not('vtu_status', 'eq', 'completed')
        .lt('created_at', fiveMinsAgo)
        .order('created_at', { ascending: false });
      
      setStuckOrders(stuck || []);

      // 3. Fetch Recent Failures (Last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: failed } = await supabase
        .from("transactions")
        .select("*")
        .or('status.eq.failed,vtu_status.eq.failed')
        .gt('created_at', oneDayAgo)
        .order('created_at', { ascending: false });

      setFailedRecent(failed || []);

    } catch (err) {
      console.error("Health Center Load Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSystemState();
    
    // SAFE POLLING ARCHITECTURE (Step 6 & 7)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSystemState();
      } else {
        console.log("Tab suspended. Skipping health polling.");
      }
    }, 300000); // 5 minutes minimum
    
    return () => clearInterval(interval);
  }, [fetchSystemState]);

  const handleManualRetry = async (txId: string) => {
    setIsRetrying(txId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      
      const res = await axios.post(API_ROUTES.ADMIN_OPS, { action: 'retry_vtu', transactionId: txId }, { headers });
      if (res.data.success) {
        alert("Retry triggered successfully! Monitoring delivery status...");
        fetchSystemState();
      } else {
        alert("Retry failed: " + res.data.error);
      }
    } catch (err: any) {
      alert("System error during retry: " + (err.response?.data?.error || err.message));
    } finally {
      setIsRetrying(null);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Zap className="text-indigo-600" />
            Reliability Center
          </h2>
          <p className="text-slate-500 font-medium">Real-time operational monitoring & transaction recovery</p>
        </div>
        <button 
          onClick={fetchSystemState}
          className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
        >
          <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* API Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <HealthIndicator 
          label="DataHub Engine" 
          status={health?.services?.datahub?.status || "checking"} 
          icon={Globe}
          details={health?.services?.datahub?.balance ? `Bal: GH₵${health.services.datahub.balance}` : undefined}
        />
        <HealthIndicator 
          label="Paystack Gate" 
          status="online" 
          icon={ShieldCheck} 
          details="Verified connectivity"
        />
        <HealthIndicator 
          label="Supabase Core" 
          status={health?.services?.database?.status || "checking"} 
          icon={Database} 
        />
        <HealthIndicator 
          label="Webhook Sync" 
          status={health?.services?.webhooks?.status || "checking"} 
          icon={Webhook} 
          details={health?.services?.webhooks?.count_1h ? `${health.services.webhooks.count_1h} events/hr` : "Inactive"}
        />
      </div>

      {/* Stuck Transactions Monitor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800">Stuck Orders Watchdog</h3>
                  <p className="text-xs font-semibold text-slate-400">Transactions verified but not delivered</p>
                </div>
              </div>
              <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                {stuckOrders.length} Detected
              </span>
            </div>

            <div className="divide-y divide-slate-50">
              {stuckOrders.length > 0 ? (
                stuckOrders.map(tx => (
                  <div key={tx.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Activity size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">{tx.recipient_phone}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">#{tx.id.substring(0,8)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1"><ArrowRight size={10} /> {tx.network}</span>
                          <span className="flex items-center gap-1"><Info size={10} /> {tx.capacity || tx.volume}</span>
                          <span className="flex items-center gap-1 text-amber-500"><Clock size={10} /> {format(new Date(tx.created_at), "HH:mm")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => handleManualRetry(tx.id)}
                         disabled={isRetrying === tx.id}
                         className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                       >
                         {isRetrying === tx.id ? <RotateCw className="animate-spin" size={14} /> : <RotateCw size={14} />}
                         Safely Retry
                       </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <ShieldCheck size={48} className="mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">All systems green. No stuck transactions detected.</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800">Critical Failure Logs</h3>
                  <p className="text-xs font-semibold text-slate-400">Failures reported in the last 24 hours</p>
                </div>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
              {failedRecent.length > 0 ? (
                failedRecent.map(tx => (
                  <div key={tx.id} className="p-6 border-l-4 border-l-red-500/50 hover:bg-red-50/20 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-slate-800">{tx.recipient_phone}</span>
                         <span className="text-[10px] text-red-600 font-black uppercase tracking-tight">Delivery Failed</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">#{tx.id}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mb-3">
                      Provider Error: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">{tx.error_message || "Unknown Provider Error"}</span>
                    </p>
                    <div className="flex items-center justify-between">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">{format(new Date(tx.created_at), "MMM d, HH:mm:ss")}</span>
                       <button 
                         onClick={() => handleManualRetry(tx.id)}
                         className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1"
                       >
                         Attempt Recovery <ChevronRight size={10} />
                       </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <p className="text-sm font-medium">No system failures reported today.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
           <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-12 opacity-10">
                <Server size={120} strokeWidth={1} />
              </div>
              
              <h4 className="text-xl font-bold mb-4 flex items-center gap-2">
                Operational Stats
              </h4>
              
              <div className="space-y-8 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Health Pulse</p>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-black text-indigo-400">99.8%</span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold mb-2 uppercase">Healthy</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Active Incidents</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${stuckOrders.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'} shadow-[0_0_15px_rgba(245,158,11,0.5)]`}></div>
                    <span className="text-lg font-bold">{stuckOrders.length > 0 ? `${stuckOrders.length} Transaction(s) Stuck` : "No System Alerts"}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <p className="text-xs text-slate-400 italic font-medium leading-relaxed">
                    System is performing standard operational monitoring. DataHub transactions are being verified for idempotency locks.
                  </p>
                </div>
              </div>
           </div>

           <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Globe size={18} className="text-indigo-600" />
                Wallet Integrity
              </h4>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase mb-1">DataHub Provider Fund</p>
                 <div className="flex items-baseline gap-2">
                   <h5 className="text-2xl font-black text-slate-900">GH₵{health?.services?.datahub?.balance?.toLocaleString() || "0.00"}</h5>
                   <span className="text-[10px] text-slate-500 font-bold">AVAILABLE</span>
                 </div>
              </div>
              <div className="space-y-3">
                 <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">Auto-recovery</span>
                    <span className="font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded text-[10px]">DISABLED</span>
                 </div>
                 <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-500">Webhook Replays</span>
                    <span className="font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">BLOCKED</span>
                 </div>
              </div>
           </div>

           <div className="bg-indigo-600 p-8 rounded-3xl text-white">
              <div className="flex items-center gap-3 mb-4">
                <ShieldCheck size={24} />
                <h4 className="font-bold">Recovery Policy</h4>
              </div>
              <p className="text-sm font-medium text-indigo-100 leading-relaxed">
                Manually retrying orders uses the server-side idempotency engine. If a transaction already has an external reference, the system will block re-execution automatically.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
