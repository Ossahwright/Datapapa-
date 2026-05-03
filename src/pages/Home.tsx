import { Link } from "react-router-dom";
import { 
  Zap, 
  ShieldCheck, 
  Globe, 
  CreditCard, 
  ChevronRight, 
  Smartphone, 
  MessageCircle,
  MessageSquare,
  RefreshCw,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import axios from "axios";
import BuyDataForm from "../components/BuyDataForm";
import { supabase } from "../lib/supabase";

interface HomeProps {
  settings: {
    app_name: string;
    currency: string;
    support_email: string;
    maintenance_mode: boolean;
    sms_enabled: boolean;
    sms_sender_id: string;
    sms_template_success: string;
  } | null;
}

const statusMap: Record<string, string> = {
  success: "✅ Delivered",
  failed: "❌ Failed",
  processing: "⏳ Processing",
};

export default function Home({ settings }: HomeProps) {
  const [user, setUser] = useState<any>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        fetchUserTransactions(data.user.id);
      }
    };
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserTransactions(session.user.id);
      } else {
        setUser(null);
        setUserTransactions([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserTransactions = async (userId: string) => {
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setUserTransactions(data || []);
    } catch (err) {
      console.error("Failed to fetch user transactions:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel("user-transactions")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
        },
        (payload) => {
          setUserTransactions(prev =>
            prev.map(t =>
              t.id === payload.new.id ? { ...t, ...payload.new } : t
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const retryVTU = async (transactionId: string) => {
    try {
      const res = await axios.post("/api/retry-vtu", { transactionId });
      alert(res.data.message || "Retry executed");
    } catch (err: any) {
      console.error("Retry failed:", err);
      alert("Retry failed: " + (err.response?.data?.message || err.message));
    }
  };

  const resendSMS = async (tx: any) => {
    try {
      const res = await axios.post("/api/resend-sms", { transactionId: tx.id });
      alert(res.data.message || "SMS resent");
    } catch (err: any) {
      console.error("SMS resend failed:", err);
      alert("SMS resend failed: " + (err.response?.data?.message || err.message));
    }
  };

  const appName = settings?.app_name || "Datapapa";

  const scrollToForm = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.getElementById('buy-data');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative pt-20 pb-20 overflow-hidden bg-white sm:pt-32 sm:pb-28 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium text-sm mb-6 border border-indigo-100">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600"></span>
              Fastest automated data delivery
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl mb-6">
              Buy Data Instantly — <br className="hidden sm:block" />
              <span className="text-indigo-600">No Delays</span>
            </h1>
            <p className="mt-4 text-lg text-slate-600 sm:text-xl max-w-2xl mx-auto mb-10">
              Fast, reliable, and affordable data bundles delivered in seconds. Stop waiting around for your data to arrive.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                href="#buy-data"
                onClick={scrollToForm}
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all active:scale-95 cursor-pointer"
              >
                Buy Data <ChevronRight size={18} />
              </a>
              <a 
                href="#how-it-works" 
                className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-xl bg-white border border-slate-200 px-8 py-3.5 text-base font-medium text-slate-700 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
              >
                Learn More
              </a>
            </div>
          </motion.div>
        </div>
        
        {/* Decorative Grid */}
        <div className="absolute inset-x-0 -bottom-40 transform-gpu overflow-hidden blur-3xl sm:-bottom-80" aria-hidden="true">
          <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"></div>
        </div>
      </section>

      {/* Unified Buy Data Process Section */}
      <section className="py-20 bg-slate-50 border-t border-slate-100 relative -mt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BuyDataForm settings={settings} />
        </div>
      </section>

      {/* Order History Section (for logged in users) */}
      {user && (
        <section className="py-16 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-lg">
                  <History size={20} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Your Recent Orders</h2>
              </div>
              <button 
                onClick={() => fetchUserTransactions(user.id)}
                className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm flex items-center gap-2"
              >
                {isLoadingHistory ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Refresh
              </button>
            </div>

            {userTransactions.length === 0 ? (
              <div className="bg-slate-50 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200">
                <div className="mx-auto w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
                  <Clock size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">No orders yet</h3>
                <p className="text-slate-500">Your recent data purchases will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userTransactions.map((tx) => (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm shadow-slate-100 hover:shadow-md transition-all group"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white uppercase ${
                          tx.network?.toLowerCase() === 'mtn' ? 'bg-yellow-500' :
                          tx.network?.toLowerCase() === 'telecel' ? 'bg-red-600' :
                          tx.network?.toLowerCase() === 'airteltigo' || tx.network?.toLowerCase() === 'at' ? 'bg-red-500' :
                          'bg-slate-400'
                        }`}>
                          {tx.network?.[0] || '?'}
                        </div>
                        <div>
                          <div className={`text-xs font-bold uppercase tracking-wider ${
                            tx.vtu_status === 'success' ? 'text-green-600' :
                            tx.vtu_status === 'failed' ? 'text-red-500' :
                            'text-amber-600'
                          }`}>
                            {statusMap[tx.vtu_status as string] || "⏳ Processing"}
                          </div>
                          <div className="font-bold text-slate-900">{tx.capacity} {tx.network}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-mono mb-1">Ref: {tx.id.slice(0, 8)}</div>
                        <div className="text-sm font-bold text-indigo-600">₵{Number(tx.amount).toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-6">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Recipient</span>
                        <span className="font-semibold text-slate-900">{tx.recipient_phone}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Date</span>
                        <span className="text-slate-700">{new Date(tx.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-50">
                      {(tx.vtu_status === 'failed' || tx.vtu_status === 'pending') && (
                        <button 
                          onClick={() => retryVTU(tx.id)}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <RefreshCw size={12} />
                          Retry
                        </button>
                      )}
                      {tx.vtu_status === 'success' && (
                        <button 
                          onClick={() => resendSMS(tx)}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <MessageSquare size={12} />
                          Resend SMS
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Networks Supported */}
      <section className="py-10 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500 mb-6">
            Supported Networks
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
            <div className="flex items-center gap-3 font-bold text-xl md:text-2xl text-yellow-500">
              <img src="https://i.postimg.cc/BvS8nyGS/download.jpg" alt="MTN" className="w-10 h-10 rounded-lg object-cover" />
              MTN
            </div>
            <div className="flex items-center gap-3 font-bold text-xl md:text-2xl text-red-600">
              <img src="https://i.postimg.cc/NMVk3XP3/IMG-1960.jpg" alt="Telecel" className="w-10 h-10 rounded-lg object-cover" />
              Telecel
            </div>
            <div className="flex items-center gap-3 font-bold text-xl md:text-2xl text-red-500">
              <img src="https://i.postimg.cc/sfqT8kkW/images.jpg" alt="AirtelTigo" className="w-10 h-10 rounded-lg object-cover" />
              AirtelTigo
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Data in 3 Simple Steps
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              We've simplified the process so you can get back online faster.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-100 -z-10"></div>
            
            {[
              { num: "01", title: "Select Network", desc: "Choose your preferred mobile network provider from our supported list." },
              { num: "02", title: "Choose Bundle", desc: "Pick a data package that fits your needs and budget perfectly." },
              { num: "03", title: "Pay & Receive", desc: "Enter your number securely via Paystack and get your data instantly." }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl shadow-sm mb-6 z-10 relative">
                  {step.num}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-slate-900 text-white rounded-t-[3rem]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-4">
                <Zap size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">Instant Delivery</h3>
              <p className="text-slate-400 text-sm">No waiting. Data is sent directly to your phone the moment payment is confirmed.</p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 text-green-300 flex items-center justify-center mb-4">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">Secure Payments</h3>
              <p className="text-slate-400 text-sm">Bank-grade security ensures your payment details are safe and never stored.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center mb-4">
                <Globe size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">All Networks</h3>
              <p className="text-slate-400 text-sm">We support all major telecommunication networks in the country.</p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center mb-4">
                <CreditCard size={24} />
              </div>
              <h3 className="text-lg font-bold mb-2">Affordable Pricing</h3>
              <p className="text-slate-400 text-sm">Get more value for your money with our highly competitive data pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Subtle Footer */}
      <footer className="py-12 bg-slate-900 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1 rounded-lg">
              <Smartphone size={16} />
            </div>
            <span className="font-bold text-lg tracking-tight text-white">{appName}</span>
          </div>
          
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} {appName}. All rights reserved.
          </div>

          <div className="flex items-center gap-6">
             <Link 
              to="/admin/auth" 
              className="text-slate-700 hover:text-slate-500 text-[10px] uppercase tracking-widest font-bold transition-all duration-300"
            >
              Admin Access
            </Link>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button */}
      <motion.a
        href="https://wa.me/233244014207"
        target="_blank"
        rel="noopener noreferrer"
        initial={{ opacity: 0, scale: 0.5, y: 100 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-16 h-16 bg-[#25D366] text-white rounded-full shadow-2xl hover:bg-[#20ba5a] transition-all group"
        title="Chat with Customer Service"
      >
        <div className="absolute -top-12 right-0 bg-slate-900 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold uppercase tracking-wider">
          Chat with us
        </div>
        <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </motion.a>
    </div>
  );
}
