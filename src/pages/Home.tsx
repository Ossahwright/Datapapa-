import { Link } from "react-router-dom";
import { Zap, ShieldCheck, Globe, CreditCard, ChevronRight, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import React, { useEffect } from "react";
import BuyDataForm from "../components/BuyDataForm";
import { supabase } from "../lib/supabase";

export default function Home() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from('test_table')
        .select('*');
      
      console.log('TEST TABLE DATA:', data);
      console.log('TEST TABLE ERROR:', error);
    }
    testConnection();
  }, []);

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
          <BuyDataForm />
        </div>
      </section>

      {/* Networks Supported */}
      <section className="py-10 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-500 mb-6">
            Supported Networks
          </p>
          <div className="flex justify-center gap-8 md:gap-16 opacity-75 grayscale hover:grayscale-0 transition-all duration-300">
            {/* Generic placeholder icons for networks since we don't have their official SVGs */}
            <div className="flex items-center gap-2 font-bold text-xl md:text-2xl text-yellow-500"><Smartphone /> MTN</div>
            <div className="flex items-center gap-2 font-bold text-xl md:text-2xl text-red-600"><Smartphone /> Telecel</div>
            <div className="flex items-center gap-2 font-bold text-xl md:text-2xl text-red-500"><Smartphone /> AirtelTigo</div>
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
            <span className="font-bold text-lg tracking-tight text-white">Datapapa</span>
          </div>
          
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Datapapa. All rights reserved.
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
    </div>
  );
}
