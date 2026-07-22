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
    axios.get(`${API_BASE}/trips/active`).then(res => setActiveTrips(res.data));
  }, []);

  const handleSearch = async () => {
    try {
      const res = await axios.get(`${API_BASE}/track/${trackingNumber}`);
      // Based on your new backend return structure, we access res.data.trip
      setTripDetails(res.data.trip || res.data);
    } catch (err) { 
      alert("Could not fetch trip data."); 
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-3xl font-bold">Command Center: Track & Trace</h2>
      
      {/* Search Bar */}
      <div className="bg-white p-6 rounded-lg shadow-md flex gap-4">
        <select className="border p-3 rounded flex-1 bg-gray-50" onChange={e => setTrackingNumber(e.target.value)}>
          <option value="">Select Active Trip...</option>
          {activeTrips?.map?.(t => <option key={t.trip_id} value={t.tracking_number || t.trip_id}>{t.tracking_number || t.trip_id}</option>)}
        </select>
        <button onClick={handleSearch} className="bg-blue-900 text-white px-8 py-3 rounded-lg font-bold">Search</button>
      </div>

      {tripDetails && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500">
              <h3 className="font-bold mb-2">📍 Route</h3>
              <p>Vehicle: {tripDetails.vehicle_number}</p>
              <p>{tripDetails.source_city} → {tripDetails.destination_city}</p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-yellow-500">
              <h3 className="font-bold mb-2">📡 Live Telemetry</h3>
              <p>Speed: {tripDetails.telemetry?.speed || 0} km/h</p>
              <p>Status: {tripDetails.telemetry?.status || 'Offline'}</p>
              <p>Fuel: {tripDetails.telemetry?.fuel_level || 'N/A'} L</p>
              <p className="font-semibold text-blue-800">Urea: {tripDetails.telemetry?.urea_level || 'N/A'} %</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-green-500">
              <h3 className="font-bold mb-2">💰 Financials</h3>
              <p>Freight: ₹{tripDetails.freight_amount || 0}</p>
              <p className="text-red-600 font-bold">Balance: ₹{tripDetails.remaining_balance || 0}</p>
            </div>
          </div>

          {/* Integrated Map */}
          {tripDetails.telemetry?.lat ? (
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="font-bold mb-4">Live Location</h3>
              <div style={{ height: "400px", width: "100%" }}>
                <MapContainer 
                  center={[tripDetails.telemetry.lat, tripDetails.telemetry.lng]} 
                  zoom={13} 
                  style={{ height: "100%", borderRadius: "8px" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[tripDetails.telemetry.lat, tripDetails.telemetry.lng]}>
                    <Popup>Vehicle: {tripDetails.vehicle_number}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          ) : (
            <p className="text-center p-4 bg-gray-100 rounded">No live location data available for this trip.</p>
          )}
        </div>
      )}
    </div>
  );
}
export default Track;
