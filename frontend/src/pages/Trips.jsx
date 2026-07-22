import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

function Trips() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [availableTrucks, setAvailableTrucks] = useState([]);
  const [parties, setParties] = useState([]);
  const [podFiles, setPodFiles] = useState({});
  const [tripData, setTripData] = useState({
    vehicle_number: '', source_city: '', destination_city: '', 
    party_name: '', gta_name: '', lr_no: '', 
    eway_bill: '', eway_bill_expiry: '', lw: ''
  });
  
  const [podUpdate, setPodUpdate] = useState({ 
    trip_id: '', pod_status: 'Pending', 
    pod_arrived_office_date: '', pod_forwarded_client_date: '' 
  });

  useEffect(() => { 
    fetchTrips(); 
    fetchAvailableTrucks(); 
    fetchParties();
  }, []);

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trips/active`);
      setActiveTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching trips:", err);
      setActiveTrips([]);
    }
  };

  const fetchAvailableTrucks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/assets`);
      const trucks = Array.isArray(res.data) ? res.data : [];
      // This line is updated to hide both 'In-Transit' and 'Archived' trucks
      setAvailableTrucks(trucks.filter(t => t.current_status !== 'In-Transit' && t.current_status !== 'Archived'));
    } catch (err) {
      console.error("Error fetching trucks:", err);
      setAvailableTrucks([]);
    }
  };

  const fetchParties = async () => {
    try { 
        const res = await axios.get(`${API_BASE}/parties`);
        setParties(Array.isArray(res.data) ? res.data.filter(Boolean) : []);
    } catch (err) {
      console.error("Error fetching parties:", err);
      setParties([]);
    }
  };

  const handleAddTrip = async () => {
    const tripPayload = {
      vehicle_number: tripData.vehicle_number.trim(),
      source_city: tripData.source_city.trim(),
      destination_city: tripData.destination_city.trim(),
      party_name: tripData.party_name.trim(),
      gta_name: tripData.gta_name.trim(),
      lr_no: tripData.lr_no.trim(),
      eway_bill: tripData.eway_bill.trim(),
      eway_bill_expiry: tripData.eway_bill_expiry,
      trip_start_date: new Date().toISOString().slice(0, 10),
      lw: tripData.lw.trim(),
    };

    if (Object.values(tripPayload).some((value) => !value)) {
      alert("Please complete all trip fields before launching.");
      return;
    }

    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/trips`, tripPayload);
      alert("Trip Launched!");
      fetchTrips();
      fetchParties();
    } catch (err) {
      console.error("Error launching trip:", err.response?.data ?? err.message);
      alert("Error launching trip.");
    }
  };

  const handleUpdatePOD = async () => {
    if (!podUpdate.trip_id) { alert("Please select a trip first!"); return; }
    try {
      await axios.put(`${API_BASE}/finances/${podUpdate.trip_id}/pod`, podUpdate);
      alert("POD Details Updated!");
      fetchTrips();
    } catch (err) { alert("Update failed."); }
  };

  const handleCompleteTrip = async (trip_id) => {
    if (!podFiles[trip_id]) { alert("Select a POD file first!"); return; }
    try {
        const formData = new FormData();
        formData.append("file", podFiles[trip_id]);
        await axios.post(`${API_BASE}/upload-pod`, formData);
        await axios.put(`${API_BASE}/trips/${trip_id}/complete`, { actual_delivery_date: new Date().toISOString().split('T')[0] });
        alert("POD Uploaded & Trip Completed!");
        fetchTrips(); 
    } catch (err) { alert("Failed."); }
  };

  return (
    <div className="space-y-6 p-6">
      {/* 1. Launch Section */}
      <section className="bg-white p-6 rounded shadow border">
        <h2 className="text-2xl font-bold mb-4">Launch New Trip</h2>
        <div className="grid grid-cols-3 gap-3">
          <input
            className="border p-2 rounded"
            list="available-trucks"
            placeholder="Search truck number"
            value={tripData.vehicle_number}
            onChange={e => setTripData({...tripData, vehicle_number: e.target.value})}
          />
          <datalist id="available-trucks">
            {availableTrucks?.map?.(t => <option key={t.vehicle_number} value={t.vehicle_number} />)}
          </datalist>
          <input className="border p-2 rounded" placeholder="Source" onChange={e => setTripData({...tripData, source_city: e.target.value})} />
          <input className="border p-2 rounded" placeholder="Destination" onChange={e => setTripData({...tripData, destination_city: e.target.value})} />
          
          <input
            className="border p-2 rounded"
            list="party-names"
            placeholder="Search or enter party name"
            value={tripData.party_name}
            onChange={e => setTripData({...tripData, party_name: e.target.value})}
          />
          <datalist id="party-names">
            {parties?.map?.(p => <option key={p} value={p} />)}
          </datalist>

          <input className="border p-2 rounded" placeholder="GTA Name" onChange={e => setTripData({...tripData, gta_name: e.target.value})} />
          <input className="border p-2 rounded" placeholder="LR No" onChange={e => setTripData({...tripData, lr_no: e.target.value})} />
          <input className="border p-2 rounded" placeholder="E-way Bill" onChange={e => setTripData({...tripData, eway_bill: e.target.value})} />
          <input className="border p-2 rounded" type="date" onChange={e => setTripData({...tripData, eway_bill_expiry: e.target.value})} />
          <input className="border p-2 rounded" placeholder="L/W Details" onChange={e => setTripData({...tripData, lw: e.target.value})} />
          <button onClick={handleAddTrip} className="bg-green-600 text-white p-2 rounded col-span-3 font-bold">Launch Route 🚀</button>
        </div>
      </section>

      {/* 2. POD Management & Tracking */}
      <section className="bg-white p-6 rounded shadow border">
        <h2 className="text-2xl font-bold mb-4">POD Tracking & Management</h2>
        <div className="space-y-4">
          <input
            className="w-full border p-2"
            list="pod-trip-numbers"
            placeholder="Search trip for POD"
            value={podUpdate.trip_id}
            onChange={(e) => setPodUpdate({...podUpdate, trip_id: e.target.value})}
          />
          <datalist id="pod-trip-numbers">
            {activeTrips?.map?.(t => (
              <option key={t.trip_id} value={t.trip_id} label={t.tracking_number || t.trip_id} />
            ))}
          </datalist>
          <div className="grid grid-cols-3 gap-4">
            <input
              className="border p-2"
              list="pod-statuses"
              placeholder="Search status"
              value={podUpdate.pod_status}
              onChange={(e) => setPodUpdate({...podUpdate, pod_status: e.target.value})}
            />
            <datalist id="pod-statuses">
              <option value="Pending" />
              <option value="Received" />
              <option value="Forwarded" />
            </datalist>
            <input type="date" className="border p-2" onChange={(e) => setPodUpdate({...podUpdate, pod_arrived_office_date: e.target.value})} />
            <input type="date" className="border p-2" onChange={(e) => setPodUpdate({...podUpdate, pod_forwarded_client_date: e.target.value})} />
          </div>
          <button onClick={handleUpdatePOD} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Update POD 📄</button>
        </div>

        <div className="overflow-x-auto mt-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-100"><tr><th className="p-2 text-left">Trip</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Office Arrival</th><th className="p-2 text-left">Forwarded</th><th className="p-2 text-left">Action</th></tr></thead>
            <tbody>
              {activeTrips?.map?.(trip => (
                <tr key={trip.trip_id} className="border-t">
                  <td className="p-2">
                    <a href={`/trip-details/${trip.trip_id}`} className="text-blue-600 underline font-bold">
                        {trip.tracking_number}
                    </a>
                  </td>
                  <td className="p-2">{trip.pod_status || 'Pending'}</td>
                  <td className="p-2">{trip.pod_arrived_office_date || '-'}</td>
                  <td className="p-2">{trip.pod_forwarded_client_date || '-'}</td>
                  <td className="p-2"><input type="file" onChange={(e) => setPodFiles({...podFiles, [trip.trip_id]: e.target.files[0]})} /></td>
                  <td className="p-2"><button onClick={() => handleCompleteTrip(trip.trip_id)} className="bg-blue-600 text-white px-3 py-1 rounded">Complete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
export default Trips;