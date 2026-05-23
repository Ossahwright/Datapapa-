import { useState, useEffect, useMemo } from "react";
import { 
  Calendar, 
  ChevronDown, 
  Check, 
  FileText, 
  Filter, 
  SlidersHorizontal, 
  CheckCircle2, 
  BookOpen, 
  Users, 
  Gift, 
  Activity, 
  ListOrdered, 
  Sparkles, 
  RefreshCw,
  Phone,
  MapPin,
  Hash
} from "lucide-react";
import { SummaryCards } from "./SummaryCards";
import { AnalyticsCharts } from "./AnalyticsCharts";
import { TransactionIntelligence } from "./TransactionIntelligence";
import { supabase } from "../../lib/supabase";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { PdfPreviewModal } from "./PdfPreviewModal";

type DateFilterType = "today" | "yesterday" | "7d" | "30d" | "all";

export function ReportsView() {
  const [data, setData] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<DateFilterType>("30d");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Checkboxes state for PDF custom compilation section choices
  const [selectedSections, setSelectedSections] = useState({
    coverPage: true,
    kpiSummary: true,
    bundles: true,
    customers: true,
    rewards: true,
    systemHealth: true,
    transactions: true,
  });

  const toggleSection = (key: keyof typeof selectedSections) => {
    setSelectedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const getDateRange = () => {
    const now = new Date();
    switch (dateFilter) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now), label: "Today" };
      case "yesterday":
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)), label: "Yesterday" };
      case "7d":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now), label: "Last 7 Days" };
      case "30d":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now), label: "Last 30 Days" };
      case "all":
      default:
        return { start: new Date(2020, 0, 1), end: endOfDay(now), label: "All Time" };
    }
  };

  const { start: startDate, end: endDate, label: dateRangeLabel } = getDateRange();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let allTxs: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data: txsData, error } = await supabase
          .from("transactions")
          .select("*")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (txsData) allTxs = allTxs.concat(txsData);
        if (!txsData || txsData.length < pageSize) break;
        page++;
      }

      setData(allTxs);

      try {
        const { data: bData } = await supabase.from("bundles").select("*").order("network", { ascending: true });
        if (bData) setBundles(bData);
      } catch (e) {
        console.warn("Could not load bundles for report:", e);
      }

      try {
        const { data: rData } = await supabase.from("appreciation_rewards").select("*").order("created_at", { ascending: false });
        if (rData) setRewards(rData);
      } catch (e) {
        console.warn("Could not load rewards for report:", e);
      }
    } catch (err) {
      console.error("❌ Failed to fetch report data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const transactionsChannel = supabase
      .channel('reports-tx-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        const newTx = payload.new as any;
        const oldTx = payload.old as any;
        const createdDate = new Date(newTx?.created_at || oldTx?.created_at);
        if (createdDate >= startDate && createdDate <= endDate) {
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
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsChannel);
    };
  }, [dateFilter]);

  // Hook up window.triggerPdfExport for TransactionIntelligence button trigger
  useEffect(() => {
    (window as any).triggerPdfExport = () => {
      setShowPdfPreview(true);
    };
    return () => {
      delete (window as any).triggerPdfExport;
    };
  }, []);

  // Filter transaction dataset client-side for dynamic dashboard and compile responsiveness
  const filteredData = useMemo(() => {
    return data.filter(tx => {
      // 1. Network Filter
      if (networkFilter !== "all") {
        const net = String(tx.network || "").toUpperCase();
        if (networkFilter === "mtn" && !net.includes("MTN")) return false;
        if (networkFilter === "telecel" && !(net.includes("TELECEL") || net.includes("VODAFONE") || net.includes("TELECEL"))) return false;
        if (networkFilter === "airteltigo" && !(net.includes("AIRTEL") || net.includes("TIGO"))) return false;
      }

      // 2. Fulfillment Status Filter
      if (statusFilter !== "all") {
        const displayStatus = String(tx.vtu_status || tx.status || 'pending').toLowerCase();
        const isPaid = tx.status === 'success' || tx.status === 'completed' || tx.status === 'paid' || tx.status === 'payment_verified' || tx.status === 'payment_success' || tx.payment_status === 'success';
        const isDelivered = tx.vtu_status === 'delivered' || tx.vtu_status === 'fulfilled' || tx.vtu_status === 'success' || tx.status === 'fulfilled' || tx.status === 'delivered' || tx.delivery_status === 'delivered';
        const isSuccess = isPaid || isDelivered;
        const isFailed = displayStatus === 'failed' || displayStatus === 'provider_rejected' || displayStatus === 'error' || tx.status === 'failed' || tx.payment_status === 'failed';
        const isPending = !isSuccess && !isFailed;

        if (statusFilter === "success" && !isSuccess) return false;
        if (statusFilter === "failed" && !isFailed) return false;
        if (statusFilter === "pending" && !isPending) return false;
      }

      return true;
    });
  }, [data, networkFilter, statusFilter]);

  // Compute analytics dynamically from filtered dataset
  const filteredIntelligence = useMemo(() => {
    const kpi = {
      totalRevenue: 0,
      totalTransactions: filteredData.length,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      totalDataSold: 0,
      avgOrderValue: 0,
      retryCount: 0,
      mtnTransactions: 0,
      airtelTigoTransactions: 0,
      telecelTransactions: 0
    };

    const revenueByDay: Record<string, number> = {};
    const networkDistribution: Record<string, { count: number; revenue: number }> = {};
    const bundlePopularity: Record<string, number> = {};
    const customerMap: Record<string, { phone: string; totalSpend: number; count: number; successCount: number; networks: Record<string, number>; lastTx: string }> = {};
    const deliveryStatus = [
      { name: "Success", value: 0 },
      { name: "Pending", value: 0 },
      { name: "Failed", value: 0 }
    ];

    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      revenueByDay[d] = 0;
    }

    filteredData.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const net = String(tx.network || "UNKNOWN").toUpperCase();
      
      const isPaid = tx.status === 'success' || tx.status === 'completed' || tx.status === 'paid' || tx.status === 'payment_verified' || tx.status === 'payment_success' || tx.payment_status === 'success';
      const isDelivered = tx.vtu_status === 'delivered' || tx.vtu_status === 'fulfilled' || tx.vtu_status === 'success' || tx.status === 'fulfilled' || tx.status === 'delivered' || tx.delivery_status === 'delivered';
      
      const isSuccess = isPaid || isDelivered;
      const displayStatus = String(tx.vtu_status || tx.status || 'pending').toLowerCase();
      const isFailed = displayStatus === 'failed' || displayStatus === 'provider_rejected' || displayStatus === 'error' || tx.status === 'failed' || tx.payment_status === 'failed';
      const isPending = !isSuccess && !isFailed;

      const phone = tx.payer_phone_number || tx.payer_phone || tx.recipient_phone || "Unknown";
      if (!customerMap[phone]) {
        customerMap[phone] = { phone, totalSpend: 0, count: 0, successCount: 0, networks: {}, lastTx: tx.created_at };
      }
      customerMap[phone].count++;
      if (isSuccess) {
        customerMap[phone].totalSpend += amount;
        customerMap[phone].successCount++;
      }
      customerMap[phone].networks[net] = (customerMap[phone].networks[net] || 0) + 1;

      if (net.includes("MTN")) kpi.mtnTransactions++;
      else if (net.includes("AIRTEL") || net.includes("TIGO")) kpi.airtelTigoTransactions++;
      else if (net.includes("TELECEL") || net.includes("VODAFONE") || net.includes("TELECEL")) kpi.telecelTransactions++;

      if (!networkDistribution[net]) networkDistribution[net] = { count: 0, revenue: 0 };
      networkDistribution[net].count++;

      if (isSuccess) {
        kpi.totalRevenue += amount;
        kpi.successCount++; 
        deliveryStatus[0].value++;
        networkDistribution[net].revenue += amount;

        const day = format(new Date(tx.created_at), "MMM dd");
        if (revenueByDay[day] !== undefined) {
          revenueByDay[day] += amount;
        }

        const capStr = (tx.capacity || tx.volume || "").toLowerCase();
        if (capStr.includes("gb")) {
          kpi.totalDataSold += parseFloat(capStr);
        } else if (capStr.includes("mb")) {
          kpi.totalDataSold += parseFloat(capStr) / 1024;
        }

        const bundleName = `${tx.network} ${tx.capacity || tx.volume}`;
        bundlePopularity[bundleName] = (bundlePopularity[bundleName] || 0) + 1;
      } else if (isFailed) {
        kpi.failedCount++;
        deliveryStatus[2].value++;
      } else if (isPending) {
        kpi.pendingCount++;
        deliveryStatus[1].value++;
      }

      kpi.retryCount += (tx.retry_count || 0);
    });

    const completionCount = kpi.successCount;
    kpi.avgOrderValue = completionCount > 0 ? kpi.totalRevenue / completionCount : 0;

    const topSpenders = Object.values(customerMap)
      .map(c => {
        let favoriteNet = "Other";
        let maxCount = 0;
        Object.entries(c.networks).forEach(([net, count]) => {
          if (count > maxCount) {
            maxCount = count;
            favoriteNet = net;
          }
        });
        return {
          phone: c.phone,
          totalSpend: c.totalSpend,
          count: c.count,
          successCount: c.successCount,
          lastTx: c.lastTx,
          favoriteNetwork: favoriteNet
        };
      })
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    const totalUniqueCustomers = Object.keys(customerMap).length;
    const averageSpendPerCustomer = totalUniqueCustomers > 0 ? kpi.totalRevenue / totalUniqueCustomers : 0;

    return {
      kpi,
      revenueTrend: Object.entries(revenueByDay).map(([date, amount]) => ({ date, amount })),
      networkStats: Object.entries(networkDistribution).map(([name, stats]) => ({ name, ...stats })).sort((a,b) => b.count - a.count),
      bundleStats: Object.entries(bundlePopularity).map(([name, sales]) => ({ name, sales })).sort((a,b) => b.sales - a.sales).slice(0, 10),
      deliveryStatus,
      topSpenders,
      totalUniqueCustomers,
      averageSpendPerCustomer
    };
  }, [filteredData]);

  return (
    <div className="space-y-8 pb-12 animate-fade-in font-sans">
      
      {/* 1. Header View */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        {/* Decorative background accent */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl pointer-events-none -z-10" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-4xl font-extrabold tracking-widest text-slate-100 bg-slate-900 px-4 py-1.5 rounded-2xl font-sans">DATAPAPA</span>
            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-[9px] px-2.5 py-1 rounded-full uppercase tracking-widest hidden sm:inline-block">
              Security Ledger & Operations Compliance
            </span>
          </div>
          <p className="text-slate-500 font-semibold text-sm max-w-xl">
            P.o.box MP 3131 Accra, 0244014207, 0550143506 • Global transactional reports portal & analytics console.
          </p>
        </div>

        {/* Corporate Address & Hotlines Block */}
        <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 space-y-1.5 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2 font-black">
            <MapPin size={14} className="text-indigo-500 shrink-0" />
            <span>P.o.box MP 3131 Accra, Ghana</span>
          </div>
          <div className="flex items-center gap-2 font-black">
            <Phone size={14} className="text-emerald-500 shrink-0" />
            <span>0244014207, 0550143506</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-slate-400 text-[10px] pt-1">
            <span className="bg-slate-100 px-2 py-0.5 rounded">SYSTEM CODE: DP-SEC-ACCRA</span>
          </div>
        </div>
      </div>

      {/* 2. Dossier Compiler Console with Filters and Interactive Checkboxes */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        {/* Abstract background decorative orb */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6 relative">
          <div className="p-2.5 bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 rounded-xl">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-white uppercase">Dossier Compiler Control Hub</h3>
            <p className="text-indigo-200/60 text-xs">Configure filter presets and choose corporate portfolios to synthesize into an industry-grade ledger.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative">
          
          {/* Column A: Filters Preset */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <Filter size={12} />
              Set Intelligence Scope Filters
            </h4>
            
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              
              {/* Filter 1: Date Scope Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Temporal Boundary (Range)</label>
                <div className="relative">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="w-full px-4 py-3 bg-slate-950/80 hover:bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-left font-semibold flex items-center justify-between text-indigo-100 transition-all shadow-inner"
                  >
                    <span className="flex items-center gap-2">
                      <Calendar size={14} className="text-indigo-400 font-bold" />
                      <span>{dateRangeLabel}</span>
                    </span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>

                  {showFilterDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 py-1 max-h-48 overflow-y-auto">
                      {[
                        { id: 'today', label: 'Today Only' },
                        { id: 'yesterday', label: 'Yesterday Only' },
                        { id: '7d', label: 'Last 7 Days (Digest)' },
                        { id: '30d', label: 'Last 30 Days (Comprehensive)' },
                        { id: 'all', label: 'All Historic Stream Records' }
                      ].map(filter => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => {
                            setDateFilter(filter.id as DateFilterType);
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full px-4 py-2.5 text-xs text-left font-semibold transition-colors hover:bg-indigo-950 ${dateFilter === filter.id ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-400'}`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Filter 2 & 3: Carrier Network and Channel Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Carrier Network Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carrier Channel</label>
                  <select
                    value={networkFilter}
                    onChange={(e) => setNetworkFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-0 focus:outline-none rounded-xl text-xs text-indigo-100 font-semibold cursor-pointer "
                  >
                    <option value="all">🌐 All Channels</option>
                    <option value="mtn">MTN Network</option>
                    <option value="telecel">Telecel (Vodafone)</option>
                    <option value="airteltigo">AirtelTigo</option>
                  </select>
                </div>

                {/* Fulfillment Status Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fulfillment State</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 focus:ring-0 focus:outline-none rounded-xl text-xs text-indigo-100 font-semibold cursor-pointer"
                  >
                    <option value="all">📊 All Records</option>
                    <option value="success">✅ Delivered / Fulfilled</option>
                    <option value="pending">⏳ Pending Queue</option>
                    <option value="failed">❌ Failed / Reject</option>
                  </select>
                </div>

              </div>

            </div>
          </div>

          {/* Column B: Report Sections Selection portolios checklist */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 leading-none">
              <CheckCircle2 size={12} />
              Set Portfolios for Output
            </h4>
            
            <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "coverPage", label: "Executive Cover Page", desc: "Corporate cover sheet & ledger metadata", icon: BookOpen },
                { key: "kpiSummary", label: "Financial KPI summary", desc: "Sales totals, conversion ratios, data metrics", icon: CheckCircle2 },
                { key: "bundles", label: "Carrier Pricing & Catalog", desc: "Cost pricing matrices and product catalogue", icon: Hash },
                { key: "customers", label: "Loyal customer rankings", desc: "Spend metrics, unique customer indices", icon: Users },
                { key: "rewards", label: "Appreciation promos ledger", desc: "Fulfillment logs for raffle rewards", icon: Gift },
                { key: "systemHealth", label: "Infrastructure Telemetry", desc: "Request latencies & firewall log profiles", icon: Activity },
                { key: "transactions", label: "Transaction master log", desc: "Detailed chronological sheet (up to top 100)", icon: ListOrdered },
              ].map(sec => {
                const checked = selectedSections[sec.key as keyof typeof selectedSections];
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.key}
                    onClick={() => toggleSection(sec.key as keyof typeof selectedSections)}
                    className={`flex items-start text-left gap-3 p-3 rounded-xl border transition-all ${
                      checked 
                        ? "bg-indigo-950/60 border-indigo-500/40 text-indigo-100 shadow-[0_0_15px_rgba(79,70,229,0.1)]" 
                        : "bg-transparent border-slate-800 hover:border-slate-700 hover:bg-slate-900/30 text-slate-400"
                    }`}
                  >
                    <div className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      checked ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-700 bg-slate-950"
                    }`}>
                      {checked && <Check size={11} strokeWidth={4} />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Icon size={10} className={checked ? "text-indigo-400" : "text-slate-500"} />
                        <span className="text-[11px] font-black tracking-tight uppercase leading-none">{sec.label}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 font-semibold leading-normal mt-1.5 truncate">{sec.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Compiler Action Row */}
        <div className="mt-8 border-t border-slate-800/80 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-indigo-200/80 font-semibold bg-indigo-950/40 border border-indigo-900/40 px-4 py-2.5 rounded-xl">
            <Sparkles size={14} className="text-indigo-400 animate-pulse" />
            <span>
              Compilation Scope: <strong className="text-white bg-indigo-900 px-2.5 py-0.5 rounded shadow-sm">{filteredData.length} matches</strong> mapped inside temporal range.
            </span>
          </div>

          <button
            onClick={() => setShowPdfPreview(true)}
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-xl shadow-indigo-650/20 active:scale-95 hover:shadow-indigo-600/30 transition-all text-sm shrink-0"
          >
            <FileText size={16} />
            <span>Generate Integrity Report</span>
          </button>
        </div>

      </div>

      {isLoading ? (
        <div className="bg-white border border-slate-100 rounded-3xl p-16 text-center flex flex-col items-center justify-center space-y-4 shadow-sm">
          <RefreshCw size={36} className="text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-black text-sm">Querying secure SQL database records...</p>
        </div>
      ) : (
        <>
          {/* Dynamic Live Preview dashboard indicators */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <SlidersHorizontal size={12} className="text-indigo-500" />
                Live compiled monitoring stats (Filtered preview state)
              </h3>
              <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                Real-time Sync Active
              </span>
            </div>
            
            {/* KPI scorecard summary cards */}
            <SummaryCards kpi={filteredIntelligence.kpi} />

            {/* Analytics charts with filtered intelligence data */}
            <AnalyticsCharts data={filteredIntelligence} />
          </div>

          {/* Detailed transactions ledger section */}
          <TransactionIntelligence 
            transactions={filteredData} 
            isLoading={isLoading} 
            onRefresh={fetchData} 
          />
        </>
      )}

      {/* Compiler Portal Modal */}
      <PdfPreviewModal
        isOpen={showPdfPreview}
        onClose={() => setShowPdfPreview(false)}
        data={filteredData}
        kpi={filteredIntelligence.kpi}
        dateRangeLabel={dateRangeLabel}
        generatedBy="Admin Executive"
        networkStats={filteredIntelligence.networkStats}
        deliveryStats={filteredIntelligence.deliveryStatus}
        bundles={bundles}
        rewards={rewards}
        customerStats={{
          topSpenders: filteredIntelligence.topSpenders,
          totalUniqueCustomers: filteredIntelligence.totalUniqueCustomers,
          averageSpendPerCustomer: filteredIntelligence.averageSpendPerCustomer
        }}
        selectedSections={selectedSections}
      />

    </div>
  );
}
