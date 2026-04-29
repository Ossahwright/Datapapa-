import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import AdminAuth from './pages/AdminAuth';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/auth" element={<AdminAuth />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

