import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ReportsView } from "../components/reports/ReportsView";
import { SystemHealthView } from "../components/admin/SystemHealthView";
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
  PanelLeft,
  MessageSquare,
  Wallet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  History,
  Clock,
  FilterX,
  Home,
  Lock,
  Unlock,
  BarChart3,
  ShieldAlert,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { openWhatsApp, isValidPhoneNumber } from "../lib/whatsapp";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentView, setCurrentView] = useState<
    "dashboard" | "transactions" | "bundles" | "customers" | "settings" | "reports" | "system-health"
  >("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [selectedCustomerPhone, setSelectedCustomerPhone] = useState<
    string | null
  >(null);
  const [customerTransactions, setCustomerTransactions] = useState<any[]>([]);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);

  const [bundles, setBundles] = useState<any[]>([]);
  const [isLoadingBundles, setIsLoadingBundles] = useState(false);
  const [lastBundlesSync, setLastBundlesSync] = useState<string>(
    new Date().toLocaleTimeString(),
  );
  const [editingBundle, setEditingBundle] = useState<any>(null);
  const [selectedBundle, setSelectedBundle] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    network: "",
    network_key: "",
    datahub_network_key: "",
    datahub_capacity: "",
    capacity: "",
    volume: "",
    description: "",
    selling_price: "",
    cost_price: "",
    is_active: true,
  });
  const [bundleToDelete, setBundleToDelete] = useState<any>(null);
  const [isAddingBundle, setIsAddingBundle] = useState(false);
  const [newBundle, setNewBundle] = useState({
    network: "MTN",
    network_key: "YELLO",
    datahub_network_key: "",
    datahub_capacity: "",
    capacity: "",
    volume: "",
    description: "",
    selling_price: "",
    cost_price: "",
    is_active: true,
  });
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [viewingCustomerTransactions, setViewingCustomerTransactions] =
    useState<any>(null);
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [isDataHubLocked, setIsDataHubLocked] = useState(true);
  const [lastDataRefresh, setLastDataRefresh] = useState<string | null>(null);
  const ADMIN_SUPPORT_NUMBER = "233244014207";

  // Filters State
  const [filterNetwork, setFilterNetwork] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDelivery, setFilterDelivery] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // App Settings State
  const [appSettings, setAppSettings] = useState({
    app_name: "Datapapa",
    currency: "GHS",
    support_email: "support@datapapa.com",
    maintenance_mode: false,
  });
  const [secureSettings, setSecureSettings] = useState({
    datahub_api_key: "",
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [serverStatus, setServerStatus] = useState<"checking" | "up" | "down">(
    "checking",
  );

  // DataHub Integration State
  const [dataHubSettings, setDataHubSettings] = useState({
    base_url: "https://app.datahubgh.com/api/external",
    api_key: "",
    status: "inactive",
  });
  const [dataHubBalance, setDataHubBalance] = useState<number | null>(null);
  const [dataHubPing, setDataHubPing] = useState<number | null>(null);
  const [isRefreshingDataHub, setIsRefreshingDataHub] = useState(false);
  const [dataHubLogs, setDataHubLogs] = useState<any[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);

  // Health & KPIs State
  const [health, setHealth] = useState({ datahub: false, lastChecked: "" });
  const [kpi, setKpi] = useState({
    total: 0,
    revenue: 0,
    success: 0,
    failed: 0,
  });
  const [rows, setRows] = useState<any[]>([]);

  const [providerSettings, setProviderSettings] = useState<any>(null);

  const fetchProviderSettings = async () => {
    try {
      const { data } = await supabase
        .from("provider_settings")
        .select("*")
        .eq("provider_name", "datahubgh")
        .maybeSingle();
      if (data) {
        setProviderSettings(data);
        if (data.wallet_balance !== null) {
          setDataHubBalance(data.wallet_balance);
        }
      }
    } catch (err) {
      console.error("❌ [Admin] Fetch provider settings error:", err);
    }
  };

  const syncWallet = async () => {
    if (providerSettings && providerSettings.last_synced_at) {
      const lastSynced = new Date(providerSettings.last_synced_at).getTime();
      const now = Date.now();
      if (now - lastSynced < 10000) {
        alert("Please wait before syncing again");
        return;
      }
    }

    setIsRefreshingDataHub(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await fetch("/api/sync-datahub-wallet", {
        method: "POST",
        headers: headers as any
      });

      const data = await res.json();

      if (data.success) {
        await fetchProviderSettings(); // refresh UI
      } else {
        alert(data.error || "Failed to sync");
      }
    } catch (error) {
      console.error("❌ [Admin] Sync wallet error:", error);
      alert("Error syncing wallet");
    } finally {
      setIsRefreshingDataHub(false);
    }
  };

  const syncWalletSilently = async () => {
    try {
      if (providerSettings && providerSettings.last_synced_at) {
        const lastSynced = new Date(providerSettings.last_synced_at).getTime();
        const now = Date.now();
        if (now - lastSynced < 10000) {
          return;
        }
      }
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await fetch("/api/sync-datahub-wallet", {
        method: "POST",
        headers: headers as any
      });
      const data = await res.json();
      if (data.success) {
        await fetchProviderSettings();
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchProviderSettings();
    // SAFE POLLING ARCHITECTURE
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchProviderSettings();
      }
    }, 300000); // every 5m

    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const [dhRes] = await Promise.allSettled([
        axios.get("/api/check-datahub", { headers }),
      ]);

      const dh =
        dhRes.status === "fulfilled" ? dhRes.value.data : { online: false };

      setHealth({
        datahub: dh.online,
        lastChecked: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Health load error:", err);
    }
  };

  // Health check effect
  useEffect(() => {
    loadHealth();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadHealth();
      }
    }, 300000); // 5m
    return () => clearInterval(t);
  }, []);

  const [providerMetrics, setProviderMetrics] = useState({ success: 0, failed: 0, blocked: 0 });

  // Today metrics effect
  useEffect(() => {
    const fetchKPI = async () => {
      const { data, error } = await supabase.rpc("get_today_kpi");
      if (!error && data) {
        // RPC returns an array in some Supabase versions, or a single object if configured
        const stats = Array.isArray(data) ? data[0] : data;
        setKpi({
          total: stats?.total_tx ?? 0,
          revenue: stats?.revenue ?? 0,
          success: stats?.success_count ?? 0,
          failed: stats?.failed_count ?? 0,
        });
      } else {
        // Fallback to manual query if RPC fails
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: txs } = await supabase
          .from("transactions")
          .select("amount, vtu_status, delivery_status")
          .gte("created_at", today.toISOString());

        if (txs) {
          const total = txs.length;
          const revenue = txs.reduce((sum, tx) => sum + Number(tx.amount), 0);
          const success = txs.filter(
            (tx) =>
              tx.delivery_status === "delivered" ||
              tx.vtu_status === "success" ||
              tx.vtu_status === "delivered",
          ).length;
          const failed = txs.filter(
            (tx) =>
              tx.delivery_status === "failed" || tx.vtu_status === "failed",
          ).length;
          setKpi({ total, revenue, success, failed });
        }
      }

      // 🚀 Step 10: Provider execution metrics from datahub_logs
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const { data: logsData } = await supabase
        .from("datahub_logs")
        .select("status")
        .gte("created_at", todayDate.toISOString());

      if (logsData) {
        const success = logsData.filter(log => log.status === "success").length;
        const failed = logsData.filter(log => log.status === "failed").length;
        const blocked = logsData.filter(log => log.status === "blocked_source").length;
        setProviderMetrics({ success, failed, blocked });
      }
    };
    fetchKPI();
    const t = setInterval(fetchKPI, 60000); // refresh KPIs every minute
    return () => clearInterval(t);
  }, []);

  // Real-time transactions effect
  useEffect(() => {
    // initial load
    supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setRows(data ?? []));

    // realtime
    const ch = supabase
      .channel("tx-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (p) => {
          setRows((prev) => {
            const newDoc = p.new as any;
            if (!newDoc?.id) return prev;

            const idx = prev.findIndex((x) => x.id === newDoc.id);
            if (idx === -1) return [newDoc, ...prev].slice(0, 50);
            const copy = [...prev];
            copy[idx] = newDoc;
            return copy;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const successRate = kpi.total
    ? ((kpi.success / kpi.total) * 100).toFixed(1)
    : 0;
  const isStuck = (t: any) => {
    if (!t?.created_at) return false;
    const diff = Date.now() - new Date(t.created_at).getTime();
    // 🛡️ REPRODUCED CALM TIMING: 45 minute grace period
    const isProcessingTooLong =
      t.vtu_status === "processing" && diff > 45 * 60 * 1000;
    const isPendingTooLong =
      (t.vtu_status === "pending" || !t.vtu_status) &&
      (t.status === "paid" || t.status === "success") &&
      diff > 45 * 60 * 1000;
    return isProcessingTooLong || isPendingTooLong;
  };

  const ITEMS_PER_PAGE = 10;
  const navigate = useNavigate();

  useEffect(() => {
    const checkServer = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        const res = await axios.get("/api/health", { headers });
        if (res.status === 200) setServerStatus("up");
        else setServerStatus("down");
      } catch (e) {
        setServerStatus("down");
      }
    };
    checkServer();
  }, []);

  const [dashboardStats, setDashboardStats] = useState({
    sales: 0,
    transactions: 0,
    users: 0,
  });

  useEffect(() => {
    let isMounted = true;

    const checkUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session || !session.user) {
          if (isMounted) {
            navigate("/admin/auth");
            setIsLoading(false);
          }
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (!profile || profile.role !== "admin") {
          if (isMounted) {
            navigate("/admin/auth");
          }
        } else {
          if (isMounted) {
            setUser({ ...session.user, role: profile.role });
            fetchDashboardStats();
          }
        }
      } catch (err) {
        console.error("Auth check failed", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      // Fetch total sales
      const { data: salesData, error: salesError } = await supabase
        .from("transactions")
        .select("amount")
        .eq("status", "success");

      if (!salesError && salesData) {
        const total = salesData.reduce((sum, tx) => sum + Number(tx.amount), 0);
        setDashboardStats((prev) => ({ ...prev, sales: total }));
      }

      // Fetch transaction count
      const { count: txCount, error: txError } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true });

      if (!txError && txCount !== null) {
        setDashboardStats((prev) => ({ ...prev, transactions: txCount }));
      }

      // Fetch active users count
      const { count: usersCount, error: usersError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      if (!usersError && usersCount !== null) {
        setDashboardStats((prev) => ({ ...prev, users: usersCount }));
      }
    } catch (err) {
      console.error("❌ [Admin] Fetch dashboard stats error:", err);
    }
  }, []);

  useEffect(() => {
    if (currentView === "transactions") {
      const delayDebounceFn = setTimeout(() => {
        fetchTransactions();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    } else if (currentView === "customers") {
      fetchCustomers();
    } else if (currentView === "settings") {
      fetchSettings();
    }
  }, [currentView, searchQuery, currentPage]);

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      // Fetch general settings
      const { data: generalData, error: generalError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "general")
        .maybeSingle();

      if (!generalError && generalData) {
        setAppSettings((prev) => ({ ...prev, ...generalData.value }));
      } else if (generalError) {
        console.error("General settings fetch error:", generalError);
      }

      // Fetch secure settings
      const { data: secureData, error: secureError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "secure")
        .maybeSingle();

      if (!secureError && secureData) {
        setSecureSettings((prev) => ({ ...prev, ...secureData.value }));
      } else if (secureError) {
        console.error("Secure settings fetch error:", secureError);
      }

      // Fetch DataHub settings
      const { data: dhData, error: dhError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "datahubgh")
        .maybeSingle();

      if (!dhError && dhData) {
        setDataHubSettings((prev) => ({ ...prev, ...dhData.value }));
        // Trigger initial refresh
        refreshDataHubStatus(dhData.value);
        fetchDataHubLogs();
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleUpdateSettings = async (e: FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      console.log("Saving settings...", { appSettings, secureSettings });

      // Save general settings
      const { error: generalError } = await supabase
        .from("settings")
        .upsert(
          {
            key: "general",
            value: appSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );

      if (generalError) {
        console.error("General save error:", generalError);
        const errorMsg = generalError.message;
        if (errorMsg.includes("row-level security")) {
          throw new Error(
            "Access Denied: You don't have permission to update settings. Please ensure your account has the 'admin' role in Supabase and that you've applied the latest SQL schema from supabase-setup.sql.",
          );
        }
        throw new Error(`General settings: ${errorMsg}`);
      }

      // Save secure settings
      const { error: secureError } = await supabase
        .from("settings")
        .upsert(
          {
            key: "secure",
            value: secureSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );

      if (secureError) {
        console.error("Secure save error:", secureError);
        throw new Error(`Secure settings: ${secureError.message}`);
      }

      // Save DataHub settings
      const { error: dhError } = await supabase
        .from("settings")
        .upsert(
          {
            key: "datahubgh",
            value: dataHubSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" },
        );

      if (dhError) {
        console.error("DataHub save error:", dhError);
        throw new Error(`DataHub settings: ${dhError.message}`);
      }

      alert("Settings updated successfully!");
    } catch (err: any) {
      console.error("Full save error:", err);
      let errMsg = err.message || String(err);
      if (errMsg.includes("Failed to fetch")) {
        errMsg =
          "Network error: Failed to reach server. The server might be offline or restarting. Please try again in a few seconds.";
      }
      alert(`Failed to save settings: ${errMsg}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchCustomers = async () => {
    setIsLoadingCustomers(true);
    try {
      const { data: summariesData, error: summariesError } = await supabase.rpc(
        "get_customers_summary",
      );

      if (summariesError) {
        console.error("RPC Error:", summariesError);
        throw summariesError;
      }

      setCustomers(summariesData || []);
    } catch (err) {
      console.error("Customer fetch error:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  const viewCustomer = async (phone: string) => {
    if (!phone || phone === "No phone recorded" || phone === "NONE") {
      setCustomerTransactions([]);
      setSelectedCustomerPhone("NONE");
      return;
    }

    setSelectedCustomerPhone(phone);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("recipient_phone", phone)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("View customer error:", error);
      return;
    }

    setCustomerTransactions(data || []);
  };

  useEffect(() => {
    if (selectedCustomerPhone) {
      viewCustomer(selectedCustomerPhone);
    }
  }, [selectedCustomerPhone]);

  const fetchBundles = useCallback(async () => {
    setIsLoadingBundles(true);
    const { data, error } = await supabase
      .from("bundles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ FETCH ERROR:", error);
      setIsLoadingBundles(false);
      return;
    }

    setBundles(data || []);
    setLastBundlesSync(new Date().toLocaleTimeString());
    setIsLoadingBundles(false);
  }, []);

  useEffect(() => {
    fetchBundles();

    const channel = supabase
      .channel("bundles-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bundles" },
        (payload) => {
          console.log("🔄 REALTIME UPDATE:", payload);
          fetchBundles();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleEditClick = (bundle: any) => {
    setSelectedBundle(bundle);

    setForm({
      network: bundle.network || "",
      network_key: bundle.network_key || "",
      datahub_network_key: bundle.datahub_network_key || "",
      datahub_capacity: bundle.datahub_capacity || "",
      capacity: bundle.capacity || "",
      volume: bundle.volume || "",
      description: bundle.description || "",
      cost_price: bundle.cost_price || "",
      selling_price: bundle.selling_price || "",
      is_active: bundle.is_active ?? true,
    });

    setShowModal(true);
  };

  const handleUpdateBundle = async (
    bundleIdParam?: string,
    updatesParam?: any,
  ) => {
    const bundleId = bundleIdParam || selectedBundle?.id;
    const updates = updatesParam || {
      network: form.network,
      network_key: form.network_key,
      datahub_network_key: form.datahub_network_key,
      datahub_capacity: form.datahub_capacity,
      capacity: form.capacity,
      volume: form.volume,
      cost_price: form.cost_price === "" ? 0 : Number(form.cost_price),
      selling_price: form.selling_price === "" ? 0 : Number(form.selling_price),
      description: form.description,
      is_active: form.is_active,
    };

    if (!bundleId) {
      console.error("❌ No bundle selected");
      return;
    }

    if (isNaN(updates.cost_price) || isNaN(updates.selling_price)) {
      alert("Please enter valid numbers for cost and selling prices.");
      return;
    }

    if (isActionProcessing) return;

    // Check for duplicate capacity if capacity is being updated
    if (updates.capacity) {
      const targetBundle = bundles.find((b) => b.id === bundleId);
      const networkToCheck = (updates.network ||
        targetBundle?.network) as string;
      const capacityToCheck = updates.capacity as string;

      const isDuplicate = bundles.some(
        (b) =>
          b.id !== bundleId &&
          b.network?.toLowerCase() === networkToCheck?.toLowerCase() &&
          b.capacity?.toLowerCase() === capacityToCheck?.toLowerCase(),
      );

      if (isDuplicate) {
        alert(
          `A bundle with capacity "${capacityToCheck}" already exists for ${networkToCheck}.`,
        );
        return;
      }
    }

    try {
      setIsActionProcessing(true);
      console.log("📤 Updating bundle:", bundleId);

      const { data, error } = await supabase
        .from("bundles")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bundleId)
        .select();

      if (error) {
        console.error("❌ UPDATE ERROR:", error);
        alert(error.message);
        return;
      }

      console.log("✅ UPDATED DATA:", data);

      // ✅ Instant UI update
      if (data && data.length > 0) {
        setBundles((prev) =>
          prev.map((b) => (b.id === bundleId ? { ...b, ...data[0] } : b)),
        );
      }

      // 🔁 Backup sync
      await fetchBundles();

      // ✅ Close editing states
      if (editingBundle?.id === bundleId) {
        setEditingBundle(null);
      }

      if (selectedBundle?.id === bundleId) {
        setShowModal(false);
        setSelectedBundle(null);
      }
    } catch (err: any) {
      console.error("🔥 UPDATE ERROR:", err);
      alert(`Update failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!bundleId) return;
    if (isActionProcessing) return;

    try {
      setIsActionProcessing(true);
      console.log("🗑️ Deleting bundle:", bundleId);

      const { error } = await supabase
        .from("bundles")
        .delete()
        .eq("id", bundleId);

      if (error) {
        console.error("❌ DELETE ERROR:", error);
        alert(error.message);
        return;
      }

      console.log("✅ DELETED SUCCESSFULLY");

      // ✅ Instant UI update
      setBundles((current) => current.filter((b) => b.id !== bundleId));

      // 🔁 Backup sync
      await fetchBundles();

      setBundleToDelete(null);
    } catch (err: any) {
      console.error("🔥 DELETE ERROR:", err);
      alert(`Deletion failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const toggleBundleActive = async (
    bundleId: string,
    currentStatus: boolean,
  ) => {
    await handleUpdateBundle(bundleId, { is_active: !currentStatus });
  };

  const handleCreateBundle = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (isActionProcessing) return;

    // Check for duplicate capacity
    const isDuplicate = bundles.some(
      (b) =>
        b.network?.toLowerCase() === newBundle.network.toLowerCase() &&
        b.capacity?.toLowerCase() === newBundle.capacity.toLowerCase(),
    );

    if (isDuplicate) {
      alert(
        `A bundle with capacity "${newBundle.capacity}" already exists for ${newBundle.network}.`,
      );
      return;
    }

    try {
      setIsActionProcessing(true);

      const costPriceVal =
        newBundle.cost_price === "" ? 0 : Number(newBundle.cost_price);
      const sellingPriceVal =
        newBundle.selling_price === "" ? 0 : Number(newBundle.selling_price);

      if (isNaN(costPriceVal) || isNaN(sellingPriceVal)) {
        alert("Please enter valid numbers for cost and selling prices.");
        setIsActionProcessing(false);
        return;
      }

      const { error } = await supabase.from("bundles").insert({
        network: newBundle.network,
        network_key: newBundle.network_key,
        datahub_network_key: newBundle.datahub_network_key,
        datahub_capacity: newBundle.datahub_capacity,
        capacity: newBundle.capacity,
        volume: newBundle.volume,
        cost_price: costPriceVal,
        selling_price: sellingPriceVal,
        description: newBundle.description,
        is_active: true,
      });

      if (error) {
        console.error("❌ INSERT ERROR:", error);
        alert(error.message);
        return;
      }

      console.log("✅ Bundle created successfully");
      alert(
        `Successfully created ${newBundle.network} ${newBundle.capacity} bundle.`,
      );

      // 🔁 Refresh bundles list
      await fetchBundles();

      // ❌ Close modal
      setIsAddingBundle(false);

      // 🔄 Reset form
      setNewBundle({
        network: "MTN",
        network_key: "YELLO",
        datahub_network_key: "",
        datahub_capacity: "",
        capacity: "",
        volume: "",
        description: "",
        selling_price: "",
        cost_price: "",
        is_active: true,
      });
    } catch (err: any) {
      console.error("🔥 CREATE ERROR:", err);
      alert(`Creation failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handleDeleteCustomer = async (userId: string) => {
    if (isActionProcessing) return;

    const previousCustomers = [...customers];
    setCustomers((current) => current.filter((c) => c.user_id !== userId));
    setIsActionProcessing(true);

    try {
      // First delete associated transactions (if for some reason database isn't set to cascade)
      // Actually, standard RLS might prevent this unless we are admin.
      // Assuming 'admin' can delete from profiles/transactions.

      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId);

      if (txError) {
        console.warn("Transaction deletion warning (continuing):", txError);
      }

      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;

      setCustomerToDelete(null);
      fetchDashboardStats(); // Refresh user count
    } catch (err: any) {
      console.error("Supabase Customer Delete Error:", err);
      setCustomers(previousCustomers);
      alert(`Failed to delete customer: ${err.message}`);
    } finally {
      setIsActionProcessing(false);
    }
  };

  const [isRetryingVTU, setIsRetryingVTU] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState<string | null>(null);

  const getTransactionStatus = (tx: any) => {
    const isPaid = tx.status === 'paid' || tx.status === 'payment_verified' || tx.status === 'success' || tx.payment_status === 'paid' || tx.payment_status === 'success';
    const vtu = tx.vtu_status;
    const updatedAt = tx.updated_at ? new Date(tx.updated_at).getTime() : 0;
    const now = Date.now();
    const isStale = (vtu === 'processing' || vtu === 'provider_execution_started') && (now - updatedAt > 2700000); // 45 mins (Calm Timing)

    if (vtu === 'manual_review_required' || (tx.external_reference && (vtu === 'failed' || vtu === 'pending' || !vtu))) {
      return { 
        label: 'Reconciliation Required', 
        color: 'bg-amber-50 text-amber-700 border border-amber-300 font-bold', 
        icon: <RefreshCw size={10} className="mr-1" />, 
        reconcile: true 
      };
    }
    if (vtu === 'success' || vtu === 'delivered' || vtu === 'completed') {
      return { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', icon: null };
    }
    if (vtu === 'provider_rejected' || vtu === 'failed') {
      return { label: 'Provider Rejected', color: 'bg-rose-100 text-rose-700', icon: null, retry: true };
    }
    if (isStale) {
      return { label: 'Stale Processing', color: 'bg-amber-100 text-amber-700 font-bold animate-pulse', icon: <Clock size={10} className="mr-1" />, retry: true };
    }
    if (["provider_accepted", "awaiting_provider_confirmation", "reconciliation_pending", "delayed_provider_processing", "provider_execution_started", "processing"].includes(vtu)) {
      return { 
        label: vtu.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 
        color: 'bg-indigo-50 text-indigo-700', 
        icon: <RefreshCw size={10} className="animate-spin mr-1" />,
        reconcile: true 
      };
    }
    if (tx.status === 'blocked_source') {
      return { label: 'Blocked Source', color: 'bg-slate-100 text-slate-700', icon: <ShieldAlert size={10} className="mr-1" />, retry: true };
    }
    if (isPaid) {
      return { label: 'Payment Verified', color: 'bg-blue-100 text-blue-700', icon: <Clock size={10} className="mr-1" /> };
    }
    return { label: tx.status || 'Pending', color: 'bg-slate-100 text-slate-700', icon: null };
  };
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [txToDelete, setTxToDelete] = useState<any>(null);
  useEffect(() => {
    // 💓 Heartbeat to keep DataHub status fresh
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible' && dataHubSettings.api_key) {
        refreshDataHubStatus();
      }
    }, 60000 * 5); // Every 5 minutes

    return () => clearInterval(heartbeat);
  }, [dataHubSettings.api_key]);

  const [isDeletingTx, setIsDeletingTx] = useState(false);

  const handleWhatsAppMessage = (tx: any) => {
    // 🛡️ STRICT PRIORITY: Always target the human recipient first
    const rawPhone = tx.recipient_phone || tx.payer_phone_number || tx.phone || "";
    if (!rawPhone) {
      alert("No phone number available for this transaction.");
      return;
    }

    const network = String(tx.network || "N/A").toUpperCase();
    const bundle = tx.capacity || tx.bundle_name || tx.volume || "N/A";
    const recipient = tx.recipient_phone || "N/A";
    const reference = tx.id || "N/A";

    const message = `Hello 👋\n\nYour ${appSettings.app_name} transaction is being processed successfully.\n\n📶 Network: ${network}\n📦 Bundle: ${bundle}\n📱 Recipient: ${recipient}\n🧾 Reference: ${reference}\n\nThank you for choosing ${appSettings.app_name}.`;

    console.log("🛠️ Preparing direct WhatsApp chat for customer:", { recipient, rawPhone, network });

    openWhatsApp({
      phone: rawPhone,
      message: message,
    });
  };

  const openSupportWhatsApp = () => {
    openWhatsApp({
      phone: ADMIN_SUPPORT_NUMBER,
      message: `Hi Datapapa Parent Support 👋\n\nI am the admin of ${appSettings?.app_name || "Datapapa"} and I need assistance with my dashboard/services.`
    });
  };

  const retryVTU = async (transactionId: string) => {
    if (isRetryingVTU) return;
    setIsRetryingVTU(transactionId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await axios.post("/api/retry-vtu", { transactionId }, { headers });
      if (res.data.success === false) {
        alert(res.data.message || res.data.error || "Retry not allowed");
      } else {
        alert(res.data.message || "VTU Retry Executed Successfully");
      }
      fetchTransactions();
    } catch (err: any) {
      console.error("Retry failed:", err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message || 
                          err.message || 
                          String(err);
      alert("Failed to execute retry: " + errorMessage);
    } finally {
      setIsRetryingVTU(null);
    }
  };

  const reconcileStatus = async (transactionId: string) => {
    if (isReconciling) return;
    setIsReconciling(transactionId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await axios.post("/api/reconcile-tx", { transactionId }, { headers });
      if (res.data.success) {
        alert("Status Sync Complete: " + (res.data.status || "Updated"));
      } else {
        alert("Sync Failed: " + (res.data.error || "Could not reconcile with provider"));
      }
      fetchTransactions();
    } catch (err: any) {
      console.error("Reconciliation failed:", err);
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setIsReconciling(null);
    }
  };

  const refreshAll = async () => {
    setIsLoadingTransactions(true);
    try {
      await fetchDashboardStats();
      await fetchTransactions();
      await fetchProviderSettings();
      if (dataHubSettings.api_key) {
        await refreshDataHubStatus();
      }
      setLastDataRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Global refresh error:", err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const markDelivered = async (txId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await axios.post("/api/admin-tx-action", { 
        action: 'mark_delivered', 
        transactionId: txId 
      }, { headers });

      if (res.data.success) {
        alert("Marked as delivered");
        fetchTransactions();
      } else {
        throw new Error(res.data.error || "Failed to update transaction");
      }
    } catch (err: any) {
      console.error("Mark as delivered error:", err);
      alert("Failed to mark as delivered: " + (err.response?.data?.error || err.message || String(err)));
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (isDeletingTx) return;
    setIsDeletingTx(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      const res = await axios.post("/api/admin-tx-action", { 
        action: 'delete', 
        transactionId: txId 
      }, { headers });

      if (res.data.success) {
        setTransactions((prev) => prev.filter((t) => t.id !== txId));
        setTxToDelete(null);
        fetchDashboardStats();
      } else {
        throw new Error(res.data.error || "Failed to delete transaction");
      }
    } catch (err: any) {
      alert(`Delete failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setIsDeletingTx(false);
    }
  };

  const fetchDataHubLogs = async () => {
    setIsFetchingLogs(true);
    try {
      const { data, error } = await supabase
        .from("datahub_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data) {
        setDataHubLogs(data);
      }
    } catch (err) {
      console.error("Logs fetch error:", err);
    } finally {
      setIsFetchingLogs(false);
    }
  };

  const refreshDataHubStatus = async (existingSettings?: any) => {
    const settings = existingSettings || dataHubSettings;
    if (!settings.api_key) {
      setDataHubSettings((prev) => ({ ...prev, status: "inactive" }));
      setHealth({ datahub: false, lastChecked: new Date().toLocaleTimeString() });
      return;
    }

    setIsRefreshingDataHub(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

      // 1. Get Balance
      await syncWalletSilently();

      // 2. Get Ping/Status
      const pingResp = await axios.get("/api/check-datahub", { headers });
      const isOnline = pingResp.status === 200 && pingResp.data.online;

      if (pingResp.status === 200) {
        const pResult = pingResp.data;
        setDataHubPing(pResult.responseTime || null);
        setDataHubSettings((prev) => ({
          ...prev,
          status: pResult.online ? "online" : "offline",
        }));
        setHealth({
          datahub: pResult.online,
          lastChecked: new Date().toLocaleTimeString(),
        });
      } else {
        setDataHubSettings((prev) => ({ ...prev, status: "offline" }));
        setHealth({
          datahub: false,
          lastChecked: new Date().toLocaleTimeString(),
        });
      }
    } catch (err) {
      console.error("Refresh error:", err);
      setDataHubSettings((prev) => ({ ...prev, status: "offline" }));
      setHealth({
        datahub: false,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsRefreshingDataHub(false);
      fetchDataHubLogs();
    }
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoadingTransactions(true);
    try {
      let query = supabase.from("transactions").select("*", { count: "exact" });

      if (searchQuery) {
        query = query.or(
          `recipient_phone.ilike.%${searchQuery}%,payer_phone_number.ilike.%${searchQuery}%,id.ilike.%${searchQuery}%`,
        );
      }

      if (filterNetwork) {
        query = query.eq("network", filterNetwork);
      }

      if (filterStatus) {
        query = query.eq("status", filterStatus);
      }

      if (filterDelivery) {
        query = query.eq("vtu_status", filterDelivery);
      }

      if (filterDate) {
        query = query.gte("created_at", filterDate);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("FETCH ERROR:", error);
      }

      if (!error && data) {
        setTransactions(data);
        if (count !== null) setTotalTransactions(count);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTransactions(false);
    }
  }, [
    searchQuery,
    currentPage,
    filterNetwork,
    filterStatus,
    filterDelivery,
    filterDate,
  ]);

  useEffect(() => {
    const txChannel = supabase
      .channel("admin-transactions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          console.log("🔄 ADMIN REALTIME:", payload);

          if (payload.eventType === "UPDATE") {
            setTransactions((prev) =>
              prev.map((t) =>
                t.id === payload.new.id ? { ...t, ...payload.new } : t,
              ),
            );
          } else if (payload.eventType === "INSERT") {
            // We could prepend, but pagination makes this tricky
            // For simplicity, just refresh
            fetchTransactions();
          } else if (payload.eventType === "DELETE") {
            setTransactions((prev) =>
              prev.filter((t) => t.id !== payload.old.id),
            );
          }

          fetchDashboardStats();
        },
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
        },
      )
      .subscribe();

    const customersChannel = supabase
      .channel("customers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          if (currentView === "customers") {
            fetchCustomers();
            if (selectedCustomerPhone) {
              viewCustomer(selectedCustomerPhone);
            }
          }
        },
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
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Activity className="animate-pulse text-indigo-500 h-10 w-10" />
      </div>
    );
  }

  if (user?.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white h-16 px-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center">
          <ShieldCheck className="h-6 w-6 text-indigo-400 mr-2" />
          <span className="font-bold text-lg tracking-tight">
            Admin Console
          </span>
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
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          ${isSidebarOpen ? "w-64" : "w-20"}
        `}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0 justify-between">
          <div
            className={`flex items-center overflow-hidden transition-all duration-300 ${isSidebarOpen ? "opacity-100 w-auto" : "opacity-0 w-0 md:opacity-100 md:w-auto h-0 md:h-auto overflow-hidden"}`}
          >
            <ShieldCheck className="h-6 w-6 text-indigo-400 mr-2 shrink-0" />
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">
              Admin Console
            </span>
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
              { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
              { id: "reports", label: "Reports", icon: BarChart3 },
              { id: "system-health", label: "System Health", icon: Activity },
              { id: "transactions", label: "Transactions", icon: CreditCard },
              { id: "bundles", label: "Bundles", icon: Database },
              { id: "customers", label: "Customers", icon: Users },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id as any);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-all group relative ${
                  currentView === item.id
                    ? "bg-indigo-600/10 text-indigo-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
                title={!isSidebarOpen ? item.label : ""}
              >
                <item.icon
                  className={`h-5 w-5 shrink-0 ${isSidebarOpen ? "mr-3" : "mx-auto"} ${currentView === item.id ? "" : "text-slate-400 group-hover:text-white"}`}
                />
                {isSidebarOpen && <span>{item.label}</span>}
                {currentView === item.id && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                  />
                )}
              </button>
            ))}
            <button
              onClick={() => {
                setCurrentView("settings");
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-all group relative ${
                currentView === "settings"
                  ? "bg-indigo-600/10 text-indigo-400"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
              title={!isSidebarOpen ? "Settings" : ""}
            >
              <Settings
                className={`h-5 w-5 shrink-0 ${isSidebarOpen ? "mr-3" : "mx-auto"} ${currentView === "settings" ? "" : "text-slate-400 group-hover:text-white"}`}
              />
              {isSidebarOpen && <span>Settings</span>}
              {currentView === "settings" && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                />
              )}
            </button>

            {/* Back to Homepage */}
            <div className="pt-4 mt-4 border-t border-slate-800">
              <button
                onClick={() => navigate("/")}
                className="w-full flex items-center px-3 py-2.5 rounded-lg font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-all group"
                title={!isSidebarOpen ? "Back to Homepage" : ""}
              >
                <Home
                  className={`h-5 w-5 shrink-0 ${isSidebarOpen ? "mr-3" : "mx-auto"} text-slate-500 group-hover:text-white`}
                />
                {isSidebarOpen && <span>Back to Homepage</span>}
              </button>
            </div>
          </nav>
        </div>

        {/* Sidebar Collapse Toggle Button (Desktop Only) */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="hidden md:flex absolute -right-3 top-20 bg-slate-800 text-slate-400 p-1 rounded-full border border-slate-700 hover:text-white hover:bg-slate-700 shadow-lg transition-colors z-50"
        >
          {isSidebarOpen ? (
            <ChevronLeft size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </button>

        <div className="p-4 border-t border-slate-800">
          <div
            className={`flex items-center gap-3 mb-4 transition-all duration-300 ${isSidebarOpen ? "px-2" : "justify-center px-0"}`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-sm shrink-0">
              {user?.email?.[0].toUpperCase() || "A"}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-all ${!isSidebarOpen ? "aspect-square p-0" : ""}`}
            title={!isSidebarOpen ? "Sign Out" : ""}
          >
            <LogOut size={16} className="shrink-0" />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 ease-in-out p-4 md:p-8 ${isSidebarOpen ? "md:ml-64" : "md:ml-20"}`}
      >
        {currentView === "dashboard" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  System Overview
                </h1>
                <p className="text-slate-500 mt-1">
                  Real-time monitoring of VTU services and revenue.
                  {lastDataRefresh && (
                    <span className="ml-2 text-[10px] text-indigo-400 font-mono">
                      (Last update: {lastDataRefresh})
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={refreshAll}
                disabled={isLoadingTransactions}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm font-bold text-xs uppercase tracking-wider"
              >
                <RefreshCw
                  size={14}
                  className={isLoadingTransactions ? "animate-spin" : ""}
                />
                <span>Refresh Data</span>
              </button>
            </header>

            {/* Health Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Service Health
                </div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <Database
                    size={18}
                    className={
                      health.datahub ? "text-emerald-500" : "text-rose-500"
                    }
                  />
                  <span>DataHub Channel</span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] ${health.datahub ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                  >
                    {health.datahub ? "ONLINE" : "OFFLINE"}
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                  DataHub Wallet
                </div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <Wallet size={18} className="text-emerald-500" />
                  <span>Balance:</span>
                  <span className="text-emerald-700 ml-1">
                    ₵
                    {dataHubBalance !== null
                      ? Number(dataHubBalance).toFixed(2)
                      : "---"}
                  </span>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Last Heartbeat
                </div>
                <div className="flex items-center gap-2 text-lg font-bold">
                  <RefreshCw
                    size={18}
                    className="text-slate-400 animate-pulse"
                  />
                  <span>Sync:</span>
                  <span className="text-slate-600 ml-1 font-mono text-sm">
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group">
                <div className="relative z-10">
                  <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                    Revenue (Today)
                  </div>
                  <div className="text-3xl font-black text-slate-900 group-hover:scale-105 transition-transform origin-left">
                    ₵{Number(kpi.revenue).toFixed(2)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">
                    Gross income for today
                  </p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Transactions
                </div>
                <div className="text-3xl font-black text-slate-900">
                  {kpi.total}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Total orders today
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Success Rate
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-black text-emerald-600">
                    {successRate}%
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Delivery health
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Failures
                </div>
                <div className="text-3xl font-black text-rose-600">
                  {kpi.failed}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Failed VTU orders
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Provider Sync
                </div>
                <div className="text-3xl font-black text-indigo-600">
                  {providerMetrics.success}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                   Webhook wins today
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-2">
                  Blocked Calls
                </div>
                <div className="text-3xl font-black text-rose-600">
                  {providerMetrics.blocked}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Unauthorized attempts
                </p>
              </div>
            </div>

            {/* Live Feed */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                    Live Transaction Stream
                  </h3>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Limit: Last 50 Events
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Network</th>
                      <th className="px-6 py-4">Quantity</th>
                      <th className="px-6 py-4">Recipients</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4 text-center">Outcome</th>
                      <th className="px-6 py-4 text-right">Timestamp</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-6 py-20 text-center text-slate-400 italic"
                        >
                          Waiting for live data...
                        </td>
                      </tr>
                    ) : (
                      rows.map((tx) => (
                        <tr
                          key={tx.id}
                          className={`hover:bg-slate-50/80 transition-colors ${isStuck(tx) ? "bg-rose-50/50" : ""}`}
                        >
                          <td className="px-6 py-4">
                            <span className="font-black text-slate-900 tracking-tight">
                              {tx.network}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {tx.capacity}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {tx.recipient_phone}
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-900">
                            ₵{tx.amount}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                tx.delivery_status === "delivered" ||
                                tx.vtu_status === "success" ||
                                tx.vtu_status === "delivered"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : tx.delivery_status === "failed" ||
                                      tx.vtu_status === "failed"
                                    ? "bg-rose-100 text-rose-700"
                                    : tx.delivery_status === "delivering" ||
                                        tx.vtu_status === "processing"
                                      ? "bg-amber-100 text-amber-700 animate-pulse"
                                      : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {tx.delivery_status === "delivered" ||
                              tx.vtu_status === "delivered" ||
                              tx.vtu_status === "success"
                                ? "DELIVERED"
                                : tx.delivery_status === "failed" ||
                                    tx.vtu_status === "failed"
                                  ? "FAILED"
                                  : tx.delivery_status === "delivering" ||
                                      tx.vtu_status === "processing"
                                    ? "PROCESSING"
                                    : tx.vtu_status || "PENDING"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-xs text-slate-400 font-mono">
                            {new Date(tx.created_at).toLocaleTimeString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => retryVTU(tx.id)}
                                disabled={
                                  isRetryingVTU === tx.id ||
                                  tx.delivery_status === "delivered" ||
                                  tx.vtu_status === "delivered" ||
                                  tx.vtu_status === "success" ||
                                  tx.delivery_status === "delivering" ||
                                  tx.vtu_status === "processing"
                                }
                                className={`p-1.5 rounded-lg transition-all shadow-sm ${
                                  isRetryingVTU === tx.id ||
                                  tx.delivery_status === "delivered" ||
                                  tx.vtu_status === "delivered" ||
                                  tx.vtu_status === "success" ||
                                  tx.delivery_status === "delivering" ||
                                  tx.vtu_status === "processing"
                                    ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white"
                                }`}
                                title="Retry VTU"
                              >
                                <RefreshCw
                                  size={14}
                                  className={
                                    isRetryingVTU === tx.id
                                      ? "animate-spin"
                                      : ""
                                  }
                                />
                              </button>
                              <button
                                onClick={() => handleWhatsAppMessage(tx)}
                                disabled={!isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "")}
                                className={`p-1.5 rounded-lg transition-all shadow-sm ${isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "") ? "bg-slate-100 text-slate-600 hover:bg-emerald-500 hover:text-white" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}
                                title={isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "") ? "Message Customer (WhatsApp)" : "Invalid phone number"}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {currentView === "reports" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <ReportsView />
          </motion.div>
        )}

        {currentView === "system-health" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <SystemHealthView />
          </motion.div>
        )}

        {currentView === "transactions" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Master Transaction Ledger
                </h1>
                <p className="text-slate-500 mt-1">
                  Monitor all purchases and delivery status in real-time
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <button
                  onClick={fetchTransactions}
                  disabled={isLoadingTransactions}
                  className={`p-2 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-indigo-600 transition-all shadow-sm ${isLoadingTransactions ? "opacity-50" : ""}`}
                  title="Refresh Ledger"
                >
                  <RefreshCw size={18} className={isLoadingTransactions ? "animate-spin" : ""} />
                </button>

                <div className="relative flex-1 md:flex-none">
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
                    placeholder="Search by phone..."
                    className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                  />
                </div>

                <select
                  value={filterNetwork}
                  onChange={(e) => {
                    setFilterNetwork(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Networks</option>
                  <option value="mtn">MTN</option>
                  <option value="telecel">Telecel</option>
                  <option value="at">AT</option>
                </select>

                <select
                  value={filterDelivery}
                  onChange={(e) => {
                    setFilterDelivery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Delivery Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                </select>

                <button
                  onClick={() => {
                    setFilterNetwork("");
                    setFilterStatus("");
                    setFilterDelivery("");
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  title="Clear Filters"
                >
                  <FilterX size={18} />
                </button>
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Internal Ref</th>
                      <th className="px-6 py-4">Date & Time</th>
                      <th className="px-6 py-4">Provider Ref</th>
                      <th className="px-6 py-4">Network</th>
                      <th className="px-6 py-4">Capacity</th>
                      <th className="px-6 py-4">Payer</th>
                      <th className="px-6 py-4">Recipient</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                      <th className="px-6 py-4 text-center">Payment</th>
                      <th className="px-6 py-4 text-center">Delivery</th>
                      <th className="px-6 py-4 text-center">Retries</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingTransactions ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          <Activity className="animate-spin text-indigo-500 h-8 w-8 mx-auto mb-3" />
                          <p>Loading transactions...</p>
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          <Database className="text-slate-300 h-8 w-8 mx-auto mb-3" />
                          <p>No transactions found in the database.</p>
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => {
                        const stuck = isStuck(tx);
                        return (
                          <tr
                            key={tx.id}
                            className={`hover:bg-slate-50/50 transition-colors ${stuck ? "bg-amber-50/30" : ""}`}
                          >
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                              {(tx.internal_reference || tx.id).substring(0, 8)}...
                              {(tx.internal_reference || tx.id).substring((tx.internal_reference || tx.id).length - 4)}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {new Date(tx.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-slate-500">
                              {tx.provider_reference || tx.external_reference || "N/A"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {tx.network?.toLowerCase() === "mtn" && (
                                  <img
                                    src="https://i.postimg.cc/5NPHHMBJ/MTN-LOGO-1.png"
                                    alt="MTN"
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                )}
                                {tx.network?.toLowerCase() === "telecel" && (
                                  <img
                                    src="https://i.postimg.cc/SRgWNYSf/TELECEL-LOGO-1.jpg"
                                    alt="Telecel"
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                )}
                                {(tx.network?.toLowerCase() === "airteltigo" ||
                                  tx.network?.toLowerCase() === "at") && (
                                  <img
                                    src="https://i.postimg.cc/0yXPdkQf/AIRTELTIGO-LOGO-1.jpg"
                                    alt="AirtelTigo"
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                )}
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium uppercase tracking-wider ${
                                    tx.network?.toLowerCase() === "mtn"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : tx.network?.toLowerCase() === "telecel"
                                        ? "bg-red-100 text-red-800"
                                        : tx.network?.toLowerCase() ===
                                              "airteltigo" ||
                                            tx.network?.toLowerCase() === "at"
                                          ? "bg-blue-100 text-blue-800"
                                          : "bg-slate-100 text-slate-800"
                                  }`}
                                >
                                  {tx.network || "Unknown"}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {tx.capacity || "N/A"}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900">
                              {tx.payer_phone_number || tx.payee_phone || "N/A"}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900">
                              {tx.recipient_phone || "N/A"}
                            </td>
                            <td className="px-6 py-4 text-right font-semibold text-slate-900">
                              ₵{Number(tx.amount || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  tx.status === "success" ||
                                  tx.status === "completed" ||
                                  tx.status === "paid"
                                    ? "bg-green-100 text-green-700"
                                    : tx.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : tx.status === "pending"
                                        ? "bg-yellow-100 text-yellow-700"
                                        : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {tx.status === "success" || tx.status === "paid"
                                  ? "Success"
                                  : tx.status || "N/A"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {(() => {
                                const state = getTransactionStatus(tx);
                                return (
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${state.color}`}>
                                    {state.icon}
                                    {state.label}
                                  </span>
                                );
                              })()}
                            </td>

                            <td className="px-6 py-4 text-center text-slate-600 font-medium font-mono text-xs">
                              {tx.delivery_attempts || 0}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setSelectedTransaction(tx)}
                                  className="p-2 text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors"
                                  title="View Details"
                                >
                                  <Search size={16} />
                                </button>
                                
                                {(() => {
                                  const state = getTransactionStatus(tx);

                                  return (
                                    <>
                                      {state.reconcile && (
                                        <button
                                          onClick={() => reconcileStatus(tx.id)}
                                          disabled={isReconciling === tx.id}
                                          className={`p-2 rounded-lg transition-colors text-indigo-600 hover:bg-indigo-50 ${isReconciling === tx.id ? "animate-spin" : ""}`}
                                          title="Sync/Reconcile with Provider"
                                        >
                                          <RefreshCw size={16} />
                                        </button>
                                      )}

                                      {state.retry && (
                                        <button
                                          onClick={() => retryVTU(tx.id)}
                                          disabled={isRetryingVTU === tx.id}
                                          className={`p-2 rounded-lg transition-colors ${
                                            isRetryingVTU === tx.id
                                              ? "text-slate-200 cursor-not-allowed"
                                              : "text-amber-600 hover:bg-amber-50"
                                          } ${isRetryingVTU === tx.id ? "animate-spin" : ""}`}
                                          title="Force Retry VTU"
                                        >
                                          <RefreshCw size={16} />
                                        </button>
                                      )}

                                      {!state.reconcile && tx.delivery_status !== "delivered" &&
                                        tx.vtu_status !== "success" &&
                                        tx.vtu_status !== "delivered" && (
                                          <button
                                            onClick={() => markDelivered(tx.id)}
                                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Mark as Delivered"
                                          >
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              width="16"
                                              height="16"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                            >
                                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                          </button>
                                      )}
                                    </>
                                  );
                                })()}
                                {(tx.vtu_status === "success" ||
                                  tx.delivery_status === "delivered") && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleWhatsAppMessage(tx)}
                                      disabled={!isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "")}
                                      className={`p-2 rounded-lg transition-colors ${isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "") ? "text-emerald-600 hover:bg-emerald-50" : "text-slate-300 cursor-not-allowed"}`}
                                      title={isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "") ? "Message Customer (WhatsApp)" : "Invalid phone number"}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                <button
                                  onClick={() => setTxToDelete(tx)}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Transaction"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalTransactions > 0 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-sm">
                  <div className="text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold text-slate-900">
                      {Math.min(
                        currentPage * ITEMS_PER_PAGE,
                        totalTransactions,
                      )}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-900">
                      {totalTransactions}
                    </span>{" "}
                    transactions
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || isLoadingTransactions}
                      className="px-3 py-1.5 border border-slate-200 rounded-md font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => p + 1)}
                      disabled={
                        currentPage >=
                          Math.ceil(totalTransactions / ITEMS_PER_PAGE) ||
                        isLoadingTransactions
                      }
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

        {currentView === "bundles" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Bundles Management
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-slate-500">
                    Manage network data bundles, pricing, and availability.
                  </p>
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-widest font-bold">
                    Real-time Active
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Last sync: {lastBundlesSync}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchBundles()}
                  className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                  title="Refresh Bundles"
                >
                  <RefreshCw
                    size={20}
                    className={isLoadingBundles ? "animate-spin" : ""}
                  />
                </button>
                <button
                  onClick={() => setIsAddingBundle(true)}
                  className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <div className="bg-white/20 p-1 rounded-lg">
                    <Database size={16} />
                  </div>
                  New Bundle
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                {
                  name: "MTN",
                  logo: "https://i.postimg.cc/BvS8nyGS/download.jpg",
                  color: "border-yellow-100",
                  bg: "bg-yellow-50",
                },
                {
                  name: "Telecel",
                  logo: "https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg",
                  color: "border-red-100",
                  bg: "bg-red-50",
                },
                {
                  name: "AirtelTigo",
                  logo: "https://i.postimg.cc/sfqT8kkW/images.jpg",
                  color: "border-blue-100",
                  bg: "bg-blue-50",
                },
              ].map((net) => {
                const count = bundles.filter(
                  (b) =>
                    b.network?.toLowerCase() === net.name.toLowerCase() ||
                    (net.name === "AirtelTigo" &&
                      b.network?.toLowerCase() === "at"),
                ).length;
                return (
                  <div
                    key={net.name}
                    className={`flex items-center p-4 rounded-2xl border ${net.color} ${net.bg} shadow-sm`}
                  >
                    <img
                      src={net.logo}
                      alt={net.name}
                      className="w-12 h-12 rounded-xl object-cover shadow-sm mr-4"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900">{net.name}</h4>
                      <p className="text-sm text-slate-500">
                        {count} Active Bundles
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Network</th>
                      <th className="px-6 py-4">DataHub Key</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4">Capacity</th>
                      <th className="px-6 py-4">Volume</th>
                      <th className="px-6 py-4 text-slate-400 font-medium">
                        Cost Price (₵)
                      </th>
                      <th className="px-6 py-4 text-indigo-700">
                        Selling Price (₵)
                      </th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoadingBundles ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          <Activity className="animate-spin text-indigo-500 h-8 w-8 mx-auto mb-3" />
                          <p>Loading bundles...</p>
                        </td>
                      </tr>
                    ) : bundles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-6 py-12 text-center text-slate-500"
                        >
                          <Database className="text-slate-300 h-8 w-8 mx-auto mb-3" />
                          <p>No bundles found.</p>
                        </td>
                      </tr>
                    ) : (
                      bundles.map((bundle) => {
                        const isEditing = editingBundle?.id === bundle.id;
                        return (
                          <tr
                            key={bundle.id}
                            className="hover:bg-slate-50/50 transition-colors"
                          >
                            <td className="px-6 py-4 font-medium text-slate-900">
                              <div className="flex items-center gap-3">
                                {bundle.network?.toLowerCase() === "mtn" && (
                                  <img
                                    src="https://i.postimg.cc/BvS8nyGS/download.jpg"
                                    alt="MTN"
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm"
                                  />
                                )}
                                {bundle.network?.toLowerCase() ===
                                  "telecel" && (
                                  <img
                                    src="https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg"
                                    alt="Telecel"
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm"
                                  />
                                )}
                                {(bundle.network?.toLowerCase() ===
                                  "airteltigo" ||
                                  bundle.network?.toLowerCase() === "at") && (
                                  <img
                                    src="https://i.postimg.cc/sfqT8kkW/images.jpg"
                                    alt="AirtelTigo"
                                    className="w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm"
                                  />
                                )}
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    bundle.network?.toLowerCase() === "mtn"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : bundle.network?.toLowerCase() ===
                                          "telecel"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-slate-100 text-slate-800"
                                  }`}
                                >
                                  {bundle.network}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                              {isEditing ? (
                                <select
                                  value={editingBundle.network_key || ""}
                                  onChange={(e) =>
                                    setEditingBundle({
                                      ...editingBundle,
                                      network_key: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px]"
                                >
                                  <option value="YELLO">YELLO</option>
                                  <option value="TELECEL">TELECEL</option>
                                  <option value="AT_PREMIUM">AT_PREMIUM</option>
                                  <option value="AT_BIGTIME">AT_BIGTIME</option>
                                </select>
                              ) : (
                                <div className="flex flex-col">
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {bundle.network_key}
                                  </span>
                                  {bundle.datahub_network_key && (
                                    <span className="text-[10px] text-slate-400 font-mono mt-1">
                                      DH: {bundle.datahub_network_key}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingBundle.description || ""}
                                  onChange={(e) =>
                                    setEditingBundle({
                                      ...editingBundle,
                                      description: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                              ) : (
                                bundle.description || "-"
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingBundle.capacity || ""}
                                  onChange={(e) =>
                                    setEditingBundle({
                                      ...editingBundle,
                                      capacity: e.target.value,
                                    })
                                  }
                                  className="w-24 px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                              ) : (
                                <div className="flex flex-col">
                                  <span className="text-slate-900 font-medium">
                                    {bundle.capacity}
                                  </span>
                                  {bundle.datahub_capacity && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      DH: {bundle.datahub_capacity}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditing ? (
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-slate-400 text-xs">
                                    ₵
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingBundle.cost_price || ""}
                                    onChange={(e) =>
                                      setEditingBundle({
                                        ...editingBundle,
                                        cost_price: e.target.value,
                                      })
                                    }
                                    className="pl-5 pr-2 py-1 w-24 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 text-sm italic text-slate-500"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-500 italic">
                                  ₵{Number(bundle.cost_price || 0).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isEditing ? (
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-slate-400 text-xs">
                                    ₵
                                  </span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingBundle.selling_price || ""}
                                    onChange={(e) =>
                                      setEditingBundle({
                                        ...editingBundle,
                                        selling_price: e.target.value,
                                      })
                                    }
                                    className="pl-5 pr-2 py-1 w-24 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm font-bold text-indigo-700"
                                  />
                                </div>
                              ) : (
                                <span className="font-bold text-indigo-700 text-lg">
                                  ₵{Number(bundle.selling_price).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() =>
                                  toggleBundleActive(
                                    bundle.id,
                                    bundle.is_active,
                                  )
                                }
                                disabled={isActionProcessing}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                  bundle.is_active
                                    ? "bg-green-500"
                                    : "bg-slate-300"
                                } ${isActionProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    bundle.is_active
                                      ? "translate-x-6"
                                      : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() =>
                                        handleUpdateBundle(bundle.id, {
                                          description:
                                            editingBundle.description,
                                          capacity: editingBundle.capacity,
                                          network_key:
                                            editingBundle.network_key,
                                          datahub_network_key:
                                            editingBundle.network_key,
                                          datahub_capacity:
                                            editingBundle.capacity
                                              ? editingBundle.capacity
                                                  .toUpperCase()
                                                  .replace("GB", "")
                                                  .trim()
                                              : "",
                                          selling_price:
                                            parseFloat(
                                              editingBundle.selling_price,
                                            ) || 0,
                                          cost_price:
                                            parseFloat(
                                              editingBundle.cost_price || "0",
                                            ) || 0,
                                        })
                                      }
                                      disabled={isActionProcessing}
                                      className="text-xs font-medium px-3 py-1 border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors disabled:opacity-50"
                                    >
                                      {isActionProcessing ? "..." : "Save"}
                                    </button>
                                    <button
                                      onClick={() => setEditingBundle(null)}
                                      disabled={isActionProcessing}
                                      className="text-xs font-medium px-3 py-1 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleEditClick(bundle)}
                                      disabled={isActionProcessing}
                                      className="text-indigo-600 hover:text-indigo-800 font-medium text-xs px-2 py-1 disabled:opacity-50"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => setBundleToDelete(bundle)}
                                      disabled={isActionProcessing}
                                      className="text-red-500 hover:text-red-700 font-medium text-xs px-2 py-1 disabled:opacity-50"
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
        {currentView === "customers" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
                <p className="text-slate-500 mt-1">
                  View customer summaries and their recent transactions.
                </p>
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
                  <h3 className="font-semibold text-slate-800">
                    Customer List
                  </h3>
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
                        .filter(
                          (c) =>
                            (c.recipient_phone &&
                              c.recipient_phone.includes(
                                customerSearchQuery,
                              )) ||
                            (c.email &&
                              c.email
                                .toLowerCase()
                                .includes(customerSearchQuery.toLowerCase())),
                        )
                        .map((customer) => {
                          const isActive =
                            selectedCustomerPhone === customer.recipient_phone;
                          return (
                            <li
                              key={`${customer.user_id || "guest"}-${customer.recipient_phone}`}
                            >
                              <div
                                className={`w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors ${isActive ? "bg-indigo-50/50" : ""}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-slate-900 truncate">
                                      {customer.recipient_phone || "Unknown"}
                                    </div>
                                    <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                      <CreditCard size={10} />
                                      {customer.transaction_count} orders
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                      <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                        ₵
                                        {Number(
                                          customer.total_spent || 0,
                                        ).toFixed(2)}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 ml-4">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        viewCustomer(customer.recipient_phone);
                                      }}
                                      className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleWhatsAppMessage({ recipient_phone: customer.recipient_phone });
                                      }}
                                      className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                      title="Message Customer"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.8 8.38 8.38 0 0 1 3.8.9L21 2z"></path>
                                      </svg>
                                    </button>
                                    {customer.user_id && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCustomerToDelete(customer);
                                        }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  )}
                </div>
              </div>

              {/* Transactions for Selected Customer */}
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px] max-h-[700px]">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800">
                    {selectedCustomerPhone
                      ? `Transactions for ${selectedCustomerPhone}`
                      : "Select a customer"}
                  </h3>
                </div>
                <div className="overflow-y-auto flex-1 p-6">
                  {!selectedCustomerPhone ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <CreditCard className="h-12 w-12 text-slate-200 mb-4" />
                      <p>
                        Select a customer from the list to view their
                        transactions.
                      </p>
                    </div>
                  ) : selectedCustomerPhone === "NONE" ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
                      <Activity className="h-12 w-12 text-slate-200 mb-4" />
                      <h4 className="font-semibold text-slate-700">
                        No Transaction History
                      </h4>
                      <p className="max-w-xs mt-2">
                        This user is registered but hasn't placed any data
                        orders yet.
                      </p>
                    </div>
                  ) : customerTransactions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500">
                      <Activity className="animate-spin text-indigo-500 h-8 w-8 mb-4" />
                      <p>Loading transactions...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {customerTransactions.map((tx) => {
                        const stuck = isStuck(tx);
                        return (
                          <div
                            key={tx.id}
                            className="border border-slate-100 rounded-xl p-4 hover:shadow-md transition-shadow relative group"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white uppercase text-[10px] ${
                                    tx.network?.toLowerCase() === "mtn"
                                      ? "bg-yellow-500"
                                      : tx.network?.toLowerCase() === "telecel"
                                        ? "bg-red-600"
                                        : tx.network?.toLowerCase() ===
                                              "airteltigo" ||
                                            tx.network?.toLowerCase() === "at"
                                          ? "bg-red-500"
                                          : "bg-slate-400"
                                  }`}
                                >
                                  {tx.network?.[0] || "?"}
                                </div>
                                <div>
                                  <div className="font-semibold text-slate-900">
                                    {tx.network} - {tx.capacity}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {new Date(tx.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-slate-900">
                                  ₵{Number(tx.amount).toFixed(2)}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Ref: {tx.id.substring(0, 8)}
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 mt-3 border-t border-slate-50">
                              <div className="flex gap-2 items-center">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    tx.delivery_status === "delivered" ||
                                    tx.vtu_status === "success" ||
                                    tx.vtu_status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : tx.delivery_status === "failed" ||
                                          tx.vtu_status === "failed"
                                        ? "bg-red-100 text-red-700"
                                        : tx.delivery_status === "delivering" ||
                                            tx.vtu_status === "processing"
                                          ? "bg-blue-100 text-blue-700 animate-pulse"
                                          : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {tx.delivery_status === "delivered" ||
                                  tx.vtu_status === "delivered" ||
                                  tx.vtu_status === "success"
                                    ? "DELIVERED"
                                    : tx.delivery_status === "failed" ||
                                        tx.vtu_status === "failed"
                                      ? "FAILED"
                                      : tx.delivery_status === "delivering" ||
                                          tx.vtu_status === "processing"
                                        ? "PROCESSING"
                                        : tx.vtu_status || "PENDING"}
                                </span>
                                {stuck && (
                                  <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ml-2">
                                    STUCK
                                  </span>
                                )}
                              </div>

                              <div className="flex gap-1.5 opacity-100 transition-opacity">
                                {(tx.vtu_status === "failed" ||
                                  tx.vtu_status === "pending" ||
                                  tx.delivery_status === "failed" ||
                                  stuck) && (
                                  <button
                                    onClick={() => retryVTU(tx.id)}
                                    disabled={
                                      isRetryingVTU === tx.id ||
                                      tx.delivery_status === "delivered" ||
                                      tx.vtu_status === "delivered" ||
                                      tx.vtu_status === "success" ||
                                      tx.delivery_status === "delivering" ||
                                      tx.vtu_status === "processing"
                                    }
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      isRetryingVTU === tx.id ||
                                      tx.delivery_status === "delivered" ||
                                      tx.vtu_status === "delivered" ||
                                      tx.vtu_status === "success" ||
                                      tx.delivery_status === "delivering" ||
                                      tx.vtu_status === "processing"
                                        ? "bg-slate-50 text-slate-300 cursor-not-allowed"
                                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    }`}
                                    title="Retry Delivery"
                                  >
                                    <RefreshCw
                                      size={14}
                                      className={
                                        isRetryingVTU === tx.id
                                          ? "animate-spin"
                                          : ""
                                      }
                                    />
                                  </button>
                                )}
                                {tx.delivery_status !== "delivered" &&
                                  tx.vtu_status !== "success" &&
                                  tx.vtu_status !== "delivered" && (
                                    <button
                                      onClick={() => markDelivered(tx.id)}
                                      className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
                                      title="Mark as Delivered"
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                      </svg>
                                    </button>
                                  )}
                                {(tx.vtu_status === "success" ||
                                  tx.delivery_status === "delivered") && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleWhatsAppMessage(tx)}
                                      disabled={!isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "")}
                                      className={`p-1.5 rounded-lg transition-colors ${isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "") ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}
                                      title={isValidPhoneNumber(tx.recipient_phone || tx.payer_phone_number || "") ? "Message Customer (WhatsApp)" : "Invalid phone number"}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {currentView === "settings" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <header className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                General Settings
              </h1>
              <p className="text-slate-500 mt-1">
                Configure global application variables and maintenance status.
              </p>
            </header>

            <div className="max-w-2xl bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <form onSubmit={handleUpdateSettings}>
                <div className="p-8 space-y-8">
                  {/* Maintenance Mode Section */}
                  <div
                    className={`p-6 rounded-2xl border-2 transition-all ${
                      appSettings.maintenance_mode
                        ? "bg-amber-50 border-amber-200"
                        : "bg-indigo-50/30 border-indigo-100"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Activity
                            className={
                              appSettings.maintenance_mode
                                ? "text-amber-600"
                                : "text-indigo-600"
                            }
                            size={20}
                          />
                          <h3 className="font-bold text-slate-900">
                            Maintenance Mode
                          </h3>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed max-w-md">
                          When active, all non-admin users will be blocked from
                          accessing the site and shown a maintenance screen.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAppSettings({
                            ...appSettings,
                            maintenance_mode: !appSettings.maintenance_mode,
                          })
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                          appSettings.maintenance_mode
                            ? "bg-amber-600"
                            : "bg-slate-200"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            appSettings.maintenance_mode
                              ? "translate-x-5"
                              : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* General Config */}
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Application Name
                        </label>
                        <input
                          type="text"
                          value={appSettings.app_name || ""}
                          onChange={(e) =>
                            setAppSettings({
                              ...appSettings,
                              app_name: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Platform Currency
                        </label>
                        <input
                          type="text"
                          value={appSettings.currency || ""}
                          onChange={(e) =>
                            setAppSettings({
                              ...appSettings,
                              currency: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                          placeholder="e.g. GHS"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                        Support Email Address
                      </label>
                      <input
                        type="email"
                        value={appSettings.support_email || ""}
                        onChange={(e) =>
                          setAppSettings({
                            ...appSettings,
                            support_email: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-2 italic">
                        This email will be displayed on the maintenance screen
                        and in help sections.
                      </p>
                    </div>
                  </div>

                  {/* WhatsApp Engagement Section */}
                  <div className="pt-8 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-slate-900">
                          Customer Messaging Hub
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="p-5 bg-gradient-to-r from-emerald-50 to-emerald-100/50 rounded-2xl border border-emerald-100 flex items-start gap-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl shrink-0">
                          <svg
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
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-emerald-900 font-black text-lg">
                            WhatsApp Ready{" "}
                            <span className="text-emerald-500 ml-1">✅</span>
                          </h4>
                          <p className="text-emerald-700/80 text-sm mt-1 mb-4 leading-relaxed max-w-lg">
                            Datapapa uses a sleek, modern WhatsApp-first
                            engagement experience for instant customer support
                            communication. Use the WhatsApp buttons in the
                            Transaction Ledger to manually send support and
                            delivery messages.
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const latestTx = transactions[0];
                                if (latestTx) {
                                  handleWhatsAppMessage(latestTx);
                                } else {
                                  alert("No customers available to message yet.");
                                }
                              }}
                              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-emerald-700 hover:scale-105 transition-all shadow-sm flex items-center gap-2"
                            >
                              <MessageSquare size={14} />
                              <span>Message Latest Customer</span>
                            </button>
                            <button
                              type="button"
                              onClick={openSupportWhatsApp}
                              className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-slate-800 hover:scale-105 transition-all shadow-sm flex items-center gap-2"
                            >
                              <HelpCircle size={14} />
                              <span>Contact Parent Support</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                document
                                  .getElementById("templatePreview")
                                  ?.scrollIntoView({ behavior: "smooth" })
                              }
                              className="px-4 py-2 bg-white text-emerald-700 hover:text-emerald-800 text-xs font-bold uppercase tracking-wider rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-all shadow-sm"
                            >
                              View Message Templates
                            </button>
                          </div>
                        </div>
                      </div>

                      <div id="templatePreview" className="space-y-4 pt-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          Primary Quick Template
                        </label>
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl relative group">
                          <pre className="text-sm font-medium text-slate-700 whitespace-pre-wrap font-sans">
                            Hello 👋{"\n"}
                            {"\n"}
                            Your Datapapa transaction is being processed successfully.{"\n"}
                            {"\n"}
                            📶 Network: {"{network}"}{"\n"}
                            📦 Bundle: {"{bundle}"}{"\n"}
                            📱 Recipient: {"{recipient}"}{"\n"}
                            🧾 Reference: {"{reference}"}{"\n"}
                            {"\n"}
                            Thank you for choosing Datapapa.
                          </pre>
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="px-2 py-1 bg-white text-slate-500 font-bold text-[10px] uppercase rounded-md shadow-sm border border-slate-200">
                              Pre-configured
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                          This template is automatically pre-filled when you
                          click the WhatsApp action icon in the Transactions
                          Ledger. Auto-sending is disabled to comply with
                          WhatsApp restrictions and prevent spam.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* DataHub Integration Section */}
                  <div className="pt-8 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Database className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-slate-900">
                          DataHubGH Integration
                        </h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsDataHubLocked(!isDataHubLocked)}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isDataHubLocked
                              ? "bg-amber-50 border-amber-200 text-amber-600"
                              : "bg-emerald-50 border-emerald-200 text-emerald-600"
                          }`}
                          title={isDataHubLocked ? "Unlock to edit" : "Lock settings"}
                        >
                          {isDataHubLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </button>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            dataHubSettings.status === "online"
                              ? "bg-emerald-100 text-emerald-700"
                              : dataHubSettings.status === "degraded"
                                ? "bg-amber-100 text-amber-700"
                                : dataHubSettings.status === "offline"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          <Activity
                            size={10}
                            className={`mr-1 ${dataHubSettings.status === "online" ? "animate-pulse" : ""}`}
                          />
                          {dataHubSettings.status || "inactive"}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          API Base URL
                        </label>
                        <input
                          type="text"
                          value={dataHubSettings.base_url || ""}
                          disabled={isDataHubLocked}
                          onChange={(e) =>
                            setDataHubSettings({
                              ...dataHubSettings,
                              base_url: e.target.value,
                            })
                          }
                          className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs ${
                            isDataHubLocked
                              ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                              : "bg-slate-50 border-slate-200"
                          }`}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                          API Key (sk_...)
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={dataHubSettings.api_key || ""}
                            disabled={isDataHubLocked}
                            onChange={(e) =>
                              setDataHubSettings({
                                ...dataHubSettings,
                                api_key: e.target.value,
                              })
                            }
                            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs ${
                              isDataHubLocked
                                ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed"
                                : "bg-slate-50 border-slate-200"
                            }`}
                            placeholder="Set via DATAHUB_API_KEY env or enter here"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <p className="text-[10px] text-slate-400 italic">
                        Note: Environment variable{" "}
                        <strong>DATAHUB_API_KEY</strong> takes precedence over
                        the value entered here.
                      </p>
                    </div>

                    {/* Balance Cards & Actions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 relative overflow-hidden group">
                        <Wallet
                          className="absolute -right-2 -bottom-2 text-indigo-200/50 group-hover:scale-110 transition-transform"
                          size={64}
                        />
                        <div className="relative z-10">
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                            Wallet Balance
                          </p>
                          <p className="text-xl font-black text-indigo-900">
                            {dataHubBalance !== null
                              ? `GHS ${dataHubBalance.toFixed(2)}`
                              : "₵ --.--"}
                          </p>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => syncWallet()}
                          disabled={isRefreshingDataHub}
                          className="w-full flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-white hover:border-indigo-300 hover:shadow-md transition-all group active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`mb-2 text-slate-400 group-hover:text-indigo-600 ${isRefreshingDataHub ? "animate-spin" : ""}`}
                            size={20}
                          />
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Sync Balance
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* API Logs */}
                    <div className="bg-slate-900 rounded-2xl p-6 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <History className="text-slate-400" size={16} />
                          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest">
                            Recent Activity
                          </h4>
                        </div>
                        <button
                          onClick={fetchDataHubLogs}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <RefreshCw
                            size={14}
                            className={isFetchingLogs ? "animate-spin" : ""}
                          />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {dataHubLogs.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-4 text-center">
                            No recent activity detected.
                          </p>
                        ) : (
                          dataHubLogs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-1.5 h-1.5 rounded-full ${log.status === "success" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"}`}
                                />
                                <div>
                                  <p className="text-[10px] font-mono text-slate-200 capitalize">
                                    {log.endpoint.replace("-", " ")}
                                  </p>
                                  <p className="text-[9px] text-slate-500">
                                    {new Date(log.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p
                                  className={`text-[10px] font-bold ${log.status === "success" ? "text-emerald-400" : "text-rose-400"}`}
                                >
                                  {log.status.toUpperCase()}
                                </p>
                                {log.response_time && (
                                  <p className="text-[9px] text-slate-600">
                                    {log.response_time}ms
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <ShieldCheck
                        className="text-indigo-600 shrink-0"
                        size={18}
                      />
                      <p className="text-xs text-indigo-800 leading-relaxed font-medium">
                        Datapapa uses <strong>DataHubGH</strong> for automated
                        data processing. Credentials are stored securely and
                        never exposed to the client-side.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingSettings || isLoadingSettings}
                    className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSavingSettings ? (
                      <>
                        <Activity className="animate-spin" size={18} />
                        Saving...
                      </>
                    ) : (
                      "Save All Changes"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </main>

      {/* Main Footer or generic content if needed */}
      <AnimatePresence>
        {bundleToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBundleToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 overflow-y-auto">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <Database size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Delete Data Bundle?
                </h3>
                <p className="text-slate-600 mb-6 font-medium">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">
                    {bundleToDelete.network} {bundleToDelete.capacity}
                  </span>
                  ? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDeleteBundle(bundleToDelete.id)}
                    disabled={isActionProcessing}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                  >
                    {isActionProcessing ? "Deleting..." : "Yes, Delete"}
                  </button>
                  <button
                    onClick={() => setBundleToDelete(null)}
                    disabled={isActionProcessing}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {customerToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCustomerToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-8 overflow-y-auto">
                <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <Users size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  Delete Customer?
                </h3>
                <p className="text-slate-600 mb-6 font-medium">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">
                    {customerToDelete.recipient_phone}
                  </span>
                  ? This will also remove their transaction history.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      handleDeleteCustomer(customerToDelete.user_id)
                    }
                    disabled={isActionProcessing}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50"
                  >
                    {isActionProcessing ? "Deleting..." : "Delete Customer"}
                  </button>
                  <button
                    onClick={() => setCustomerToDelete(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {viewingCustomerTransactions && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingCustomerTransactions(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Transaction History
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingCustomerTransactions.email}
                  </p>
                </div>
                <button
                  onClick={() => setViewingCustomerTransactions(null)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {selectedCustomerPhone === "NONE" ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500 text-center">
                    <Activity className="h-12 w-12 text-slate-200 mb-4" />
                    <h4 className="font-semibold text-slate-700">No History</h4>
                    <p className="max-w-xs mt-2">
                      This user has not placed any orders yet.
                    </p>
                  </div>
                ) : customerTransactions.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                    <Activity className="animate-spin text-indigo-500 h-8 w-8 mb-4" />
                    <p>Fetching transactions...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {customerTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all bg-slate-50/50"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {tx.network} - {tx.capacity}
                            </div>
                            <div className="text-xs text-slate-500">
                              {new Date(tx.created_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="font-bold text-indigo-600">
                            ₵{Number(tx.amount).toFixed(2)}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200/50">
                          <div className="text-xs font-mono text-slate-400">
                            Ref: {tx.paystack_receipt || tx.id.substring(0, 8)}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleWhatsAppMessage(tx);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Message via WhatsApp"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-13.8 8.38 8.38 0 0 1 3.8.9L21 2z"></path>
                              </svg>
                            </button>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                tx.status === "success" ||
                                tx.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : tx.status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : tx.status === "pending"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {tx.status || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setViewingCustomerTransactions(null)}
                  className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isAddingBundle && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingBundle(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <form
                onSubmit={handleCreateBundle}
                className="flex flex-col h-full overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-slate-900">
                    Add New Data Bundle
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingBundle(false)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Network
                      </label>
                      <select
                        value={newBundle.network || "MTN"}
                        onChange={(e) => {
                          const net = e.target.value;
                          let key = "YELLO";
                          if (net === "Telecel") key = "TELECEL";
                          if (net === "AirtelTigo") key = "AT_BIGTIME";
                          setNewBundle({
                            ...newBundle,
                            network: net,
                            network_key: key,
                            datahub_network_key: key,
                          });
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="MTN">MTN</option>
                        <option value="Telecel">Telecel</option>
                        <option value="AirtelTigo">AirtelTigo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Display Cap (e.g. 1GB)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1GB"
                        value={newBundle.capacity || ""}
                        onChange={(e) => {
                          const cap = e.target.value;
                          setNewBundle({
                            ...newBundle,
                            capacity: cap,
                            // Auto-set datahub fields but allow manual override in other fields
                          });
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        DataHub Network Key
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. YELLO"
                        value={newBundle.datahub_network_key || ""}
                        onChange={(e) =>
                          setNewBundle({
                            ...newBundle,
                            datahub_network_key: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        DataHub Capacity (MB)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1000"
                        value={newBundle.datahub_capacity || ""}
                        onChange={(e) =>
                          setNewBundle({
                            ...newBundle,
                            datahub_capacity: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Regular Daily Plan"
                      value={newBundle.description || ""}
                      onChange={(e) =>
                        setNewBundle({
                          ...newBundle,
                          description: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Cost Price (₵)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newBundle.cost_price || ""}
                        onChange={(e) =>
                          setNewBundle({
                            ...newBundle,
                            cost_price: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Selling Price (₵)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newBundle.selling_price || ""}
                        onChange={(e) =>
                          setNewBundle({
                            ...newBundle,
                            selling_price: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={newBundle.is_active}
                      onChange={(e) =>
                        setNewBundle({
                          ...newBundle,
                          is_active: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <label
                      htmlFor="is_active"
                      className="text-sm font-medium text-slate-700"
                    >
                      Activate bundle immediately
                    </label>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingBundle(false)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateBundle}
                    disabled={isActionProcessing}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    {isActionProcessing ? "Creating..." : "Create Bundle"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdateBundle();
                }}
                className="flex flex-col h-full overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
                  <h3 className="text-lg font-bold text-slate-900">
                    Edit Data Bundle
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Network
                      </label>
                      <select
                        value={form.network || "MTN"}
                        onChange={(e) => {
                          const net = e.target.value;
                          let key = "YELLO" as any;
                          if (net === "Telecel") key = "TELECEL";
                          if (net === "AirtelTigo") key = "AT_BIGTIME";
                          setForm({ ...form, network: net, network_key: key });
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      >
                        <option value="MTN">MTN</option>
                        <option value="Telecel">Telecel</option>
                        <option value="AirtelTigo">AirtelTigo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Display Cap (e.g. 1GB)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1GB"
                        value={form.capacity || ""}
                        onChange={(e) =>
                          setForm({ ...form, capacity: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        DataHub Network Key
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. YELLO"
                        value={form.datahub_network_key || ""}
                        onChange={(e) =>
                          setForm({ ...form, datahub_network_key: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        DataHub Capacity (MB)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1000"
                        value={form.datahub_capacity || ""}
                        onChange={(e) =>
                          setForm({ ...form, datahub_capacity: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Regular Daily Plan"
                      value={form.description || ""}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Cost Price (₵)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.cost_price || ""}
                        onChange={(e) =>
                          setForm({ ...form, cost_price: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Selling Price (₵)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={form.selling_price || ""}
                        onChange={(e) =>
                          setForm({ ...form, selling_price: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isActionProcessing}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
                  >
                    {isActionProcessing ? "Updating..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Transaction Details Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTransaction(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="text-indigo-500" size={20} />
                  Transaction Details
                </h3>
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Internal Ref
                      </label>
                      <p className="font-mono text-sm text-slate-900 bg-slate-50 p-2 rounded border border-slate-100 break-all">
                        {selectedTransaction.internal_reference || selectedTransaction.id}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Provider Ref
                      </label>
                      <p className="font-mono text-sm text-slate-900 bg-slate-50 p-2 rounded border border-slate-100 break-all">
                        {selectedTransaction.provider_reference || selectedTransaction.external_reference || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Network
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 capitalize">
                          {selectedTransaction.network}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Recipient
                      </label>
                      <p className="font-bold text-lg text-slate-900">
                        {selectedTransaction.recipient_phone}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Payer Phone
                      </label>
                      <p className="font-medium text-slate-900">
                        {selectedTransaction.payer_phone_number ||
                          selectedTransaction.payee_phone ||
                          "N/A"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Paystack Receipt
                      </label>
                      <p className="font-mono text-sm text-slate-900">
                        {selectedTransaction.paystack_receipt || "N/A"}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Date & Time
                      </label>
                      <p className="font-medium text-slate-900">
                        {new Date(
                          selectedTransaction.created_at,
                        ).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                        Amount
                      </label>
                      <p className="text-2xl font-black text-indigo-600">
                        ₵{Number(selectedTransaction.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      Reconciliation State
                    </label>
                    <span className="font-mono text-sm font-semibold text-slate-700 capitalize">
                      {(selectedTransaction.reconciliation_state || "N/A").replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      Provider Accepted At
                    </label>
                    <p className="font-mono text-sm">
                      {selectedTransaction.provider_accepted_at 
                        ? new Date(selectedTransaction.provider_accepted_at).toLocaleString() 
                        : "N/A"}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      Payment Status
                    </label>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedTransaction.status === "success"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {selectedTransaction.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      VTU Delivery Status
                    </label>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedTransaction.delivery_status === "delivered" ||
                        selectedTransaction.vtu_status === "success" ||
                        selectedTransaction.vtu_status === "delivered"
                          ? "bg-emerald-100 text-emerald-700"
                          : selectedTransaction.delivery_status === "failed" ||
                              selectedTransaction.vtu_status === "failed"
                            ? "bg-rose-100 text-rose-700"
                            : selectedTransaction.delivery_status ===
                                  "delivering" ||
                                selectedTransaction.vtu_status === "processing"
                              ? "bg-amber-100 text-amber-700 animate-pulse"
                              : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {selectedTransaction.delivery_status === "delivered" ||
                      selectedTransaction.vtu_status === "delivered" ||
                      selectedTransaction.vtu_status === "success"
                        ? "DELIVERED"
                        : selectedTransaction.delivery_status === "failed" ||
                            selectedTransaction.vtu_status === "failed"
                          ? "FAILED"
                          : selectedTransaction.delivery_status ===
                                "delivering" ||
                              selectedTransaction.vtu_status === "processing"
                            ? "PROCESSING"
                            : selectedTransaction.vtu_status || "PENDING"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                {selectedTransaction.delivery_status !== 'delivered' && selectedTransaction.vtu_status !== 'success' && (
                  <>
                    <button
                      onClick={() => reconcileStatus(selectedTransaction.id)}
                      disabled={isReconciling === selectedTransaction.id}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw size={16} className={isReconciling === selectedTransaction.id ? "animate-spin" : ""} />
                      Sync Status
                    </button>
                    <button
                      onClick={() => retryVTU(selectedTransaction.id)}
                      disabled={isRetryingVTU === selectedTransaction.id}
                      className="px-4 py-2 bg-amber-50 text-amber-700 font-bold rounded-xl hover:bg-amber-100 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw size={16} className={isRetryingVTU === selectedTransaction.id ? "animate-spin" : ""} />
                      Force Retry
                    </button>
                  </>
                )}
                <button
                  onClick={() => setSelectedTransaction(null)}
                  className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Transaction Confirmation */}
        {txToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTxToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center overflow-y-auto max-h-[90vh] flex flex-col"
            >
              <div className="overflow-y-auto flex-1">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <X size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Delete Transaction?
                </h3>
                <p className="text-slate-500 mb-8">
                  Are you sure you want to delete this transaction record? This
                  action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTxToDelete(null)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteTransaction(txToDelete.id)}
                    disabled={isDeletingTx}
                    className="flex-1 px-6 py-3 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {isDeletingTx ? "Deleting..." : "Confirm Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
  );
}
