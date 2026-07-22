import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

function DriverHistory() {
  const [drivers, setDrivers] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [newDriver, setNewDriver] = useState({
    name: '', dl_number: '', aadhaar_number: '', mobile_number: '', dl_expiry_date: ''
  });

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/drivers`);
      setDrivers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching drivers:", err);
      setDrivers([]);
    }
  };

  const resetDriverForm = () => {
    setEditingDriver(null);
    setNewDriver({ name: '', dl_number: '', aadhaar_number: '', mobile_number: '', dl_expiry_date: '' });
  };

  const saveDriver = async () => {
    if (!newDriver.name || !newDriver.dl_number || !newDriver.aadhaar_number) {
      alert("Name, DL number, and Aadhaar number are required.");
      return;
    }

    const driverPayload = {
      ...newDriver,
      mobile_number: newDriver.mobile_number || null,
      dl_expiry_date: newDriver.dl_expiry_date || null,
    };

    try {
      if (editingDriver) {
        await axios.put(`${API_BASE}/drivers/${editingDriver.driver_id}`, driverPayload);
      } else {
        await axios.post(`${API_BASE}/drivers`, driverPayload);
      }
      await fetchDrivers();
      resetDriverForm();
      setShowForm(false);
    } catch (err) {
      console.error("Error saving driver:", err.response?.data ?? err.message);
      alert("Error saving driver.");
    }
  };

  const startEditingDriver = (driver) => {
    setEditingDriver(driver);
    setNewDriver({
      name: driver.name || '',
      dl_number: driver.dl_number || '',
      aadhaar_number: driver.aadhaar_number || '',
      mobile_number: driver.mobile_number || '',
      dl_expiry_date: driver.dl_expiry_date ? String(driver.dl_expiry_date).slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const deleteDriver = async (driver_id) => {
    if(window.confirm("Delete this driver permanently?")) {
      try {
        await axios.delete(`${API_BASE}/drivers/${driver_id}`);
        fetchDrivers();
        if(selectedDriver === driver_id) setSelectedDriver(null);
      } catch (err) {
        console.error("Error deleting driver:", err);
        alert(err.response?.data?.detail || "Cannot delete: driver is in use or unavailable.");
      }
    }
  };

  const fetchDriverHistory = async (driverName) => {
    setSelectedDriver(driverName);
    try {
      const res = await axios.get(`${API_BASE}/trips/by-driver/${driverName}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching driver history:", err);
      setHistory([]);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 p-6">
      <div className="w-1/4 bg-white shadow p-4 border-r overflow-y-auto">
        <h3 className="font-bold mb-4 text-lg">Driver Management</h3>
        <button onClick={() => { resetDriverForm(); setShowForm(!showForm); }} className="w-full bg-blue-600 text-white p-2 rounded mb-4 font-bold">+ Add New Driver</button>
        {showForm && (
            <div className="bg-gray-100 p-4 mb-4 rounded space-y-2 border border-blue-200">
                <input placeholder="Name *" className="w-full border p-1" value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
                <input placeholder="DL Number *" className="w-full border p-1" value={newDriver.dl_number} onChange={e => setNewDriver({...newDriver, dl_number: e.target.value})} />
                <input placeholder="Aadhaar *" className="w-full border p-1" value={newDriver.aadhaar_number} onChange={e => setNewDriver({...newDriver, aadhaar_number: e.target.value})} />
                <input placeholder="Mobile Number" className="w-full border p-1" value={newDriver.mobile_number} onChange={e => setNewDriver({...newDriver, mobile_number: e.target.value})} />
                <input type="date" className="w-full border p-1" value={newDriver.dl_expiry_date} onChange={e => setNewDriver({...newDriver, dl_expiry_date: e.target.value})} />
                <button onClick={saveDriver} className="w-full bg-green-600 text-white p-1 rounded font-bold">{editingDriver ? "Update Driver" : "Save Driver"}</button>
            </div>
        )}
        {drivers?.map?.(d => (
          <div key={d.driver_id} className="flex justify-between items-center mb-2 bg-white border rounded shadow-sm">
            <button onClick={() => fetchDriverHistory(d.name)} className={`flex-1 text-left p-3 ${selectedDriver === d.name ? 'bg-green-600 text-white' : 'hover:bg-green-100'}`}>
              {d.name}
            </button>
            <button onClick={() => startEditingDriver(d)} className="px-3 text-blue-600 font-bold hover:bg-blue-50">Edit</button>
            <button onClick={() => deleteDriver(d.driver_id)} className="px-3 text-red-500 font-bold hover:bg-red-50">X</button>
          </div>
        ))}
      </div>
      <div className="w-3/4 p-6">
        <h2 className="text-2xl font-bold mb-4">{selectedDriver ? `Trips Managed by: ${selectedDriver}` : "Select a Driver to View History"}</h2>
        <table className="w-full bg-white shadow rounded">
          <thead className="bg-gray-100"><tr className="text-left"><th className="p-3">Trip ID</th><th className="p-3">Vehicle</th><th className="p-3">Start Date</th><th className="p-3">Status</th></tr></thead>
          <tbody>
            {history?.map?.(h => (
              <tr key={h.trip_id} className="border-t">
                <td className="p-3">{h.tracking_number}</td>
                <td className="p-3">{h.vehicle_number}</td>
                <td className="p-3">{h.trip_start_date}</td>
                <td className="p-3 font-semibold">{h.actual_delivery_date ? "Completed" : "Active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default DriverHistory;
