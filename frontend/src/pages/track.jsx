import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Search, MapPin, Truck, Navigation, AlertCircle, Loader2, Droplet, ShieldAlert, BadgeInfo, Printer } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_URL;

function Track() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripDetails, setTripDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');

  const printRef = useRef();
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: "Trip_Tracking_Report" });

  useEffect(() => {
    fetchActiveTrips();
  }, []);

  // 🌟 Address Fetcher (Reverse Geocoding)
  useEffect(() => {
    if (tripDetails?.telemetry?.lat && tripDetails?.telemetry?.lng) {
      const fetchAddress = async () => {
        try {
          const res = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${tripDetails.telemetry.lat}&lon=${tripDetails.telemetry.lng}`, { headers: { 'Accept-Language': 'en' }});
          setCurrentAddress(res.data.display_name || "Address not found");
        } catch (e) {
          setCurrentAddress("Location service unavailable");
        }
      };
      fetchAddress();
    } else {
      setCurrentAddress('');
    }
  }, [tripDetails]);

  const fetchActiveTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trips/active`);
      setActiveTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setActiveTrips([]);
    }
  };

  const handleSelectTrip = async (trip) => {
    setSelectedTrip(trip);
    setLoadingDetails(true);
    setCurrentAddress('Fetching current location address...');
    try {
      const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trip.tracking_number)}`);
      setTripDetails(res.data.trip || res.data);
    } catch (err) { 
      alert("Could not fetch live telemetry for this trip."); 
      setTripDetails(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredTrips = activeTrips.filter(t => 
    (t.tracking_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.vehicle_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.party_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.source_city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.destination_city || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row h-[85vh] gap-6 p-6">
      
      {/* 1/3 COLUMN: Active Trips List */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600"/> Live Fleet
            </h3>
            <p className="text-xs text-gray-500 mt-1">{activeTrips.length} vehicles currently in transit</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search tracking, truck, route..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full border border-gray-200 rounded-xl p-3 pl-9 text-sm focus:ring-2 focus:ring-blue-100 outline-none transition bg-gray-50" 
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {filteredTrips.map((trip, index) => (
            <div 
              key={trip.tracking_number || trip.trip_id || `trip-fallback-${index}`} 
              onClick={() => handleSelectTrip(trip)} 
              className={`cursor-pointer p-4 rounded-xl border flex flex-col gap-2 transition-all ${
                selectedTrip?.tracking_number === trip.tracking_number 
                  ? 'bg-blue-50 border-blue-300 shadow-sm' 
                  : 'bg-white hover:bg-gray-50 border-gray-100'
              }`}
            >
              <div className="flex justify-between items-start">
                  <span className="font-bold text-blue-700 text-sm break-all">{trip.tracking_number}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded">In-Transit</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700 font-semibold">
                  <Truck className="h-4 w-4 text-gray-400" /> {trip.vehicle_number}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                  <MapPin className="h-3.5 w-3.5" /> {trip.source_city} → {trip.destination_city}
              </div>
            </div>
          ))}
          {!filteredTrips.length && (
            <div className="text-center py-10 flex flex-col items-center justify-center text-gray-400">
                <Truck className="h-10 w-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No active trips found.</p>
            </div>
          )}
        </div>
      </div>

      {/* 2/3 COLUMN: Tracking Details & Map */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {loadingDetails ? (
           <div className="bg-white h-full min-h-[400px] flex flex-col items-center justify-center rounded-2xl border border-gray-200 shadow-sm text-blue-600">
              <Loader2 className="h-10 w-10 animate-spin mb-4" />
              <span className="font-bold text-lg">Establishing Uplink...</span>
              <span className="text-sm text-gray-500 mt-1">Fetching live Taabi telemetry & Fuel Analytics</span>
           </div>
        ) : tripDetails ? (
          <div ref={printRef} className="space-y-6 animate-in fade-in zoom-in-95 duration-300 print:p-8">
            
            {/* Header Box + Print Button */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center print:border-none print:shadow-none print:border-b-2 print:border-slate-900 print:rounded-none">
               <div>
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                     {tripDetails.vehicle_number}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium mt-1">TRK: {tripDetails.tracking_number}</p>
               </div>
               <div className="text-left md:text-right mt-4 md:mt-0 flex flex-col items-start md:items-end">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Route Assignment</p>
                  <p className="text-base font-bold text-slate-700">{tripDetails.source_city} → {tripDetails.destination_city}</p>
                  <button onClick={handlePrint} className="print:hidden mt-3 bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-sm cursor-pointer">
                     <Printer className="h-3.5 w-3.5" /> Print Report
                  </button>
               </div>
            </div>

            {/* NEW FUEL V3 ANALYTICS DASHBOARD */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:border print:shadow-none">
               <div className="bg-slate-900 p-4 flex items-center justify-between print:bg-gray-100 print:border-b">
                  <h3 className="font-bold text-white print:text-slate-900 flex items-center gap-2"><Droplet className="h-5 w-5 text-blue-400 print:text-slate-900" /> Fuel Analytics & Security (Taabi V3)</h3>
                  <span className="text-xs text-slate-400 print:text-slate-600 font-mono">Since {tripDetails.trip_start_date}</span>
               </div>
               <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 print:border-gray-300">
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Actual Fuel Consumed</p>
                     <p className="text-xl font-black text-slate-800">{tripDetails.fuel_analytics?.fuelConsumed || 0} <span className="text-sm font-semibold text-gray-500">Liters</span></p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 print:border-gray-300">
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Actual Mileage Tracked</p>
                     <p className="text-xl font-black text-blue-600">{tripDetails.fuel_analytics?.mileage || 0} <span className="text-sm font-semibold text-gray-500">km/L</span></p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 print:border-gray-300 print:bg-white">
                     <p className="text-[10px] font-bold text-emerald-700 print:text-gray-500 uppercase tracking-wider mb-1">Total Refuels (Verified)</p>
                     <p className="text-xl font-black text-emerald-800 print:text-slate-800">{tripDetails.fuel_analytics?.noOfRefuels || 0} <span className="text-sm font-semibold text-emerald-600 print:text-gray-500">Events</span></p>
                     <p className="text-xs font-semibold text-emerald-600 print:text-gray-500 mt-1">Vol: {tripDetails.fuel_analytics?.refuelVolume || 0} L</p>
                  </div>
                  <div className={`p-4 rounded-xl border ${tripDetails.fuel_analytics?.noOfPilfreges > 0 ? 'bg-rose-50 border-rose-200 print:bg-white print:border-gray-300' : 'bg-gray-50 border-gray-100 print:border-gray-300'}`}>
                     <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${tripDetails.fuel_analytics?.noOfPilfreges > 0 ? 'text-rose-700 print:text-gray-500' : 'text-gray-500'}`}>Theft / Pilferage Alert</p>
                     <p className={`text-xl font-black ${tripDetails.fuel_analytics?.noOfPilfreges > 0 ? 'text-rose-600 print:text-slate-800' : 'text-slate-800'}`}>
                        {tripDetails.fuel_analytics?.noOfPilfreges || 0} <span className="text-sm font-semibold">Events</span>
                     </p>
                     <p className={`text-xs font-semibold mt-1 ${tripDetails.fuel_analytics?.noOfPilfreges > 0 ? 'text-rose-600 print:text-gray-500' : 'text-gray-500'}`}>Lost: {tripDetails.fuel_analytics?.pilfregeVolume || 0} L</p>
                  </div>
               </div>

               {/* EVENT LOGS */}
               {tripDetails.fuel_analytics?.events && (tripDetails.fuel_analytics.events.refuelEvents?.length > 0 || tripDetails.fuel_analytics.events.pilferageEvents?.length > 0) && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50 print:bg-white print:border-t-2">
                     <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">Incident Logs</h4>
                     <div className="space-y-2">
                        {tripDetails.fuel_analytics.events.pilferageEvents?.map((evt, idx) => (
                           <div key={`theft-${idx}`} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-rose-200 text-sm print:border-gray-300">
                              <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0 print:hidden" />
                              <div className="flex-1">
                                 <span className="font-bold text-rose-700 print:text-slate-800 block">THEFT DETECTED: {evt.alertvalue} Liters Lost</span>
                                 <span className="text-xs text-gray-500">{evt.start_address || 'Unknown Location'}</span>
                              </div>
                           </div>
                        ))}
                        {tripDetails.fuel_analytics.events.refuelEvents?.map((evt, idx) => (
                           <div key={`refuel-${idx}`} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-emerald-200 text-sm print:border-gray-300">
                              <BadgeInfo className="h-5 w-5 text-emerald-500 shrink-0 print:hidden" />
                              <div className="flex-1">
                                 <span className="font-bold text-emerald-700 print:text-slate-800 block">REFUEL LOGGED: {evt.alertvalue} Liters Added</span>
                                 <span className="text-xs text-gray-500">{evt.start_address || 'Unknown Location'}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>

            {/* General Telemetry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-amber-500 print:border print:shadow-none print:border-t-gray-300">
                <h3 className="font-bold mb-4 text-gray-800 flex items-center gap-2">📡 Live Telemetry</h3>
                <div className="space-y-3">
                  <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-500 font-semibold uppercase">Status</span> <span className={`font-bold text-sm ${tripDetails.telemetry?.status === 'Offline' ? 'text-rose-500 print:text-slate-800' : 'text-emerald-600 print:text-slate-800'}`}>{tripDetails.telemetry?.status || 'Offline'}</span></div>
                  <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-500 font-semibold uppercase">Speed</span> <span className="font-bold text-gray-900 text-sm">{tripDetails.telemetry?.speed || 0} km/h</span></div>
                  <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-500 font-semibold uppercase">Current Fuel Level</span> <span className="font-bold text-blue-600 print:text-slate-800 text-sm">{tripDetails.telemetry?.fuel_level || 'N/A'} L</span></div>
                  {/* 🌟 Address displayed here */}
                  <div className="pt-2"><span className="text-xs text-gray-500 font-semibold uppercase block mb-1">Written Address (Live)</span> <span className="font-bold text-slate-700 text-xs leading-tight block bg-gray-50 p-2 rounded border border-gray-100 print:bg-transparent print:border-none print:p-0">{currentAddress || '-'}</span></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 border-t-4 border-t-emerald-500 flex flex-col justify-between print:border print:shadow-none print:border-t-gray-300">
                <div>
                  <h3 className="font-bold mb-4 text-gray-800 flex justify-between items-center"><span className="flex items-center gap-2">💰 Ledger Sync</span></h3>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-500 font-semibold uppercase">Gross Freight</span> <span className="font-bold text-gray-900 text-sm">₹{tripDetails.freight_amount || 0}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-xs text-gray-500 font-semibold uppercase">Advances</span> <span className="font-bold text-rose-500 print:text-slate-800 text-sm">₹{tripDetails.adv_amt || 0}</span></div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center bg-emerald-50 px-3 py-2 rounded-lg print:bg-transparent print:border-t-2 print:p-0">
                  <span className="text-xs font-bold text-emerald-900 print:text-slate-800 uppercase">Net Payable</span>
                  <span className="text-lg font-extrabold text-emerald-600 print:text-slate-900">₹{tripDetails.balance_payment || 0}</span>
                </div>
              </div>
              
            </div>

            {/* Map Area */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 print:hidden">
              <h3 className="font-bold mb-4 text-gray-800 flex items-center gap-2">Geospatial Tracking</h3>
              {tripDetails.telemetry?.lat ? (
                <div style={{ height: "450px", width: "100%" }} className="overflow-hidden rounded-xl border border-gray-200 shadow-inner z-0 relative">
                  <MapContainer center={[tripDetails.telemetry.lat, tripDetails.telemetry.lng]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 0 }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[tripDetails.telemetry.lat, tripDetails.telemetry.lng]}>
                      <Popup>
                          <div className="font-black text-slate-900">{tripDetails.vehicle_number}</div>
                          <div className="text-xs text-emerald-600 font-bold mt-1">Status: {tripDetails.telemetry?.status}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Speed: {tripDetails.telemetry?.speed} km/h</div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              ) : (
                <div className="h-[300px] bg-gray-50 rounded-2xl border border-gray-200 text-center flex flex-col items-center justify-center">
                  <AlertCircle className="h-12 w-12 text-gray-300 mb-3" />
                  <h4 className="font-bold text-gray-600 text-lg">GPS Offline</h4>
                  <p className="text-sm text-gray-400 mt-1">No live geospatial coordinates available from Taabi.</p>
                </div>
              )}
            </div>
            
            {/* Print Footer Signature Blocks */}
            <div className="hidden print:flex justify-between mt-12 pt-8">
               <div className="border-t-2 border-slate-800 w-48 text-center pt-2 font-bold text-sm text-slate-800">Dispatch Manager</div>
               <div className="border-t-2 border-slate-800 w-48 text-center pt-2 font-bold text-sm text-slate-800">Authorized Signatory</div>
            </div>

          </div>
        ) : (
          <div className="bg-white h-full min-h-[400px] flex flex-col items-center justify-center rounded-2xl border border-gray-200 shadow-sm text-gray-400">
             <MapPin className="h-16 w-16 text-gray-200 mb-4" />
             <span className="font-semibold text-lg text-gray-500">Select a trip from the list</span>
             <span className="text-sm mt-1">Live tracking data will appear here.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Track;