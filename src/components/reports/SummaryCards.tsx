import { motion } from "framer-motion";
import { 
  TrendingUp, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Database, 
  BarChart3,
  RefreshCw,
  Layers,
  BookOpen,
  Award
} from "lucide-react";

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  description?: string;
  trend?: {
    value: string;
    isUp: boolean;
  };
}

const SummaryCard = ({ title, value, icon: Icon, color, description, trend }: SummaryCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative overflow-hidden group"
  >
    <div className={`absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform`}>
      <Icon size={80} className={color} />
    </div>
    
    <div className="flex items-center gap-4 mb-4">
      <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{value}</h3>
      </div>
    </div>

    {(description || trend) && (
      <div className="flex items-center gap-2 mt-2">
        {trend && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trend.isUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            {trend.isUp ? "+" : ""}{trend.value}
          </span>
        )}
        <span className="text-xs text-slate-400 font-medium">{description}</span>
      </div>
    )}
  </motion.div>
);

interface KPI {
  totalRevenue: number;
  totalTransactions: number;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  totalDataSold: number;
  avgOrderValue: number;
  retryCount: number;
  airtimeRevenue?: number;
  airtimeTransactions?: number;
  hubtelRevenue?: number;
  hubtelTransactions?: number;
  beceRevenue?: number;
  beceTransactions?: number;
  wassceRevenue?: number;
  wassceTransactions?: number;
}

export const SummaryCards = ({ kpi }: { kpi: KPI }) => {
  const airtimeRev = kpi.airtimeRevenue || 0;
  const airtimeTxs = kpi.airtimeTransactions || 0;
  const hubtelRev = kpi.hubtelRevenue || 0;
  const hubtelTxs = kpi.hubtelTransactions || 0;
  const hubtelShare = kpi.totalRevenue > 0 ? (hubtelRev / kpi.totalRevenue) * 100 : 0;

  const beceRev = kpi.beceRevenue || 0;
  const beceTxs = kpi.beceTransactions || 0;
  const wassceRev = kpi.wassceRevenue || 0;
  const wassceTxs = kpi.wassceTransactions || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <SummaryCard 
        title="Total Revenue" 
        value={`GHS ${kpi.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        icon={TrendingUp}
        color="text-emerald-600"
        description="Lifetime earnings"
        trend={{ value: "12%", isUp: true }}
      />
      <SummaryCard 
        title="Total Volume" 
        value={kpi.totalTransactions.toLocaleString()}
        icon={Layers}
        color="text-indigo-600"
        description="Transactions processed"
      />
      <SummaryCard 
        title="Successful Delivery" 
        value={kpi.successCount.toLocaleString()}
        icon={CheckCircle2}
        color="text-blue-600"
        description={`${((kpi.successCount / (kpi.totalTransactions || 1)) * 100).toFixed(1)}% success rate`}
      />
      <SummaryCard 
        title="System Health" 
        value={kpi.failedCount.toLocaleString()}
        icon={AlertCircle}
        color="text-red-600"
        description="Failed transactions"
      />
      <SummaryCard 
        title="Pending Queue" 
        value={kpi.pendingCount.toLocaleString()}
        icon={Clock}
        color="text-amber-600"
        description="Orders in progress"
      />
      <SummaryCard 
        title="Data Sold" 
        value={`${kpi.totalDataSold.toFixed(1)} GB`}
        icon={Database}
        color="text-purple-600"
        description="Total capacity sold"
      />
      <SummaryCard 
        title="Avg. Transaction" 
        value={`GHS ${kpi.avgOrderValue.toFixed(2)}`}
        icon={BarChart3}
        color="text-slate-600"
        description="Per order average"
      />
      <SummaryCard 
        title="Retry Count" 
        value={kpi.retryCount.toLocaleString()}
        icon={RefreshCw}
        color="text-cyan-600"
        description="Automatic delivery retries"
      />

      {/* Hubtel and Airtime KPI metrics cards */}
      <SummaryCard 
        title="Airtime Revenue" 
        value={`GHS ${airtimeRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        icon={TrendingUp}
        color="text-purple-600"
        description="Total airtime sales revenue"
      />
      <SummaryCard 
        title="Airtime Transactions" 
        value={airtimeTxs.toLocaleString()}
        icon={Layers}
        color="text-violet-600"
        description="Airtime recharge purchases count"
      />
      <SummaryCard 
        title="Hubtel Airtime Rev" 
        value={`GHS ${hubtelRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        icon={TrendingUp}
        color="text-sky-600"
        description="Total Hubtel platform credit consumed"
      />
      <SummaryCard 
        title="Hubtel Share (%)" 
        value={`${hubtelShare.toFixed(1)}%`}
        icon={BarChart3}
        color="text-pink-600"
        description="Hubtel revenue share of total portfolio"
      />

      {/* WASSCE scorecard metrics */}
      <SummaryCard 
        title="WASSCE Revenue" 
        value={`GHS ${wassceRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        icon={Award}
        color="text-orange-600"
        description="WASSCE voucher purchase earnings"
      />
      <SummaryCard 
        title="WASSCE Vouchers Sold" 
        value={wassceTxs.toLocaleString()}
        icon={BookOpen}
        color="text-amber-700"
        description="Total WASSCE pins generated"
      />

      {/* BECE scorecard metrics */}
      <SummaryCard 
        title="BECE Revenue" 
        value={`GHS ${beceRev.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
        icon={Award}
        color="text-emerald-600"
        description="BECE voucher purchase earnings"
      />
      <SummaryCard 
        title="BECE Vouchers Sold" 
        value={beceTxs.toLocaleString()}
        icon={BookOpen}
        color="text-teal-700"
        description="Total BECE pins generated"
      />
    </div>
  );
};
