import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  LayoutDashboard, 
  Database, 
  CreditCard, 
  Users, 
  Settings, 
  Activity, 
  ArrowUpRight, 
  Search,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'transactions' | 'bundles' | 'customers'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<string | null>(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [bundles, setBundles] = useState<any[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const ITEMS_PER_PAGE = 10;
  const navigate = useNavigate();

  const [dashboardStats, setDashboardStats] = useState({ sales: 0, transactions: 0, users: 0 });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/admin/auth');
      } else {
        setUser(session.user);
        fetchDashboardStats();
      }
      setIsLoading(false);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/admin/auth');
      } else {
        setUser(session.user);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      // Fetch total sales
      const { data: salesData, error: salesError } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'success');

      if (!salesError && salesData) {
        const total = salesData.reduce((sum, tx) => sum + Number(tx.amount), 0);
        setDashboardStats(prev => ({ ...prev, sales: total }));
      }

      // Fetch transaction count
      const { count: txCount, error: txError } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true });
        
      if (!txError && txCount !== null) {
        setDashboardStats(prev => ({ ...prev, transactions: txCount }));
      }

      // Fetch active users count
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
        
      if (!usersError && usersCount !== null) {
         setDashboardStats(prev => ({ ...prev, users: usersCount }));
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (currentView === 'transactions') {
      const delayDebounceFn = setTimeout(() => {
        fetchTransactions();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else if (currentView === 'bundles') {
      fetchBundles();
    } else if (currentView === 'customers') {
      fetchCustomers();
    }
  }, [currentView, searchQuery, currentPage]);

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    const { data, error } = await supabase.rpc("get_customers_summary");

    if (error) {
      console.error("Customer fetch error:", error);
    } else {
      setCustomers(data || []);
    }
    setIsLoadingCustomers(false);
  };

  const fetchCustomerTransactions = async (phone: string) => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("recipient_phone", phone)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setCustomerTransactions(data || []);
  };

  useEffect(() => {
    if (selectedCustomerPhone) {
      fetchCustomerTransactions(selectedCustomerPhone);
    }
  }, [selectedCustomerPhone]);

  const fetchBundles = useCallback(async () => {
    setIsLoadingBundles(true);
    try {
      const { data, error } = await supabase
        .from('bundles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("FETCH ERROR:", error);
      } else if (data) {
        console.log("BUNDLES:", data);
        setBundles(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingBundles(false);
    }
  }, []);

  const handleUpdateBundle = async (bundleId: string, updates: any) => {
    console.log("UPDATING:", bundleId, updates);
    try {
      const { data, error } = await supabase
        .from('bundles')
        .update(updates)
        .eq('id', bundleId)
        .select();

      if (error) {
        console.error("UPDATE ERROR:", error);
        throw new Error(error.message);
      }
      
      console.log("UPDATE SUCCESS:", data);
      setEditingBundle(null);
      await fetchBundles();
    } catch (err: any) {
      console.error("Error updating bundle:", err);
      alert(`Failed to update bundle: ${err.message || 'Unknown error'}. Check if RLS policies for update are enabled in Supabase.`);
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    console.log("DELETE:", bundleId);
    if (!window.confirm("Delete this bundle?")) return;
    
    try {
      const { error } = await supabase
        .from('bundles')
        .delete()
        .eq('id', bundleId);

      if (error) {
        console.error("DELETE ERROR:", error);
        throw new Error(error.message);
      }
      
      await fetchBundles();
    } catch (err: any) {
      console.error("Error deleting bundle:", err);
      alert(`Failed to delete bundle: ${err.message || 'Unknown error'}. Check if RLS policies for delete are enabled in Supabase.`);
    }
  };

  const toggleBundleActive = async (bundleId: string, currentStatus: boolean) => {
    await handleUpdateBundle(bundleId, { is_active: !currentStatus });
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      let query = supabase
        .from('transactions')
        .select('*', { count: 'exact' });

      if (searchQuery) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchQuery);
        if (isUUID) {
          query = query.eq('id', searchQuery);
        } else {
          query = query.or(`recipient_phone.ilike.%${searchQuery}%,network.ilike.%${searchQuery}%,status.ilike.%${searchQuery}%,paystack_receipt.ilike.%${searchQuery}%`);
        }
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);
        
      if (error) {
        console.error("FETCH ERROR:", error);
      }
        
      if (!error && data) {
        console.log("FETCHED DATA:", data);
        setTransactions(data);
        if (count !== null) setTotalTransactions(count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [searchQuery, currentPage]);

  useEffect(() => {
    const txChannel = supabase
      .channel("transactions-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          console.log("REALTIME UPDATE:", payload);
          if (currentView === 'transactions') {
            fetchTransactions();
          }
          fetchDashboardStats();
        }
      )
      .subscribe();

    const bundlesChannel = supabase
      .channel("bundles-sync")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bundles",
        },
        () => {
          fetchBundles();
        }
      )
      .subscribe();

    const customersChannel = supabase
      .channel("customers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          if (currentView === 'customers') {
            fetchCustomers();
            if (selectedCustomerPhone) {
              fetchCustomerTransactions(selectedCustomerPhone);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(bundlesChannel);
      supabase.removeChannel(customersChannel);
    };
  }, [fetchTransactions, fetchDashboardStats, fetchBundles, currentView]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Activity className="animate-pulse text-indigo-500 h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white h-16 px-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center">
          <ShieldCheck className="h-6 w-6 text-indigo-400 mr-2" />
          <span className="font-bold text-lg tracking-tight">Admin Console</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Overlay/Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white flex flex-col transition-all duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isSidebarOpen ? 'w-64' : 'w-20'}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0 justify-between">
          <div className={`flex items-center overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 md:opacity-100 md:w-auto h-0 md:h-auto overflow-hidden'}`}>
            <ShieldCheck className="h-6 w-6 text-indigo-400 mr-2 shrink-0" />
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">Admin Console</span>
          </div>
          {!isSidebarOpen && (
            <ShieldCheck className="h-8 w-8 text-indigo-400 mx-auto hidden md:block" />
          )}
          {/* Close for mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 py-6 overflow-y-auto custom-scrollbar">
          <nav className="space-y-1 px-3">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'transactions', label: 'Transactions', icon: CreditCard },
              { id: 'bundles', label: 'Bundles', icon: Database },
              { id: 'customers', label: 'Customers', icon: Users },
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-all group relative ${
                  currentView === item.id 
                    ? 'bg-indigo-600/10 text-indigo-400' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={!isSidebarOpen ? item.label : ''}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${isSidebarOpen ? 'mr-3' : 'mx-auto'} ${currentView === item.id ? '' : 'text-slate-400 group-hover:text-white'}`} />
                {isSidebarOpen && <span>{item.label}</span>}
                {currentView === item.id && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                  />
                )}
              </button>
            ))}
            <button className={`w-full flex items-center px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg font-medium transition-all group ${!isSidebarOpen ? 'justify-center' : ''}`}>
              <Settings className={`h-5 w-5 shrink-0 ${isSidebarOpen ? 'mr-3' : ''} text-slate-400 group-hover:text-white transition-colors`} />
              {isSidebarOpen && <span>Settings</span>}
            </button>
          </nav>
        </div>

        {/* Sidebar Collapse Toggle Button (Desktop Only) */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute -right-3 top-20 bg-slate-800 text-slate-400 p-1 rounded-full border border-slate-700 hover:text-white hover:bg-slate-700 shadow-lg transition-colors z-50"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-3 mb-4 transition-all duration-300 ${isSidebarOpen ? 'px-2' : 'justify-center px-0'}`}>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
              {user?.email?.[0].toUpperCase() || 'A'}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-all ${!isSidebarOpen ? 'aspect-square p-0' : ''}`}
            title={!isSidebarOpen ? "Sign Out" : ''}
          >
            <LogOut size={16} className="shrink-0" />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ease-in-out p-4 md:p-8 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
        {currentView === 'dashboard' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
              <p className="text-slate-500 mt-1">Welcome {user?.user_metadata?.full_name || 'Admin'}. Here's what's happening today.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <div className="text-slate-500 font-medium text-sm mb-2">Total Sales</div>
                 <div className="text-3xl font-bold text-slate-900">₵{dashboardStats.sales.toFixed(2)}</div>
                 <div className="text-xs text-slate-400 mt-2 font-medium">All time successful</div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <div className="text-slate-500 font-medium text-sm mb-2">Transactions</div>
                 <div className="text-3xl font-bold text-slate-900">{dashboardStats.transactions}</div>
                 <div className="text-xs text-slate-400 mt-2 font-medium">All time</div>
               </div>
               <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                 <div className="text-slate-500 font-medium text-sm mb-2">Active Users</div>
                 <div className="text-3xl font-bold text-slate-900">{dashboardStats.users}</div>
                 <div className="text-xs text-slate-400 mt-2 font-medium">Registered</div>
               </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-900">Recent Transactions</h3>
              </div>
              <div className="p-8 text-center text-slate-500">
                <Activity className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                <p>Connect your database to view recent transactions here.</p>
              </div>
            </div>
          </motion.div>
        )}

        {currentView === 'transactions' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Master Transactions Ledger</h1>
                <p className="text-slate-500 mt-1">View and manage all customer data purchases.</p>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search transactions..." 
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Transaction ID</th>
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Paystack Receipt</th>
                      <th className="px-6 py-4">Network</th>
                      <th className="px-6 py-4">Capacity</th>
                      <th className="px-6 py-4">Payer</th>
                      <th className="px-6 py-4">Recipient</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 text-center">VTU Status</th>
                      <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingTransactions ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                          <Activity className="animate-spin text-indigo-500 h-8 w-8 mx-auto mb-3" />
                          <p>Loading transactions...</p>
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                          <Database className="text-slate-300 h-8 w-8 mx-auto mb-3" />
                          <p>No transactions found in the database.</p>
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                            {tx.id.substring(0, 8)}...{tx.id.substring(tx.id.length - 4)}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {new Date(tx.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">
                            {tx.paystack_receipt || 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {tx.network?.toLowerCase() === 'mtn' && (
                                <img src="https://i.postimg.cc/5NPHHMBJ/MTN-LOGO-1.png" alt="MTN" className="w-6 h-6 rounded-full object-cover" />
                              )}
                              {tx.network?.toLowerCase() === 'telecel' && (
                                <img src="https://i.postimg.cc/SRgWNYSf/TELECEL-LOGO-1.jpg" alt="Telecel" className="w-6 h-6 rounded-full object-cover" />
                              )}
                              {(tx.network?.toLowerCase() === 'airteltigo' || tx.network?.toLowerCase() === 'at') && (
                                <img src="https://i.postimg.cc/0yXPdkQf/AIRTELTIGO-LOGO-1.jpg" alt="AirtelTigo" className="w-6 h-6 rounded-full object-cover" />
                              )}
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider ${
                                tx.network?.toLowerCase() === 'mtn' ? 'bg-yellow-100 text-yellow-800' :
                                tx.network?.toLowerCase() === 'telecel' ? 'bg-red-100 text-red-800' :
                                tx.network?.toLowerCase() === 'airteltigo' || tx.network?.toLowerCase() === 'at' ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {tx.network || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-700">
                            {tx.capacity || 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {tx.payee_phone || 'N/A'}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900">
                            {tx.recipient_phone || 'N/A'}
                          </td>
                          <td className="px-6 py-4 text-right font-semibold text-slate-900">
                            ₵{Number(tx.amount || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              tx.vtu_status === 'success' || tx.vtu_status === 'completed' ? 'bg-green-100 text-green-700' :
                              tx.vtu_status === 'failed' ? 'bg-red-100 text-red-700' :
                              tx.vtu_status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {tx.vtu_status || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              tx.status === 'success' || tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                              tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                              tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {tx.status || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalTransactions > 0 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <div className="text-slate-500">
                    Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-semibold text-slate-900">{Math.min(currentPage * ITEMS_PER_PAGE, totalTransactions)}</span> of <span className="font-semibold text-slate-900">{totalTransactions}</span> transactions
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || isLoadingTransactions}
                      className="px-3 py-1.5 border border-slate-200 rounded-md font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={currentPage >= Math.ceil(totalTransactions / ITEMS_PER_PAGE) || isLoadingTransactions}
                      className="px-3 py-1.5 border border-slate-200 rounded-md font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {currentView === 'bundles' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Bundles Management</h1>
                <p className="text-slate-500 mt-1">Manage network data bundles, pricing, and availability.</p>
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Network</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Capacity</th>
                      <th className="px-6 py-4">Cost Price (₵)</th>
                      <th className="px-6 py-4">Selling Price (₵)</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingBundles ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          <Activity className="animate-spin text-indigo-500 h-8 w-8 mx-auto mb-3" />
                          <p>Loading bundles...</p>
                        </td>
                      </tr>
                    ) : bundles.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                          <Database className="text-slate-300 h-8 w-8 mx-auto mb-3" />
                          <p>No bundles found.</p>
                        </td>
                      </tr>
                    ) : (
                      bundles.map((bundle) => {
                        const isEditing = editingBundle?.id === bundle.id;
                        return (
                          <tr key={bundle.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">
                              <div className="flex items-center gap-3">
                                {bundle.network?.toLowerCase() === 'mtn' && (
                                  <img src="https://i.postimg.cc/5NPHHMBJ/MTN-LOGO-1.png" alt="MTN" className="w-8 h-8 rounded-full object-cover" />
                                )}
                                {bundle.network?.toLowerCase() === 'telecel' && (
                                  <img src="https://i.postimg.cc/SRgWNYSf/TELECEL-LOGO-1.jpg" alt="Telecel" className="w-8 h-8 rounded-full object-cover" />
                                )}
                                {(bundle.network?.toLowerCase() === 'airteltigo' || bundle.network?.toLowerCase() === 'at') && (
                                  <img src="https://i.postimg.cc/0yXPdkQf/AIRTELTIGO-LOGO-1.jpg" alt="AirtelTigo" className="w-8 h-8 rounded-full object-cover" />
                                )}
                                <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider ${
                                  bundle.network?.toLowerCase() === 'mtn' ? 'bg-yellow-100 text-yellow-800' :
                                  bundle.network?.toLowerCase() === 'telecel' ? 'bg-red-100 text-red-800' :
                                  bundle.network?.toLowerCase() === 'airteltigo' || bundle.network?.toLowerCase() === 'at' ? 'bg-blue-100 text-blue-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {bundle.network}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={editingBundle.description || ''}
                                  onChange={(e) => setEditingBundle({ ...editingBundle, description: e.target.value })}
                                  className="w-full min-w-[150px] px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                  placeholder="Description..."
                                />
                              ) : (
                                bundle.description || '-'
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  value={editingBundle.capacity}
                                  onChange={(e) => setEditingBundle({ ...editingBundle, capacity: e.target.value })}
                                  className="w-24 px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                              ) : (
                                <span className="text-slate-900">{bundle.capacity}</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {isEditing ? (
                                <div className="flex items-center">
                                  <span className="mr-1">₵</span>
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    value={editingBundle.cost_price || ''}
                                    onChange={(e) => setEditingBundle({ ...editingBundle, cost_price: parseFloat(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                  />
                                </div>
                              ) : (
                                bundle.cost_price != null ? `₵${Number(bundle.cost_price).toFixed(2)}` : '-'
                              )}
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-900">
                              {isEditing ? (
                                <div className="flex items-center">
                                  <span className="mr-1">₵</span>
                                  <input 
                                    type="number" 
                                    step="0.01"
                                    value={editingBundle.selling_price}
                                    onChange={(e) => setEditingBundle({ ...editingBundle, selling_price: parseFloat(e.target.value) || 0 })}
                                    className="w-20 px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                  />
                                </div>
                              ) : (
                                `₵${Number(bundle.selling_price).toFixed(2)}`
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() => toggleBundleActive(bundle.id, bundle.is_active)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                  bundle.is_active ? 'bg-green-500' : 'bg-slate-300'
                                }`}
                                role="switch"
                                aria-checked={bundle.is_active}
                              >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  bundle.is_active ? 'translate-x-6' : 'translate-x-1'
                                }`} />
                              </button>
                              <span className="ml-2 text-xs font-medium text-slate-500">
                                {bundle.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {isEditing ? (
                                  <>
                                    <button 
                                      onClick={() => handleUpdateBundle(bundle.id, { description: editingBundle.description, capacity: editingBundle.capacity, cost_price: editingBundle.cost_price, selling_price: editingBundle.selling_price })}
                                      className="text-xs font-medium px-3 py-1 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors"
                                    >
                                      Save
                                    </button>
                                    <button 
                                      onClick={() => setEditingBundle(null)}
                                      className="text-xs font-medium px-3 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 opacity-80 hover:opacity-100 rounded-md transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button 
                                      onClick={() => setEditingBundle({ ...bundle })}
                                      className="text-indigo-600 hover:text-indigo-800 font-medium text-xs px-2 py-1"
                                    >
                                      Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteBundle(bundle.id)}
                                      className="text-red-500 hover:text-red-700 font-medium text-xs px-2 py-1"
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
        {currentView === 'customers' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
                <p className="text-slate-500 mt-1">View customer summaries and their recent transactions.</p>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  placeholder="Search by phone..." 
                  className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customers List */}
              <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px] max-h-[700px]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-semibold text-slate-800">Customer List</h3>
                </div>
                <div className="overflow-y-auto flex-1">
                  {isLoadingCustomers ? (
                    <div className="p-8 text-center text-slate-500">
                      <Activity className="animate-spin text-indigo-500 h-8 w-8 mx-auto mb-3" />
                      <p>Loading customers...</p>
                    </div>
                  ) : customers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <Users className="text-slate-300 h-8 w-8 mx-auto mb-3" />
                      <p>No customers found.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {customers
                        .filter(c => c.recipient_phone?.includes(customerSearchQuery))
                        .map(customer => (
                        <li key={customer.recipient_phone}>
                          <button
                            onClick={() => setSelectedCustomerPhone(customer.recipient_phone)}
                            className={`w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors ${selectedCustomerPhone === customer.recipient_phone ? 'bg-indigo-50/50' : ''}`}
                          >
                            <div className="font-semibold text-slate-900">{customer.recipient_phone || 'Unknown'}</div>
                            <div className="flex justify-between items-center mt-1">
                              <div className="text-xs text-slate-500">{customer.transaction_count} transaction{customer.transaction_count > 1 ? 's' : ''}</div>
                              <div className="text-sm font-medium text-indigo-700">₵{Number(customer.total_spent).toFixed(2)}</div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Transactions for Selected Customer */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px] max-h-[700px]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">
                    {selectedCustomerPhone ? `Transactions for ${selectedCustomerPhone}` : 'Select a customer'}
                  </h3>
                </div>
                <div className="overflow-y-auto flex-1 p-6">
                  {!selectedCustomerPhone ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <CreditCard className="h-12 w-12 text-slate-200 mb-4" />
                      <p>Select a customer from the list to view their transactions.</p>
                    </div>
                  ) : customerTransactions.length === 0 ? (
                     <div className="h-full flex flex-col items-center justify-center text-slate-500">
                       <Activity className="animate-spin text-indigo-500 h-8 w-8 mb-4" />
                       <p>Loading transactions...</p>
                     </div>
                  ) : (
                    <div className="space-y-4">
                      {customerTransactions.map(tx => (
                        <div key={tx.id} className="border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                               <div className="font-semibold text-slate-900">{tx.network} - {tx.capacity}</div>
                               <div className="text-xs text-slate-500">{new Date(tx.created_at).toLocaleString()}</div>
                            </div>
                            <div className="font-bold text-slate-900">₵{Number(tx.amount).toFixed(2)}</div>
                          </div>
                          <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-50">
                            <div className="text-xs font-mono text-slate-400">Ref: {tx.paystack_receipt || tx.id.substring(0, 8)}</div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                tx.status === 'success' || tx.status === 'completed' ? 'bg-green-100 text-green-700' :
                                tx.status === 'failed' ? 'bg-red-100 text-red-700' :
                                tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {tx.status || 'N/A'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function ShieldCheckIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2.5 0 4.5 1 6.5 2a1 1 0 0 1 1 1v7z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}
