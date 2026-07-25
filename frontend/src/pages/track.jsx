import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_URL;

function Track() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [activeTrips, setActiveTrips] = useState([]);
  const [tripDetails, setTripDetails] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/trips/active`)
      .then((res) => setActiveTrips(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error fetching active trips:", err);
        setActiveTrips([]);
      });
  }, []);

  const handleSearch = async () => {
    try {
      const res = await axios.get(`${API_BASE}/track/${trackingNumber}`);
      setTripDetails(res.data.trip || res.data);
    } catch (err) { 
      alert("Could not fetch trip data."); 
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900">Command Center: Track & Trace</h2>
      
      {/* Search Bar */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <input
          className="border p-3 rounded-lg flex-1 bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none"
          list="active-trip-numbers"
          placeholder="Search active tracking number..."
          value={trackingNumber}
          onChange={e => setTrackingNumber(e.target.value)}
        />
        <datalist id="active-trip-numbers">
          {activeTrips?.map?.(t => <option key={t.trip_id} value={t.tracking_number || t.trip_id} />)}
        </datalist>
        <button onClick={handleSearch} className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm">
          Locate Trip
        </button>
      </div>

      {tripDetails && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Route Box */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-blue-500">
              <h3 className="font-bold mb-4 text-gray-800 flex items-center gap-2">📍 Live Route</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-medium">Vehicle Reg: <span className="font-bold text-gray-900">{tripDetails.vehicle_number}</span></p>
                <p className="text-sm text-gray-500 font-medium">Transit: <span className="font-bold text-gray-900">{tripDetails.source_city} → {tripDetails.destination_city}</span></p>
                <p className="text-sm text-gray-500 font-medium">Client: <span className="font-bold text-gray-900">{tripDetails.party_name || '-'}</span></p>
              </div>
            </div>
            
            {/* Telemetry Box */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-amber-500">
              <h3 className="font-bold mb-4 text-gray-800 flex items-center gap-2">📡 Live Telemetry</h3>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 font-medium">Speed: <span className="font-bold text-gray-900">{tripDetails.telemetry?.speed || 0} km/h</span></p>
                <p className="text-sm text-gray-500 font-medium">Status: <span className={`font-bold ${tripDetails.telemetry?.status === 'Offline' ? 'text-rose-500' : 'text-emerald-600'}`}>{tripDetails.telemetry?.status || 'Offline'}</span></p>
                <p className="text-sm text-gray-500 font-medium">Fuel Level: <span className="font-bold text-gray-900">{tripDetails.telemetry?.fuel_level || 'N/A'} L</span></p>
                <p className="text-sm text-blue-600 font-medium">Urea Level: <span className="font-bold">{tripDetails.telemetry?.urea_level || 'N/A'} %</span></p>
              </div>
            </div>

            {/* Financials Box (UPDATED to include new additions/deductions) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-t-4 border-t-emerald-500 flex flex-col justify-between">
              <div>
                <h3 className="font-bold mb-4 text-gray-800 flex items-center gap-2">💰 Ledger Sync</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 font-medium flex justify-between">Gross Additions: <span className="font-bold text-gray-900">₹{parseFloat(tripDetails.freight_amount || 0) + parseFloat(tripDetails.loading_charge || 0) + parseFloat(tripDetails.gst || 0) + parseFloat(tripDetails.holding_charge || 0)}</span></p>
                  <p className="text-sm text-gray-500 font-medium flex justify-between">Total Deductions: <span className="font-bold text-rose-500">₹{parseFloat(tripDetails.adv_amt || 0) + parseFloat(tripDetails.tds || 0) + parseFloat(tripDetails.extra_deduction || 0)}</span></p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-800">Net Payable:</span>
                <span className="text-lg font-extrabold text-emerald-600">₹{tripDetails.balance_payment || 0}</span>
              </div>
            </div>
            
          </div>

          {/* Integrated Map */}
          {tripDetails.telemetry?.lat ? (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold mb-4 px-2 text-gray-800">Geospatial Tracking</h3>
              <div style={{ height: "400px", width: "100%" }} className="overflow-hidden rounded-lg border border-gray-200">
                <MapContainer 
                  center={[tripDetails.telemetry.lat, tripDetails.telemetry.lng]} 
                  zoom={13} 
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[tripDetails.telemetry.lat, tripDetails.telemetry.lng]}>
                    <Popup>
                      <div className="font-bold text-slate-900">{tripDetails.vehicle_number}</div>
                      <div className="text-xs text-gray-500 mt-1">Status: {tripDetails.telemetry?.status}</div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-gray-50 rounded-xl border border-gray-200 text-center flex flex-col items-center">
              <span className="text-2xl mb-2">📡</span>
              <h4 className="font-bold text-gray-700">GPS Offline</h4>
              <p className="text-sm text-gray-500 mt-1">No live geospatial telemetry available for this asset.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default Track;