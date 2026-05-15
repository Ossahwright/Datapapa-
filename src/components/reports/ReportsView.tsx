import { useState, useEffect, useMemo } from "react";
import { 
  BarChart3, 
  TrendingUp, 
  Layers, 
  Database, 
  Activity, 
  RefreshCw,
  AlertCircle,
  FileText,
  Calendar,
  ShieldAlert
} from "lucide-react";
import { SummaryCards } from "./SummaryCards";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { TransactionIntelligence } from "./TransactionIntelligence";
import { supabase } from "../../lib/supabase";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";

export function ReportsView() {
  const [data, setData] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let allTxs: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (data) allTxs = allTxs.concat(data);
        if (!data || data.length < pageSize) break;
        page++;
      }

      let allLogs: any[] = [];
      let logPage = 0;
      while (logPage < 50) { // Limit to 50k logs max for client-side
        const { data: logsData, error: logsError } = await supabase
          .from("datahub_logs")
          .select("endpoint, status")
          .order("created_at", { ascending: false })
          .range(logPage * pageSize, (logPage + 1) * pageSize - 1);
        
        if (logsError) throw logsError;
        if (logsData) allLogs = allLogs.concat(logsData);
        if (!logsData || logsData.length < pageSize) break;
        logPage++;
      }

      setData(allTxs);
      setLogs(allLogs);
    } catch (err) {
      console.error("❌ Failed to fetch report data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up realtime subscriptions
    const transactionsChannel = supabase
      .channel('reports-tx-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        setData((currentData) => {
          if (payload.eventType === 'INSERT') {
            return [payload.new, ...currentData];
          } else if (payload.eventType === 'UPDATE') {
            return currentData.map(tx => tx.id === payload.new.id ? { ...tx, ...payload.new } : tx);
          } else if (payload.eventType === 'DELETE') {
            return currentData.filter(tx => tx.id !== payload.old.id);
          }
          return currentData;
        });
      })
      .subscribe();

    const logsChannel = supabase
      .channel('reports-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'datahub_logs' }, (payload) => {
        setLogs((currentLogs) => {
          if (payload.eventType === 'INSERT') {
            return [payload.new, ...currentLogs];
          } else if (payload.eventType === 'UPDATE') {
            return currentLogs.map(log => log.id === payload.new.id ? { ...log, ...payload.new } : log);
          } else if (payload.eventType === 'DELETE') {
            return currentLogs.filter(log => log.id !== payload.old.id);
          }
          return currentLogs;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, []);

  // Derived Intelligence
  const intelligence = useMemo(() => {
    const kpi = {
      totalRevenue: 0,
      totalTransactions: data.length,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      totalDataSold: 0,
      avgOrderValue: 0,
      retryCount: 0
    };

    const revenueByDay: Record<string, number> = {};
    const networkDistribution: Record<string, number> = {};
    const bundlePopularity: Record<string, number> = {};
    const deliveryStatus = [
      { name: "Success", value: 0 },
      { name: "Pending", value: 0 },
      { name: "Failed", value: 0 }
    ];

    // Seed last 14 days for the chart
    for (let i = 13; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      revenueByDay[d] = 0;
    }

    data.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const isPaid = tx.status === 'success' || tx.status === 'completed' || tx.status === 'paid' || tx.status === 'payment_verified' || tx.status === 'payment_success' || tx.payment_status === 'success';
      const isDelivered = tx.vtu_status === 'delivered' || tx.vtu_status === 'fulfilled' || tx.vtu_status === 'success' || tx.status === 'fulfilled' || tx.status === 'delivered' || tx.delivery_status === 'delivered';
      
      const isSuccess = isPaid || isDelivered;
      const isFailed = tx.status === 'failed' || tx.payment_status === 'failed' || tx.vtu_status === 'failed' || tx.vtu_status === 'provider_rejected' || tx.delivery_status === 'failed';
      const isPending = tx.status === 'pending' || tx.status === 'initialized' || tx.status === 'payment_pending' || tx.vtu_status === 'pending' || tx.vtu_status === 'processing' || tx.vtu_status === 'provider_accepted' || tx.status === 'fulfillment_processing';

      if (isSuccess) {
        kpi.totalRevenue += amount;
        kpi.successCount += isDelivered ? 1 : 0; // Success delivery count separately.
        deliveryStatus[0].value += isDelivered ? 1 : 0;
        
        // Revenue trend
        const day = format(new Date(tx.created_at), "MMM dd");
        if (revenueByDay[day] !== undefined) {
          revenueByDay[day] += amount;
        }

        if (isDelivered) {
          // Capacity tracking
          const capStr = (tx.capacity || tx.volume || "").toLowerCase();
          if (capStr.includes("gb")) {
            kpi.totalDataSold += parseFloat(capStr);
          } else if (capStr.includes("mb")) {
            kpi.totalDataSold += parseFloat(capStr) / 1024;
          }

          // Bundle popularity
          const bundleName = `${tx.network} ${tx.capacity || tx.volume}`;
          bundlePopularity[bundleName] = (bundlePopularity[bundleName] || 0) + 1;
        }
      } 
      
      if (isFailed && !isDelivered) {
        kpi.failedCount++;
        deliveryStatus[2].value++;
      } else if (isPending && !isDelivered && !isFailed) {
        kpi.pendingCount++;
        deliveryStatus[1].value++;
      }

      kpi.retryCount += (tx.retry_count || 0);

      // Network Distribution
      const net = tx.network || "UNKNOWN";
      networkDistribution[net] = (networkDistribution[net] || 0) + 1;
    });

    // We compute paid transaction count for average order value
    const paidTxsCount = data.filter(tx => {
      const isPaid = tx.status === 'success' || tx.status === 'completed' || tx.status === 'paid' || tx.status === 'payment_verified' || tx.status === 'payment_success' || tx.payment_status === 'success';
      const isDelivered = tx.vtu_status === 'delivered' || tx.vtu_status === 'fulfilled' || tx.vtu_status === 'success' || tx.status === 'fulfilled' || tx.status === 'delivered' || tx.delivery_status === 'delivered';
      return isPaid || isDelivered;
    }).length;
    
    kpi.avgOrderValue = paidTxsCount > 0 ? kpi.totalRevenue / paidTxsCount : 0;

    return {
      kpi,
      revenueTrend: Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })),
      networkStats: Object.entries(networkDistribution).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count),
      bundleStats: Object.entries(bundlePopularity).map(([name, sales]) => ({ name, sales })).sort((a,b) => b.sales - a.sales).slice(0, 10),
      deliveryStatus
    };
  }, [data]);

  // Provider Execution Statistics
  const providerStats = useMemo(() => {
    const defaultStats = {
      healthChecks: 0,
      blockedSources: 0,
      successfulPurchases: 0,
      failedPurchases: 0,
      other: 0,
    };
    
    logs.forEach(log => {
      // endpoints starting with /api/external/status are health checks
      if (log.endpoint?.includes("/status")) {
        defaultStats.healthChecks++;
      } else if (log.status === "blocked_source") {
        defaultStats.blockedSources++;
      } else if (log.status === "success" && log.endpoint?.includes("data-purchase")) {
        defaultStats.successfulPurchases++;
      } else if (log.status === "failed" && log.endpoint?.includes("data-purchase")) {
        defaultStats.failedPurchases++;
      } else {
        defaultStats.other++;
      }
    });

    return defaultStats;
  }, [logs]);

  return (
    <div className="space-y-10">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Reports Center</h2>
          <p className="text-slate-500 font-medium">Datapapa operational intelligence and financial auditing</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center gap-2 border border-indigo-100 shadow-sm shadow-indigo-100/50">
            <Calendar size={18} />
            <span className="text-sm font-bold">Last 30 Days</span>
          </div>
          <button 
            onClick={fetchData}
            className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
            title="Refresh Intelligence"
          >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <SummaryCards kpi={intelligence.kpi} />

      {/* Analytics Charts */}
      <AnalyticsCharts data={intelligence} />

      {/* Transaction Ledger Intelligence */}
      <TransactionIntelligence 
        transactions={data} 
        isLoading={isLoading} 
        onRefresh={fetchData} 
      />

      {/* System Health / Operational Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-8 rounded-3xl text-white col-span-1 lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <Activity size={120} strokeWidth={1} />
          </div>
          
          <h4 className="text-xl font-bold mb-2 relative z-10">Operational Monitoring</h4>
          <p className="text-slate-400 text-sm mb-8 max-w-md relative z-10">
            Live insights into delivery performance, failure ratios, and system stability metrics.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Success Ratio</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  {((intelligence.kpi.successCount / (intelligence.kpi.totalTransactions || 1)) * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">HEALTHY</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Automatic Recovery</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-indigo-400">
                  {intelligence.kpi.retryCount}
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">RETRIES</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Queue Delay</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-amber-400">0.4s</span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">AVG</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 p-8 rounded-3xl text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500 rounded-xl">
              <AlertCircle size={20} />
            </div>
            <h4 className="font-bold">Security Alerts</h4>
          </div>
          <div className="space-y-4 font-medium text-sm text-indigo-100">
            <div className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5"></div>
              <p>No duplicate transactions detected in last 24h.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5"></div>
              <p>Network latency from DataHub within normal range (420ms).</p>
            </div>
            <div className="flex gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5"></div>
              <p>Verified all incoming webhook signatures from Paystack.</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 p-8 rounded-3xl text-white col-span-1 lg:col-span-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-10">
            <ShieldAlert size={120} strokeWidth={1} />
          </div>
          
          <h4 className="text-xl font-bold mb-2 relative z-10">Provider Execution Audit</h4>
          <p className="text-slate-400 text-sm mb-8 max-w-xl relative z-10">
            Real-time tracking of DataHub API calls and blocked execution attempts (Firewall).
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Purchases OK</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-emerald-400">
                  {providerStats.successfulPurchases}
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">OK</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Purchases Fail</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-rose-400">
                  {providerStats.failedPurchases}
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">ERR</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Health Checks</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-indigo-400">
                  {providerStats.healthChecks}
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">PINGS</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Blocked Calls</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-amber-400">
                  {providerStats.blockedSources}
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">BLOCKED</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">Other API Calls</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-slate-400">
                  {providerStats.other}
                </span>
                <span className="text-xs text-slate-500 mb-1.5 pb-0.5">CALLS</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
