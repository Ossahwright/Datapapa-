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
  Layers
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
}

export const SummaryCards = ({ kpi }: { kpi: KPI }) => {
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
    </div>
  );
};
