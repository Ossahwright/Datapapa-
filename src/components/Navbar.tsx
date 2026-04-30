import React from 'react';
import { Link } from 'react-router-dom';
import { Wifi } from 'lucide-react';

interface NavbarProps {
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

export default function Navbar({ settings }: NavbarProps) {
  const appName = settings?.app_name || "Datapapa";

  const scrollToForm = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === '/') {
      e.preventDefault();
      const el = document.getElementById('buy-data');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg group-hover:scale-105 transition-transform">
              <Wifi size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-900">{appName}</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <Link 
              to="/#buy-data" 
              onClick={scrollToForm}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 cursor-pointer"
            >
              Buy Data
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
