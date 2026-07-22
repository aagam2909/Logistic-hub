import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Importing your Page components
import FleetRegistry from './pages/FleetRegistry';
import Trips from './pages/Trips';
import Finance from './pages/Finance';
import Track from './pages/track';
import PartyHistory from './pages/PartyHistory';
import DriverHistory from './pages/DriverHistory';
import TripDetails from './pages/TripDetails'; // Make sure this file exists!
import TripHistory from './pages/TripHistory';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-slate-900 text-white p-6">
          <h1 className="text-2xl font-bold mb-8">Logistics Hub</h1>
          <nav className="space-y-2">
            <Link to="/" className="block p-3 hover:bg-slate-800 rounded">🚚 Fleet Registry</Link>
            <Link to="/trips" className="block p-3 hover:bg-slate-800 rounded">📍 Active Trips & POD</Link>
            <Link to="/trip-history" className="block p-3 hover:bg-slate-800 rounded">🕘 Completed Trip History</Link>
            <Link to="/finance" className="block p-3 hover:bg-slate-800 rounded">💰 Finances & Receipt</Link>
            <Link to="/track" className="block p-3 hover:bg-slate-800 rounded">🔍 Track & Trace</Link>
            
            <hr className="border-slate-700 my-6" />
            
            <Link to="/party-history" className="block p-3 hover:bg-slate-800 rounded text-sm text-gray-300">🏢 Client Ledger</Link>
            <Link to="/driver-history" className="block p-3 hover:bg-slate-800 rounded text-sm text-gray-300">👤 Driver Logs</Link>
          </nav>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<FleetRegistry />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/trip-history" element={<TripHistory />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/track" element={<Track />} />
            <Route path="/party-history" element={<PartyHistory />} />
            <Route path="/driver-history" element={<DriverHistory />} />
            {/* Added the route for clickable Trip Details */}
            <Route path="/trip-details/:trip_id" element={<TripDetails />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
