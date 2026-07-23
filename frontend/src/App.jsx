import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { LayoutGrid, Truck, Users, MapPin, Receipt, Banknote, BriefcaseBusiness, Search, Bell } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import FleetRegistry from './pages/FleetRegistry';
import Trips from './pages/Trips';
import Finance from './pages/Finance';
import Track from './pages/track';
import PartyHistory from './pages/PartyHistory';
import DriverHistory from './pages/DriverHistory';
import TripDetails from './pages/TripDetails';
import TripHistory from './pages/TripHistory';

const API_BASE = import.meta.env.VITE_API_URL;

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutGrid },
  { name: 'Fleet Registry', path: '/fleet', icon: Truck },
  { name: 'Active Trips & POD', path: '/trips', icon: MapPin },
  { name: 'Completed Trips', path: '/trip-history', icon: Receipt },
  { name: 'Finances & Receipt', path: '/finance', icon: Banknote },
  { name: 'Track & Trace', path: '/track', icon: Search },
];

const bottomNavItems = [
  { name: 'Client Ledger', path: '/party-history', icon: BriefcaseBusiness },
  { name: 'Driver Logs', path: '/driver-history', icon: Users },
];

const NavLink = ({ to, icon: Icon, children }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`w-full flex items-center gap-3.5 p-3 rounded-lg text-sm font-medium transition ${
        isActive ? 'bg-slate-800 text-white' : 'text-gray-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{children}</span>
    </Link>
  );
};

function App() {
  const [expiringCount, setExpiringCount] = useState(0);

  useEffect(() => {
    axios.get(`${API_BASE}/drivers/expiring-licenses`)
      .then(res => {
        if (Array.isArray(res.data)) setExpiringCount(res.data.length);
      })
      .catch(() => {});
  }, []);

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
        
        {/* SIDEBAR NAVIGATION (Width increased to w-72) */}
        <nav className="w-72 bg-slate-900 text-gray-200 fixed h-screen flex flex-col p-5 z-10">
          <div className="text-lg font-bold text-white flex items-center gap-3 mb-10 mt-2 px-1">
            <Truck className="h-8 w-8 text-blue-500 shrink-0" />
            <span className="leading-tight">Jain Freight Carriers</span>
          </div>
          
          <div className="flex-1 space-y-2">
            {navItems.map((item) => (
              <NavLink key={item.name} to={item.path} icon={item.icon}>{item.name}</NavLink>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-700 space-y-2 mt-auto">
            {bottomNavItems.map((item) => (
              <NavLink key={item.name} to={item.path} icon={item.icon}>{item.name}</NavLink>
            ))}
            <div className="text-xs text-slate-500 mt-6 text-center pb-2">© 2026 Jain Freight Carriers</div>
          </div>
        </nav>

        {/* MAIN CONTENT AREA (Margin shifted to ml-72 to match new sidebar width) */}
        <div className="flex-1 ml-72 flex flex-col min-h-screen">
          
          {/* TOP HEADER */}
          <header className="bg-white border-b sticky top-0 z-10 px-8 py-4 flex items-center justify-between shadow-sm">
            <div className="text-sm font-medium text-gray-600">Admin Portal Active</div>
            <div className="flex items-center gap-5">
              <button className="text-gray-400 hover:text-gray-600 relative transition">
                <Bell className="h-5 w-5" />
                {expiringCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 border border-white rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {expiringCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* DYNAMIC VIEWS */}
          <main className="p-8 flex-1">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fleet" element={<FleetRegistry />} />
              <Route path="/trips" element={<Trips />} />
              <Route path="/trip-history" element={<TripHistory />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/track" element={<Track />} />
              <Route path="/party-history" element={<PartyHistory />} />
              <Route path="/driver-history" element={<DriverHistory />} />
              <Route path="/trip-details/:trip_id" element={<TripDetails />} />
            </Routes>
          </main>
        </div>

      </div>
    </Router>
  );
}

export default App;