import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { 
  Gift, Trophy, Users, CheckCircle2, ArrowRight, History, PlayCircle, Loader2, MessageCircle
} from "lucide-react";
import toast from "react-hot-toast";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import axios from "axios";
import { API_ROUTES } from "../../../lib/constants";
import { openWhatsApp } from "../../lib/whatsapp";

export const AppreciationRewardsView = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  
  // Data state
  const [eligibleCustomers, setEligibleCustomers] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [pendingRewards, setPendingRewards] = useState<any[]>([]);
  const [winnersHistory, setWinnersHistory] = useState<any[]>([]);
  
  // Selection/Generation state
  const [isSelecting, setIsSelecting] = useState(false);
  const [numWinners, setNumWinners] = useState(5);
  
  // Processing state
  const [isApproving, setIsApproving] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();

    // Set up realtime subscriptions
    const transactionsChannel = supabase
      .channel('appreciation-tx-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchEligibleCustomers();
      })
      .subscribe();

    const rewardsChannel = supabase
      .channel('appreciation-rewards-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appreciation_rewards' }, () => {
        fetchPendingRewards();
        fetchWinnersHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(rewardsChannel);
    };
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchEligibleCustomers(),
        fetchPendingRewards(),
        fetchWinnersHistory(),
      ]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load rewards data. Have you ran the REWARDS_SCHEMA.sql script?");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEligibleCustomers = async () => {
    // Sync and connect with the Customers tab data using the unified RPC
    const { data: summariesData, error: summariesError } = await supabase.rpc(
      "get_customers_summary",
    );

    if (summariesError) throw summariesError;

    const customersMap = new Map<string, any>();
    
    (summariesData || []).forEach((c: any) => {
      const phone = c.recipient_phone;
      if (!phone || phone === "NONE" || phone === "No phone recorded") return;
      
      customersMap.set(phone, {
        phone: c.recipient_phone,
        network: c.network,
        total_spend: Number(c.total_spent || 0),
        transaction_count: Number(c.transaction_count || 0),
        last_purchase: c.last_transaction,
        txs: [] // we don't have individual txs from summary, but it's not strictly needed for the view
      });
    });

    // Filter >= 25 GHS total spend (you can adjust this threshold if needed)
    const eligible = Array.from(customersMap.values()).filter(c => c.total_spend >= 25);
    // Sort by spend
    eligible.sort((a, b) => b.total_spend - a.total_spend);
    
    setEligibleCustomers(eligible);
  };

  const fetchPendingRewards = async () => {
    const { data, error } = await supabase
      .from('appreciation_rewards')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: false });
    
    if (error) {
      if (error.code === '42P01') {
         // table doesn't exist
         return;
      }
      throw error;
    }
    setPendingRewards(data || []);
  };

  const fetchWinnersHistory = async () => {
    const { data, error } = await supabase
      .from('appreciation_rewards')
      .select('*')
      .neq('status', 'pending_approval')
      .order('updated_at', { ascending: false })
      .limit(100);
      
    if (error) {
      if (error.code === '42P01') return;
      throw error;
    }
    setWinnersHistory(data || []);
  };

  const handlePickRandomWinners = async () => {
    if (eligibleCustomers.length === 0) {
      toast.error("No eligible customers to choose from.");
      return;
    }

    setIsSelecting(true);
    try {
      // Create cycle
      const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const endOfCurrentWeek = endOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      
      const { data: cycleData, error: cycleErr } = await supabase
        .from('appreciation_reward_cycles')
        .insert({
          cycle_start: startOfCurrentWeek,
          cycle_end: endOfCurrentWeek,
          total_eligible: eligibleCustomers.length,
        })
        .select()
        .single();

      if (cycleErr) throw cycleErr;

      // Ensure we don't pick previous winners from this same cycle
      const { data: existingWinners } = await supabase
        .from('appreciation_rewards')
        .select('customer_phone')
        .in('status', ['pending_approval', 'sent']);

      const existingWinnerPhones = new Set((existingWinners || []).map(w => w.customer_phone));

      const candidates = eligibleCustomers.filter(c => !existingWinnerPhones.has(c.phone));

      if (candidates.length === 0) {
        toast.info("All eligible customers have already been randomly selected.");
        setIsSelecting(false);
        return;
      }

      // Shuffle and pick
      const shuffled = [...candidates].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.min(numWinners, shuffled.length));

      // Insert unapproved rewards
      const inserts = selected.map(c => ({
        customer_phone: c.phone,
        network: c.network,
        reward_type: 'data',
        reward_value: '1 GB',
        reward_cycle: cycleData.id,
        status: 'pending_approval'
      }));

      const { error: insErr } = await supabase.from('appreciation_rewards').insert(inserts);
      if (insErr) throw insErr;
      
      toast.success(`${selected.length} random winners selected successfully.`);
      await fetchPendingRewards();
      setActiveTab("pending");
    } catch (e: any) {
      toast.error("Failed to pick winners: " + e.message);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleApproveReward = async (rewardId: string, phone: string, network: string) => {
    if (!confirm(`Are you sure you want to approve sending 1GB to ${phone}? This will execute immediately.`)) return;
    
    setIsApproving(rewardId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      
      const res = await axios.post('/api/admin-rewards', {
        action: 'approve_reward',
        rewardId
      }, { headers });

      if (res.data.success) {
        toast.success(`Reward approved and sent to ${phone}`);
        await Promise.all([fetchPendingRewards(), fetchWinnersHistory()]);
        
        // Open WhatsApp Message
        const message = `🎉 *DATAPAPA APPRECIATION REWARD* 🎁\n\nCongratulations!\n\nYou have received a FREE 1GB bundle from Datapapa for your continuous patronage and support ❤️\n\nThank you for choosing Datapapa.`;
        openWhatsApp({
          phone: phone,
          message: message
        });
      } else {
        throw new Error(res.data.error || "Unknown error");
      }
    } catch (e: any) {
      toast.error("Failed to approve reward: " + (e.response?.data?.error || e.message));
    } finally {
      setIsApproving(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Gift className="text-emerald-500" /> Appreciation Rewards
        </h1>
        <p className="text-slate-500 mt-1">
          Simple weekly engagement program. Active users over GHS 25 are eligible.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "overview" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("eligible")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "eligible" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Eligible ({eligibleCustomers.length})
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "pending" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Pending Approvals 
          {pendingRewards.length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {pendingRewards.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "history" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          History
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="animate-spin text-slate-300" size={32} />
        </div>
      ) : (
        <div className="mt-6">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Eligible This Week</p>
                  <p className="text-2xl font-black text-slate-800">{eligibleCustomers.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <PlayCircle size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Approvals</p>
                  <p className="text-2xl font-black text-slate-800">{pendingRewards.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Trophy size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Rewarded</p>
                  <p className="text-2xl font-black text-slate-800">
                    {winnersHistory.filter(w => w.status === 'sent').length}
                  </p>
                </div>
              </div>
              
              <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-sm flex flex-col justify-center">
                 <h3 className="font-bold text-lg mb-2">Pick Winners</h3>
                 <div className="flex gap-2 mb-3">
                   <select 
                     className="bg-indigo-700 text-white border-none rounded-lg text-sm flex-1 outline-none font-bold p-2"
                     value={numWinners}
                     onChange={e => setNumWinners(Number(e.target.value))}
                   >
                     <option value={1}>1 Winner</option>
                     <option value={3}>3 Winners</option>
                     <option value={5}>5 Winners</option>
                     <option value={10}>10 Winners</option>
                   </select>
                 </div>
                 <button 
                  onClick={handlePickRandomWinners}
                  disabled={isSelecting || eligibleCustomers.length === 0}
                  className="w-full py-2 bg-white text-indigo-600 hover:bg-slate-50 font-black rounded-xl text-sm transition-all disabled:opacity-50"
                 >
                   {isSelecting ? "Rolling Picks..." : "Roll Dice 🎲"}
                 </button>
              </div>
            </div>
          )}

          {/* ELIGIBLE TAB */}
          {activeTab === "eligible" && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4">Network</th>
                    <th className="px-6 py-4">Weekly Spend</th>
                    <th className="px-6 py-4">Tx Count</th>
                    <th className="px-6 py-4">Last Activity</th>
                    <th className="px-6 py-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {eligibleCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No customers have spent GHS 25 or more this week yet.
                      </td>
                    </tr>
                  ) : (
                    eligibleCustomers.map((c) => (
                      <tr key={c.phone} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-800">{c.phone}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex uppercase tracking-wider text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">
                            {c.network}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-emerald-600 font-bold">GHS {c.total_spend.toFixed(2)}</td>
                        <td className="px-6 py-4">{c.transaction_count}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(c.last_purchase).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center gap-1 text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full text-[10px] font-bold uppercase">
                            <CheckCircle2 size={12} /> Eligible
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* PENDING / MANUAL APPROVAL TAB */}
          {activeTab === "pending" && (
            <div className="bg-amber-50/30 border border-amber-100 rounded-2xl shadow-sm overflow-hidden">
               <div className="p-6 border-b border-amber-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-white">
                  <div>
                    <h3 className="font-bold text-amber-900 flex items-center gap-2">
                       <PlayCircle className="text-amber-500" /> Pending Approval
                    </h3>
                    <p className="text-xs text-amber-700/70 mt-1">
                      These customers were randomly selected but haven't received their 1GB reward yet. Approve them to dispatch.
                    </p>
                  </div>
               </div>
               <table className="w-full text-left text-sm whitespace-nowrap bg-white">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4">Network</th>
                    <th className="px-6 py-4">Reward</th>
                    <th className="px-6 py-4">Selection Date</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRewards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No pending rewards to approve.
                      </td>
                    </tr>
                  ) : (
                    pendingRewards.map((r) => (
                      <tr key={r.id} className="hover:bg-amber-50/10">
                        <td className="px-6 py-4 font-bold text-slate-800">{r.customer_phone}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex uppercase tracking-wider text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">
                            {r.network}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{r.reward_value}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleApproveReward(r.id, r.customer_phone, r.network)}
                            disabled={isApproving !== null}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 inline-flex"
                          >
                             {isApproving === r.id ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Approve & Send
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* HISTORY TAB */}
          {activeTab === "history" && (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
               <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Phone Number</th>
                    <th className="px-6 py-4">Network</th>
                    <th className="px-6 py-4">Reward</th>
                    <th className="px-6 py-4">Approved By</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {winnersHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No rewards history found.
                      </td>
                    </tr>
                  ) : (
                    winnersHistory.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-800">{r.customer_phone}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex uppercase tracking-wider text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-600">
                            {r.network}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">{r.reward_value}</td>
                        <td className="px-6 py-4 font-mono text-[10px] text-slate-500">{r.approved_by || 'System'}</td>
                        <td className="px-6 py-4 text-slate-500">{r.rewarded_at ? new Date(r.rewarded_at).toLocaleString() : 'N/A'}</td>
                        <td className="px-6 py-4">
                           <span className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                             r.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 
                             r.status === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                           }`}>
                             {r.status}
                           </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
