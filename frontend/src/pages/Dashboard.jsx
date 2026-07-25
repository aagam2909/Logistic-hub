import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Truck, Users, MapPin, Receipt, ArrowRight, Loader2, AlertCircle, X, Download } from 'lucide-react';
import { exportAllDataToExcel } from '../utils/exportHelper'; // <-- NEW EXPORT HELPER IMPORT

const API_BASE = import.meta.env.VITE_API_URL;

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showDriverModal, setShowDriverModal] = useState(false);
  
  const [stats, setStats] = useState({
    activeTrucks: 0,
    availableTrucks: 0,
    totalDrivers: 0,
    activeTrips: 0,
    pendingPods: 0,
  });

  const [recentTrips, setRecentTrips] = useState([]);
  const [expiringDrivers, setExpiringDrivers] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [assetsRes, driversRes, activeTripsRes, expiringRes] = await Promise.all([
        axios.get(`${API_BASE}/assets`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/drivers`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/trips/active`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/drivers/expiring-licenses`).catch(() => ({ data: [] }))
      ]);

      const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
      const drivers = Array.isArray(driversRes.data) ? driversRes.data : [];
      const activeTrips = Array.isArray(activeTripsRes.data) ? activeTripsRes.data : [];
      
      const available = assets.filter(a => a.current_status === 'Available').length;
      const inTransit = assets.filter(a => a.current_status === 'In-Transit').length;
      const pendingPods = activeTrips.filter(t => t.pod_status === 'Pending' || !t.pod_status).length;

      setStats({
        activeTrucks: inTransit,
        availableTrucks: available,
        totalDrivers: drivers.length,
        activeTrips: activeTrips.length,
        pendingPods: pendingPods,
      });

      setRecentTrips([...activeTrips].reverse().slice(0, 5));
      if (Array.isArray(expiringRes.data)) {
        setExpiringDrivers(expiringRes.data);
      }

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const kpiCards = [
    { 
      title: "Active Trucks", value: stats.activeTrucks, subtext: `${stats.availableTrucks} Available`, 
      icon: Truck, path: "/fleet", color: "text-blue-600", bg: "bg-blue-50"
    },
    { 
      title: "Total Drivers", value: stats.totalDrivers, subtext: "Registered Fleet", 
      icon: Users, path: "/driver-history", color: "text-slate-600", bg: "bg-slate-100"
    },
    { 
      title: "Active Trips", value: stats.activeTrips, subtext: "Currently En Route", 
      icon: MapPin, path: "/trips", color: "text-emerald-600", bg: "bg-emerald-50"
    },
    { 
      title: "Pending PODs", value: stats.pendingPods, subtext: "Requires Action", 
      icon: Receipt, path: "/trips", color: "text-rose-600", bg: "bg-rose-50", alert: stats.pendingPods > 0
    },
  ];

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center text-gray-500">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading Live Dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto relative">
      
      {/* HEADER WITH EXPORT BUTTON */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Live metrics from your database</p>
        </div>
        
        <button 
          onClick={exportAllDataToExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-sm transition flex items-center gap-2 text-sm cursor-pointer"
        >
          <Download className="h-4 w-4" /> Export All Data (Excel)
        </button>
      </div>

      {/* EXPIRING LICENSE WARNING BANNER */}
      {expiringDrivers.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center font-bold">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-rose-900 text-sm">Driver License Warning</h4>
              <p className="text-xs text-rose-700">
                {expiringDrivers.length} driver(s) have licenses expiring soon or already expired.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowDriverModal(true)} 
            className="bg-rose-600 text-white text-xs px-4 py-2 rounded-lg font-semibold hover:bg-rose-700 transition shadow-sm cursor-pointer"
          >
            Review Drivers
          </button>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div 
            key={idx} 
            onClick={() => navigate(kpi.path)}
            className={`bg-white p-5 rounded-xl border border-gray-200 cursor-pointer transition-all hover:border-gray-400 hover:shadow-sm flex flex-col justify-between h-32 ${kpi.alert ? 'border-rose-200 shadow-[0_0_10px_rgba(225,29,72,0.05)]' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="text-sm font-medium text-gray-500">{kpi.title}</div>
              <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{kpi.value}</div>
              <div className={`text-xs font-medium mt-1 ${kpi.alert ? 'text-rose-600' : 'text-gray-400'}`}>
                {kpi.subtext}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* RECENT TRIPS TABLE */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-semibold text-gray-800">Recent Active Trips</h3>
          <button onClick={() => navigate('/trips')} className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 transition cursor-pointer">
            View All <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        
        {recentTrips.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Tracking No.</th>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTrips.map((trip) => (
                <tr key={trip.trip_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-blue-600">
                    {trip.tracking_number || `Trip #${trip.trip_id}`}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {trip.vehicle_number}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {trip.source_city} → {trip.destination_city}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {trip.party_name || '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      In-Transit
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-gray-500">
            No active trips currently in the system.
          </div>
        )}
      </div>

      {/* DRIVER EXPIRY MODAL POPUP */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                <h2 className="text-lg font-bold text-gray-900">Action Required: License Renewals</h2>
              </div>
              <button 
                onClick={() => setShowDriverModal(false)}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-500 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Driver List */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-3">
                {expiringDrivers.map((driver, index) => (
                  <div key={index} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition">
                    <div>
                      <div className="font-bold text-gray-900 text-base">{driver.name}</div>
                      <div className="text-sm text-gray-500 mt-0.5">DL: <span className="font-mono text-gray-700">{driver.dl_number}</span></div>
                      {driver.mobile_number && <div className="text-xs text-gray-400 mt-0.5">Contact: {driver.mobile_number}</div>}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        driver.status === 'Expired' 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {driver.status}
                      </span>
                      <div className="text-xs text-gray-500 mt-2 font-medium">
                        Expires: {driver.dl_expiry_date}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => navigate('/driver-history')}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              >
                Manage All Drivers
              </button>
              <button 
                onClick={() => setShowDriverModal(false)}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;