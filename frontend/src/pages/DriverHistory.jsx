import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Search, Plus, Phone, FileSignature, MapPin, Trash2, Edit } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const HistoryTag = ({ completed }) => (
  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
    {completed ? 'Completed' : 'Active'}
  </span>
);

function DriverHistory() {
  const [drivers, setDrivers] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newDriver, setNewDriver] = useState({ name: '', dl_number: '', aadhaar_number: '', mobile_number: '', dl_expiry_date: '' });

  useEffect(() => { fetchDrivers(); }, []);

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/drivers`);
      setDrivers(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setDrivers([]); }
  };

  const resetDriverForm = () => {
    setEditingDriver(null);
    setNewDriver({ name: '', dl_number: '', aadhaar_number: '', mobile_number: '', dl_expiry_date: '' });
  };

  const saveDriver = async () => {
    if (!newDriver.name || !newDriver.dl_number) return alert("Name and DL number are required.");
    const payload = { ...newDriver, mobile_number: newDriver.mobile_number || null, dl_expiry_date: newDriver.dl_expiry_date || null };
    try {
      if (editingDriver) await axios.put(`${API_BASE}/drivers/${editingDriver.driver_id}`, payload);
      else await axios.post(`${API_BASE}/drivers`, payload);
      await fetchDrivers(); resetDriverForm(); setShowForm(false);
    } catch (err) { alert("Error saving driver."); }
  };

  const startEditingDriver = (driver, e) => {
    e.stopPropagation();
    setEditingDriver(driver);
    setNewDriver({
      name: driver.name || '', dl_number: driver.dl_number || '', aadhaar_number: driver.aadhaar_number || '',
      mobile_number: driver.mobile_number || '', dl_expiry_date: driver.dl_expiry_date ? String(driver.dl_expiry_date).slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const deleteDriver = async (driver_id, e) => {
    e.stopPropagation();
    if(window.confirm("Delete this driver permanently?")) {
      try {
        await axios.delete(`${API_BASE}/drivers/${driver_id}`);
        fetchDrivers(); if(selectedDriver?.driver_id === driver_id) setSelectedDriver(null);
      } catch (err) { alert("Cannot delete: driver is in use."); }
    }
  };

  const handleSelectDriver = async (driver) => {
    setSelectedDriver(driver);
    try {
      const res = await axios.get(`${API_BASE}/trips/by-driver/${driver.name}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setHistory([]); }
  };

  const filteredDrivers = drivers.filter(d => d.name?.toLowerCase().includes(searchQuery.toLowerCase()) || d.mobile_number?.includes(searchQuery));

  return (
    <div className="flex flex-col lg:flex-row h-[85vh] gap-6">
      
      {/* 1/3 COLUMN: Driver Directory */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border flex flex-col">
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Users className="h-5 w-5 text-gray-400"/> Driver Directory</h3>
          <button onClick={() => { resetDriverForm(); setShowForm(!showForm); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-blue-700 transition"><Plus className="h-4 w-4"/> Add</button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border rounded-lg p-2.5 pl-9 text-sm focus:ring-2 focus:ring-blue-100 outline-none" />
        </div>

        {showForm && (
            <div className="bg-gray-50 p-4 mb-4 rounded-xl border space-y-2">
                <input placeholder="Name *" className="w-full border p-2 rounded text-sm outline-none" value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} />
                <input placeholder="DL Number *" className="w-full border p-2 rounded text-sm outline-none" value={newDriver.dl_number} onChange={e => setNewDriver({...newDriver, dl_number: e.target.value})} />
                <input placeholder="Aadhaar" className="w-full border p-2 rounded text-sm outline-none" value={newDriver.aadhaar_number} onChange={e => setNewDriver({...newDriver, aadhaar_number: e.target.value})} />
                <input placeholder="Mobile Number" className="w-full border p-2 rounded text-sm outline-none" value={newDriver.mobile_number} onChange={e => setNewDriver({...newDriver, mobile_number: e.target.value})} />
                <input type="date" className="w-full border p-2 rounded text-sm text-gray-500 outline-none" value={newDriver.dl_expiry_date} onChange={e => setNewDriver({...newDriver, dl_expiry_date: e.target.value})} />
                <div className="flex gap-2 pt-2">
                  <button onClick={saveDriver} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg font-bold text-sm">{editingDriver ? "Update" : "Save"}</button>
                  <button onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold">Cancel</button>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {filteredDrivers.map(d => (
            <div key={d.driver_id} onClick={() => handleSelectDriver(d)} className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition group ${selectedDriver?.driver_id === d.driver_id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedDriver?.driver_id === d.driver_id ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                  {d.name.substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{d.name}</div>
                  <div className="text-xs text-gray-500">{d.mobile_number || 'No phone'}</div>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button onClick={(e) => startEditingDriver(d, e)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md"><Edit className="h-4 w-4"/></button>
                <button onClick={(e) => deleteDriver(d.driver_id, e)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md"><Trash2 className="h-4 w-4"/></button>
              </div>
            </div>
          ))}
          {!filteredDrivers.length && <p className="text-sm text-gray-500 text-center py-4">No drivers found.</p>}
        </div>
      </div>

      {/* 2/3 COLUMN: Driver Details */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {selectedDriver ? (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center gap-4">
                <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center font-bold text-2xl text-blue-700">{selectedDriver.name.substring(0, 2).toUpperCase()}</div>
                <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900">{selectedDriver.name}</h2>
                    <p className="text-sm text-gray-500">ID: {selectedDriver.driver_id}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-1.5"><Phone className="h-4 w-4 text-gray-400" />Contact Info</h4>
                    <p className="text-sm mb-1 text-gray-500">Phone: <span className="font-medium text-gray-800">{selectedDriver.mobile_number || '-'}</span></p>
                    <p className="text-sm text-gray-500">Aadhaar: <span className="font-medium text-gray-800">{selectedDriver.aadhaar_number || '-'}</span></p>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-1.5"><FileSignature className="h-4 w-4 text-gray-400" />License Details</h4>
                    <p className="text-sm mb-1 text-gray-500">DL No: <span className="font-medium text-gray-800">{selectedDriver.dl_number || '-'}</span></p>
                    <p className="text-xs text-green-700 font-semibold mt-2 p-1.5 inline-block rounded-md bg-green-50 border border-green-100">Expiry: {selectedDriver.dl_expiry_date ? new Date(selectedDriver.dl_expiry_date).toLocaleDateString() : 'Unknown'}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border shadow-sm">
                    <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-1.5"><MapPin className="h-4 w-4 text-gray-400" />Total Trips</h4>
                    <div className="text-3xl font-bold text-gray-900 mt-2">{history.length}</div>
                    <p className="text-xs text-gray-500 mt-1">Trips managed by driver</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-5 border-b bg-gray-50"><h3 className="font-bold text-gray-900">Recent Trip History</h3></div>
                <table className="w-full text-sm">
                    <thead className="border-b text-gray-600 bg-white">
                        <tr className="text-left"><th className="p-4">Trip ID</th><th className="p-4">Vehicle</th><th className="p-4">Start Date</th><th className="p-4 text-center">Status</th></tr>
                    </thead>
                    <tbody>
                        {history.map((h, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="p-4 font-semibold text-blue-600">{h.tracking_number}</td>
                                <td className="p-4 font-bold text-gray-900">{h.vehicle_number}</td>
                                <td className="p-4 text-gray-600">{h.trip_start_date}</td>
                                <td className="p-4 text-center"><HistoryTag completed={h.actual_delivery_date} /></td>
                            </tr>
                        ))}
                        {!history.length && <tr><td colSpan="4" className="p-8 text-center text-gray-500">No trips recorded for this driver.</td></tr>}
                    </tbody>
                </table>
            </div>
          </>
        ) : (
          <div className="bg-white h-full min-h-[400px] flex items-center justify-center rounded-2xl border shadow-sm text-gray-400">
             Select a driver to view profile and history.
          </div>
        )}
      </div>
    </div>
  );
}

export default DriverHistory;