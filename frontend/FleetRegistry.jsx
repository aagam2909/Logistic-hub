import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

function FleetRegistry() {
  const [assets, setAssets] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    vehicle_number: '', driver_name: '', per_km_rate: '' 
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/assets`);
      setAssets(res.data);
    } catch (err) { console.error("Error fetching assets:", err); } 
    finally { setLoading(false); }
  };

  const fetchDrivers = async () => {
    try { const res = await axios.get(`${API_BASE}/drivers`); setDrivers(res.data); }
    catch (err) { console.error("Error fetching drivers:", err); }
  };

  useEffect(() => { fetchAssets(); fetchDrivers(); }, []);

  const handleAddTruck = async () => {
    if (!formData.vehicle_number || !formData.per_km_rate || !formData.driver_name) {
      alert("Please fill all fields!");
      return;
    }

    const data = new FormData();
    data.append("vehicle_number", formData.vehicle_number);
    data.append("driver_name", formData.driver_name);
    data.append("per_km_rate", formData.per_km_rate);
    
    try {
      await axios.post(`${API_BASE}/assets`, data);
      setFormData({ vehicle_number: '', driver_name: '', per_km_rate: '' });
      fetchAssets(); 
    } catch (err) { alert("Error adding truck."); }
  };

  const handleDelete = async (vehicle_number) => {
    if (window.confirm("Delete this truck?")) {
      try {
        await axios.delete(`${API_BASE}/assets/${vehicle_number}`);
        fetchAssets(); 
      } catch (err) { console.error("Error deleting:", err); }
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Fleet Registry</h2>
      
      {/* Input Form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8 grid grid-cols-2 gap-4">
        <input className="border p-2 rounded" placeholder="Vehicle No *" value={formData.vehicle_number} onChange={e => setFormData({...formData, vehicle_number: e.target.value})} />
        
        {/* Dropdown for Drivers */}
        <select className="border p-2 rounded" onChange={e => setFormData({...formData, driver_name: e.target.value})}>
            <option value="">Select Driver</option>
            {drivers?.map?.(d => <option key={d.driver_id} value={d.name}>{d.name}</option>)}
        </select>
        
        <input className="border p-2 rounded" type="number" placeholder="Rate/KM *" value={formData.per_km_rate} onChange={e => setFormData({...formData, per_km_rate: e.target.value})} />
        
        <button onClick={handleAddTruck} className="bg-blue-600 text-white p-2 rounded font-semibold col-span-2 hover:bg-blue-700">Add Truck</button>
      </div>

      {/* Truck List Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? <p className="p-4 text-center">Loading...</p> : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr><th className="p-4">Vehicle</th><th className="p-4">Driver</th><th className="p-4">Rate/KM</th><th className="p-4">Status</th><th className="p-4">Action</th></tr>
            </thead>
            <tbody>
              {assets?.map?.(a => (
                <tr key={a.vehicle_number} className="border-b">
                  <td className="p-4 font-medium">{a.vehicle_number}</td>
                  <td className="p-4">{a.driver_name}</td>
                  <td className="p-4">₹ {a.per_km_rate}</td>
                  <td className="p-4">{a.current_status}</td>
                  <td className="p-4"><button onClick={() => handleDelete(a.vehicle_number)} className="text-red-600 font-bold">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default FleetRegistry;
