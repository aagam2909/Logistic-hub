import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import { 
  LayoutGrid, Truck, Users, MapPin, Receipt, Banknote, 
  BriefcaseBusiness, Search, Bell, CreditCard, LogOut, UserCircle 
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import FleetRegistry from './pages/FleetRegistry';
import Trips from './pages/Trips';
import Finance from './pages/Finance';
import Track from './pages/track';
import PartyHistory from './pages/PartyHistory';
import DriverHistory from './pages/DriverHistory';
import TripDetails from './pages/TripDetails';
import TripHistory from './pages/TripHistory';
import StaffLedger from './pages/StaffLedger';
import Login from './pages/login'; // 🌟 Fixed import case to match your lowercase login.jsx file

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
  { name: 'Staff & Card Accounts', path: '/staff-accounts', icon: CreditCard },
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
        isActive ? 'bg-slate-800 text-white shadow-sm' : 'text-gray-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{children}</span>
    </Link>
  );
};

function App() {
  const [expiringCount, setExpiringCount] = useState(0);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if user is already logged in on page reload
  useEffect(() => {
    const savedUser = localStorage.getItem('jfc_active_user');
    if (savedUser) {
      setLoggedInUser(savedUser);
      axios.defaults.headers.common['X-Username'] = savedUser;
    }
    setAuthChecked(true);

    axios.get(`${API_BASE}/drivers/expiring-licenses`)
      .then(res => {
        if (Array.isArray(res.data)) setExpiringCount(res.data.length);
      })
      .catch(() => {});
  }, []);

  const handleLogin = (username) => {
    localStorage.setItem('jfc_active_user', username);
    axios.defaults.headers.common['X-Username'] = username;
    setLoggedInUser(username);
  };

  const handleLogout = () => {
    localStorage.removeItem('jfc_active_user');
    delete axios.defaults.headers.common['X-Username'];
    setLoggedInUser(null);
  };

  if (!authChecked) return null;

  // 🌟 If NOT logged in, render the Login screen only
  if (!loggedInUser) {
    return <Login onLogin={handleLogin} />;
  }

  // 🌟 Main App Layout (Visible only when authenticated)
  return (
    <Router>
      <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans text-gray-900">
        
        <aside className="w-72 bg-slate-900 text-gray-200 flex-shrink-0 flex flex-col p-5 z-20 shadow-xl hidden md:flex">
          <div className="text-lg font-bold text-white flex items-center gap-3 mb-10 mt-2 px-1">
            <Truck className="h-8 w-8 text-blue-500 shrink-0" />
            <span className="leading-tight">Jain Freight Carriers</span>
          </div>
          
          <div className="flex-1 space-y-1.5">
            {navItems.map((item) => (
              <NavLink key={item.name} to={item.path} icon={item.icon}>{item.name}</NavLink>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-700 space-y-1.5 mt-auto">
            {bottomNavItems.map((item) => (
              <NavLink key={item.name} to={item.path} icon={item.icon}>{item.name}</NavLink>
            ))}
            <div className="text-xs text-slate-500 mt-6 text-center pb-2 font-semibold">© 2026 Jain Freight Carriers</div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth bg-gray-50">
          
          <header className="bg-white border-b sticky top-0 z-10 px-8 py-4 flex items-center justify-between shadow-sm">
            
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
               <UserCircle className="h-4 w-4 text-indigo-600" />
               <span className="text-xs font-bold text-indigo-900">Active User: <span className="text-indigo-600">{loggedInUser}</span></span>
            </div>

            <div className="flex items-center gap-4">
              <button className="text-gray-400 hover:text-gray-600 relative transition cursor-pointer">
                <Bell className="h-5 w-5" />
                {expiringCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 border border-white rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                    {expiringCount}
                  </span>
                )}
              </button>

              <div className="h-5 w-px bg-gray-200"></div>

              <button 
                onClick={handleLogout} 
                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-rose-600 transition cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </header>

          <main className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/fleet" element={<FleetRegistry />} />
              <Route path="/trips" element={<Trips />} />
              <Route path="/trip-history" element={<TripHistory />} />
              <Route path="/finance" element={<Finance />} />
              <Route path="/track" element={<Track />} />
              <Route path="/staff-accounts" element={<StaffLedger />} />
              <Route path="/party-history" element={<PartyHistory />} />
              <Route path="/driver-history" element={<DriverHistory />} />
              <Route path="/trip-details/:trip_id" element={<TripDetails />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </main>
        </div>

      </div>
    </Router>
  );
}

export default App;