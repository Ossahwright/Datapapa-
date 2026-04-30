import React from 'react';
import { motion } from 'motion/react';
import { Hammer, Clock, Mail } from 'lucide-react';

interface MaintenanceScreenProps {
  supportEmail?: string;
}

const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ supportEmail }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-12 rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-slate-100"
      >
        <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-8">
          <Hammer size={48} className="animate-pulse" />
        </div>
        
        <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
          Maintenance Mode
        </h1>
        
        <p className="text-slate-500 text-lg leading-relaxed mb-10">
          We are currently upgrading the system to provide you with a better experience. 
          <span className="block mt-2 font-medium text-slate-700">Please check back soon!</span>
        </p>

        <div className="flex flex-col gap-4 text-sm font-medium text-slate-400">
          <div className="flex items-center justify-center gap-2">
            <Clock size={16} />
            <span>Estimated downtime: ~30 minutes</span>
          </div>
          {supportEmail && (
            <div className="flex items-center justify-center gap-2">
              <Mail size={16} />
              <a href={`mailto:${supportEmail}`} className="text-indigo-600 hover:underline">
                {supportEmail}
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MaintenanceScreen;
