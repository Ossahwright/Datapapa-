import { useState, useMemo } from "react";
import { 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  Info,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  MoreVertical,
  X,
  FileText,
  FileSpreadsheet
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";

interface TransactionIntelligenceProps {
  transactions: any[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const TransactionIntelligence = ({ 
  transactions: allTransactions, 
  isLoading, 
  onRefresh 
}: TransactionIntelligenceProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNetwork, setFilterNetwork] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const itemsPerPage = 15;

  // Filtering Logic
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(tx => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        tx.id?.toLowerCase().includes(searchLower) ||
        tx.recipient_phone?.includes(searchTerm) ||
        tx.payer_phone_number?.includes(searchTerm) ||
        tx.paystack_reference?.toLowerCase().includes(searchLower) ||
        tx.datahub_reference?.toLowerCase().includes(searchLower);

      const matchesNetwork = filterNetwork === "all" || tx.network === filterNetwork;
      const matchesStatus = filterStatus === "all" || tx.status === filterStatus;

      return matchesSearch && matchesNetwork && matchesStatus;
    });
  }, [allTransactions, searchTerm, filterNetwork, filterStatus]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const exportToCSV = () => {
    const headers = ["ID", "Date", "Recipient", "Network", "Bundle", "Amount", "Status", "Delivery"];
    const rows = filteredTransactions.map(tx => [
      tx.id,
      format(new Date(tx.created_at), "yyyy-MM-dd HH:mm:ss"),
      tx.recipient_phone,
      tx.network,
      tx.capacity || tx.volume,
      tx.amount,
      tx.status,
      tx.vtu_status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `datapapa-report-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    const colorMap: any = {
      success: "bg-emerald-50 text-emerald-700 border-emerald-100",
      completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
      failed: "bg-red-50 text-red-700 border-red-100",
      pending: "bg-amber-50 text-amber-700 border-amber-100",
      processing: "bg-blue-50 text-blue-700 border-blue-100"
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorMap[status?.toLowerCase()] || 'bg-slate-50 text-slate-700 border-slate-100'}`}>
        {status || 'N/A'}
      </span>
    );
  };

  return (
    <div className="mt-8">
      {/* Header & Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <History className="text-indigo-600" size={24} />
            Transaction Intelligence Ledger
          </h3>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
            >
              <Download size={18} />
              Export CSV
            </button>
            <button 
              onClick={onRefresh}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              title="Refresh Data"
            >
              <History size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search IDs, Phones, Refs..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select 
              value={filterNetwork}
              onChange={(e) => { setFilterNetwork(e.target.value); setCurrentPage(1); }}
              className="w-full py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Networks</option>
              <option value="MTN">MTN</option>
              <option value="TELECEL">Telecel</option>
              <option value="AIRTELTIGO">AirtelTigo</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-slate-400" />
            <select 
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="w-full py-2.5 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="text-right flex items-center justify-end">
            <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
              Showing {filteredTransactions.length} records
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Transaction ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Bundle</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-6 py-4"><div className="h-8 bg-slate-100 rounded-lg"></div></td>
                  </tr>
                ))
              ) : paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col anonymous-id-wrapper">
                        <span className="text-sm font-mono font-bold text-slate-700">#{tx.id.substring(0, 8)}</span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={tx.id}>{tx.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-600">
                        {format(new Date(tx.created_at), "MMM d, HH:mm")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700">{tx.recipient_phone}</span>
                        <span className="text-[10px] font-medium text-indigo-500 uppercase">{tx.network}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">
                        {tx.capacity || tx.volume || "N/A"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-900">
                        GHS {Number(tx.amount || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(tx.status)}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedTx(tx)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Info size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <AlertCircle size={48} className="opacity-20" />
                      <p className="text-lg font-medium">No transactions found matching your filters</p>
                      <button 
                        onClick={() => { setSearchTerm(""); setFilterNetwork("all"); setFilterStatus("all"); }}
                        className="text-indigo-600 text-sm font-bold hover:underline"
                      >
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-white border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedTx && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
                    <History size={20} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-800">Operational Audit</h4>
                    <p className="text-xs text-slate-500 font-mono">Ref: {selectedTx.id}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Core Info */}
                  <div className="space-y-6">
                    <section>
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Customer Context</h5>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Recipient</span>
                          <span className="text-sm font-bold text-slate-800">{selectedTx.recipient_phone}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Payer</span>
                          <span className="text-sm font-bold text-slate-800">{selectedTx.payer_phone_number || "Same"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Network</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 uppercase">{selectedTx.network}</span>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Order Details</h5>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Bundle</span>
                          <span className="text-sm font-bold text-slate-800">{selectedTx.capacity || selectedTx.volume}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Amount Paid</span>
                          <span className="text-sm font-bold text-slate-800">GHS {Number(selectedTx.amount).toFixed(2)}</span>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Technical Audit */}
                  <div className="space-y-6">
                    <section>
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Provider Audit</h5>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Payment Ref</span>
                          <span className="text-xs font-mono text-slate-600 truncate max-w-[120px]" title={selectedTx.paystack_reference}>{selectedTx.paystack_reference || "N/A"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">DataHub Ref</span>
                          <span className="text-xs font-mono text-slate-600 truncate max-w-[120px]" title={selectedTx.datahub_reference}>{selectedTx.datahub_reference || "N/A"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Delivery Status</span>
                          <span className={`text-xs font-bold ${selectedTx.vtu_status === 'success' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {selectedTx.vtu_status?.toUpperCase() || "PENDING"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Retry Count</span>
                          <span className="text-xs font-bold text-slate-800">{selectedTx.retry_count || 0}</span>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Lifecycle Events</h5>
                      <div className="space-y-3">
                        <div className="flex gap-3">
                          <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0"></div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">Payment Success</p>
                            <p className="text-[10px] text-slate-500">{format(new Date(selectedTx.created_at), "MMM d, HH:mm:ss")}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className={`mt-1 w-2 h-2 rounded-full ${selectedTx.vtu_status === 'success' ? 'bg-emerald-500' : 'bg-slate-300'} shrink-0`}></div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">Provider Hook Recieved</p>
                            <p className="text-[10px] text-slate-500">{selectedTx.updated_at ? format(new Date(selectedTx.updated_at), "MMM d, HH:mm:ss") : "Awaiting..."}</p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-800"
                >
                  Close
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                >
                  <FileText size={18} />
                  Print Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
