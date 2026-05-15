import { Link } from "react-router-dom";
import { 
  Zap, 
  ShieldCheck, 
  Globe, 
  CreditCard, 
  ChevronRight, 
  Smartphone
} from "lucide-react";
import { motion } from "motion/react";
import React, { useEffect, useState } from "react";
import BuyDataForm from "../components/BuyDataForm";
import { supabase } from "../lib/supabase";
import { openWhatsApp } from "../lib/whatsapp";

interface HomeProps {
  settings: {
    app_name: string;
    currency: string;
    support_email: string;
    maintenance_mode: boolean;
  } | null;
}

export default function Home({ settings }: HomeProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      <section id="how-it-works" className="py-20 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Data in 3 Simple Steps
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              We've simplified the process so you can get back online faster.
            </p>
          </motion.div>

          <motion.div 
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.3
                }
              }
            }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid md:grid-cols-3 gap-8 relative"
          >
            {/* Connecting line for desktop */}
            <motion.div 
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.8, duration: 1, ease: "easeInOut" }}
              className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-indigo-100 -z-10 origin-left"
            />
            
            {[
              { num: "01", title: "Select Network", desc: "Choose your preferred mobile network provider from our supported list." },
              { num: "02", title: "Choose Bundle", desc: "Pick a data package that fits your needs and budget perfectly." },
              { num: "03", title: "Pay & Receive", desc: "Enter your number securely via Paystack and get your data instantly." }
            ].map((step, i) => (
              <motion.div 
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
                }}
                whileHover={{ y: -5 }}
                className="flex flex-col items-center text-center p-6 rounded-2xl transition-colors hover:bg-slate-50/50"
              >
                <motion.div 
                  initial={{ scale: 0.8 }}
                  whileInView={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.3 + (i * 0.2) }}
                  className="w-16 h-16 rounded-full bg-white border-4 border-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl shadow-sm mb-6 z-10 relative"
                >
                  {step.num}
                </motion.div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-slate-600">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
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
      <motion.button
        type="button"
        onClick={() => openWhatsApp({ phone: "233244014207", message: "Hi Datapapa Support! I'd like to make an inquiry." })}
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
      </motion.button>
    </div>
  );
}
