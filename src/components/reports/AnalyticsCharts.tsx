import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  PieChart, 
  Pie 
} from "recharts";
import { motion } from "framer-motion";
import React from "react";

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

const ChartCard = ({ title, children }: ChartCardProps) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm"
  >
    <h3 className="text-lg font-bold text-slate-800 mb-6">{title}</h3>
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children as any}
      </ResponsiveContainer>
    </div>
  </motion.div>
);

export const AnalyticsCharts = ({ data }: { data: any }) => {
  const { revenueTrend, networkStats, bundleStats, deliveryStatus } = data;

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Revenue Trend */}
      <ChartCard title="Revenue Growth (Daily)">
        <AreaChart data={revenueTrend}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#64748b" }}
            minTickGap={30}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#64748b" }}
            tickFormatter={(val) => `GH₵${val}`}
          />
          <Tooltip 
            contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
          />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorRevenue)" 
          />
        </AreaChart>
      </ChartCard>

      {/* Network Distribution */}
      <ChartCard title="Transactions by Network">
        <BarChart data={networkStats} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 12, fill: "#64748b", fontWeight: 600 }}
          />
          <Tooltip cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {networkStats.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ChartCard>

      {/* Delivery Status */}
      <ChartCard title="Delivery Success Ratio">
        <PieChart>
          <Pie
            data={deliveryStatus}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {deliveryStatus.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={entry.name === 'Success' ? '#10b981' : entry.name === 'Failed' ? '#ef4444' : '#f59e0b'} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ChartCard>

      {/* Bundle Popularity */}
      <ChartCard title="Top Selling Bundles">
        <BarChart data={bundleStats}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: "#64748b" }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#64748b" }} />
          <Tooltip />
          <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>
    </div>
  );
};
