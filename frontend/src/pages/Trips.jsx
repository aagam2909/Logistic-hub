import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, RefreshCw, FileUp, PlusCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const StatusTag = ({ status, deliveryDate }) => {
  if (deliveryDate) return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Completed</span>;
  if (status === 'Received') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">POD Received</span>;
  if (status === 'Forwarded') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Forwarded</span>;
  return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Pending / In-Transit</span>;
};

function Trips() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [availableTrucks, setAvailableTrucks] = useState([]);
  const [parties, setParties] = useState([]);
  const [podFiles, setPodFiles] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const [tripData, setTripData] = useState({
    vehicle_number: '', source_city: '', destination_city: '', party_name: '', 
    gta_name: '', lr_no: '', eway_bill: '', eway_bill_expiry: '', trip_start_date: '', lw: ''
  });
  
  const [podUpdate, setPodUpdate] = useState({ 
    trip_id: '', pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '' 
  });

  useEffect(() => { fetchTrips(); fetchAvailableTrucks(); fetchParties(); }, []);

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trips/active`);
      setActiveTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setActiveTrips([]); }
  };

  const fetchAvailableTrucks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/assets`);
      setAvailableTrucks(Array.isArray(res.data) ? res.data.filter(t => t.current_status !== 'In-Transit' && t.current_status !== 'Archived') : []);
    } catch (err) { setAvailableTrucks([]); }
  };

  const fetchParties = async () => {
    try { 
        const res = await axios.get(`${API_BASE}/parties`);
        setParties(Array.isArray(res.data) ? res.data.filter(Boolean) : []);
    } catch (err) { setParties([]); }
  };

  const handleAddTrip = async () => {
    if (!tripData.vehicle_number.trim() || !tripData.source_city.trim() || !tripData.destination_city.trim()) {
      return alert("Please fill in the mandatory fields: Truck Number, Source, and Destination!");
    }
    const tripPayload = {
      ...tripData,
      trip_start_date: tripData.trip_start_date || new Date().toISOString().slice(0, 10),
    };
    try {
      await axios.post(`${API_BASE}/trips`, tripPayload);
      alert("Trip Launched!");
      setTripData({ vehicle_number: '', source_city: '', destination_city: '', party_name: '', gta_name: '', lr_no: '', eway_bill: '', eway_bill_expiry: '', trip_start_date: '', lw: ''});
      fetchTrips(); fetchParties(); fetchAvailableTrucks();
    } catch (err) { alert(err.response?.data?.detail || "Error launching trip."); }
  };

  const handleUpdatePOD = async () => {
    if (!podUpdate.trip_id) return alert("Please select a trip first!");
    try {
      await axios.put(`${API_BASE}/finances/${podUpdate.trip_id}/pod`, podUpdate);
      alert("POD Details Updated!");
      fetchTrips();
    } catch (err) { alert("Update failed."); }
  };

  const handleCompleteTrip = async (trip_id) => {
    if (!podFiles[trip_id]) return alert("Select a POD file first!");
    try {
        const formData = new FormData(); formData.append("file", podFiles[trip_id]);
        await axios.post(`${API_BASE}/upload-pod`, formData);
        await axios.put(`${API_BASE}/trips/${trip_id}/complete`, { actual_delivery_date: new Date().toISOString().split('T')[0] });
        alert("POD Uploaded & Trip Completed!");
        fetchTrips(); fetchAvailableTrucks();
    } catch (err) { alert("Failed."); }
  };

  const filteredTrips = activeTrips.filter(t => 
    (t.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.party_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* 1. Launch Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><PlusCircle className="text-blue-500"/> Launch New Trip</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input className="border p-2.5 rounded-lg text-sm" list="available-trucks" placeholder="Search truck number *" value={tripData.vehicle_number} onChange={e => setTripData({...tripData, vehicle_number: e.target.value})} />
          <datalist id="available-trucks">{availableTrucks.map(t => <option key={t.vehicle_number} value={t.vehicle_number} />)}</datalist>
          <input className="border p-2.5 rounded-lg text-sm" placeholder="Source *" value={tripData.source_city} onChange={e => setTripData({...tripData, source_city: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" placeholder="Destination *" value={tripData.destination_city} onChange={e => setTripData({...tripData, destination_city: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" list="party-names" placeholder="Party name" value={tripData.party_name} onChange={e => setTripData({...tripData, party_name: e.target.value})} />
          <datalist id="party-names">{parties.map(p => <option key={p} value={p} />)}</datalist>
          
          <input className="border p-2.5 rounded-lg text-sm" placeholder="GTA Name" value={tripData.gta_name} onChange={e => setTripData({...tripData, gta_name: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" placeholder="LR No" value={tripData.lr_no} onChange={e => setTripData({...tripData, lr_no: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm text-gray-500" type="date" placeholder="E-Way Bill Date" value={tripData.eway_bill} onChange={e => setTripData({...tripData, eway_bill: e.target.value})} title="E-Way Bill Date" />
          <input className="border p-2.5 rounded-lg text-sm text-gray-500" type="date" placeholder="Launch Date" value={tripData.trip_start_date} onChange={e => setTripData({...tripData, trip_start_date: e.target.value})} title="Launch Date" />
          
          <input className="border p-2.5 rounded-lg text-sm lg:col-span-3" placeholder="L/W Details (Optional)" value={tripData.lw} onChange={e => setTripData({...tripData, lw: e.target.value})} />
          <button onClick={handleAddTrip} className="bg-blue-600 text-white p-2.5 rounded-lg font-bold hover:bg-blue-700 transition">Launch Route 🚀</button>
        </div>
      </section>

      {/* 2. POD Management Section */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileUp className="text-blue-500"/> POD Tracking & Management</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <input className="w-full border p-2.5 rounded-lg text-sm" list="pod-trip-numbers" placeholder="Search trip ID for POD update..." value={podUpdate.trip_id} onChange={(e) => setPodUpdate({...podUpdate, trip_id: e.target.value})} />
            <datalist id="pod-trip-numbers">{activeTrips.map(t => <option key={t.trip_id} value={t.trip_id} label={t.tracking_number || t.trip_id} />)}</datalist>
          </div>
          <input className="border p-2.5 rounded-lg text-sm w-40" list="pod-statuses" placeholder="Status" value={podUpdate.pod_status} onChange={(e) => setPodUpdate({...podUpdate, pod_status: e.target.value})} />
          <datalist id="pod-statuses"><option value="Pending" /><option value="Received" /><option value="Forwarded" /></datalist>
          <input type="date" className="border p-2.5 rounded-lg text-sm text-gray-500" title="Office Arrival Date" onChange={(e) => setPodUpdate({...podUpdate, pod_arrived_office_date: e.target.value})} />
          <input type="date" className="border p-2.5 rounded-lg text-sm text-gray-500" title="Forwarded to Client Date" onChange={(e) => setPodUpdate({...podUpdate, pod_forwarded_client_date: e.target.value})} />
          <button onClick={handleUpdatePOD} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition">Update POD</button>
        </div>
      </section>

      {/* 3. Active Trips Table with Sleek UI */}
      <section className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-2xl border shadow-sm">
           <h2 className="text-xl font-bold">Active Trips List</h2>
           <div className="relative w-72">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
             <input type="text" placeholder="Search trips..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-lg p-2 pl-9 text-sm focus:ring-2 focus:ring-blue-100 outline-none" />
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 font-semibold">
              <tr>
                <th className="p-4">Trip / Tracking No.</th>
                <th className="p-4">Route</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4">POD Status</th>
                <th className="p-4">Upload File</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map(trip => (
                <tr key={trip.trip_id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4">
                    <a href={`/trip-details/${trip.trip_id}`} className="text-blue-600 font-semibold underline">{trip.tracking_number || `Trip #${trip.trip_id}`}</a>
                    <div className="text-xs text-gray-500 mt-1">{trip.party_name}</div>
                  </td>
                  <td className="p-4 font-medium">{trip.source_city} → {trip.destination_city}</td>
                  <td className="p-4 font-bold text-gray-900">{trip.vehicle_number}</td>
                  <td className="p-4"><StatusTag status={trip.pod_status} deliveryDate={trip.actual_delivery_date} /></td>
                  <td className="p-4">
                    <input type="file" className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={(e) => setPodFiles({...podFiles, [trip.trip_id]: e.target.files[0]})} />
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleCompleteTrip(trip.trip_id)} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 shadow-sm text-xs transition">Complete</button>
                  </td>
                </tr>
              ))}
              {!filteredTrips.length && <tr><td colSpan="6" className="p-8 text-center text-gray-500">No active trips found matching your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

export default Trips;