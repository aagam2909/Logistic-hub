import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Truck, Search, PlusCircle, Trash2, Edit, X, History } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

function FleetRegistry() {
  const [assets, setAssets] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [truckTrips, setTruckTrips] = useState([]);
  const [truckHistoryLoading, setTruckHistoryLoading] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('All Time');
  
  const [formData, setFormData] = useState({
    vehicle_number: '',
    driver_name: '',
    compensation_type: 'KM Based',
    mileage: '5.5',
    per_km_rate: '',
    fixed_salary: '',
    current_status: 'Available'
  });

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/assets`);
      setAssets(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching assets:", err);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/drivers`);
      setDrivers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching drivers:", err);
      setDrivers([]);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchDrivers();
  }, []);

  const resetTruckForm = () => {
    setEditingAsset(null);
    setShowForm(false);
    setFormData({ vehicle_number: '', driver_name: '', compensation_type: 'KM Based', mileage: '5.5', per_km_rate: '', fixed_salary: '', current_status: 'Available' });
  };

  const handleSaveTruck = async () => {
    if (!formData.vehicle_number || !formData.driver_name) {
      alert("Please fill in Vehicle Number and Driver Name!");
      return;
    }

    if (formData.compensation_type === 'Salary Based' && !formData.fixed_salary) {
      alert("Please enter the fixed salary amount!");
      return;
    }

    if (formData.compensation_type === 'KM Based' && !formData.per_km_rate) {
      alert("Please enter the KM/Rate!");
      return;
    }

    try {
      if (editingAsset) {
        await axios.put(`${API_BASE}/assets/${encodeURIComponent(editingAsset.vehicle_number)}`, {
          driver_name: formData.driver_name,
          compensation_type: formData.compensation_type,
          mileage: Number(formData.mileage) || 0,
          per_km_rate: Number(formData.per_km_rate) || 0,
          fixed_salary: Number(formData.fixed_salary) || 0,
          current_status: formData.current_status,
        });
        alert("Truck updated successfully!");
      } else {
        const data = new FormData();
        data.append("vehicle_number", formData.vehicle_number);
        data.append("driver_name", formData.driver_name);
        data.append("compensation_type", formData.compensation_type);
        data.append("mileage", formData.mileage || 0);
        data.append("per_km_rate", formData.per_km_rate || 0);
        data.append("fixed_salary", formData.fixed_salary || 0);
        await axios.post(`${API_BASE}/assets`, data);
        alert("Truck added successfully!");
      }
      resetTruckForm();
      await fetchAssets();
    } catch (err) {
      console.error("Error saving truck:", err.response?.data ?? err.message);
      alert(err.response?.data?.detail || "Unable to save truck. Ensure Vehicle Number is unique.");
    }
  };

  const startEditingAsset = (asset) => {
    setEditingAsset(asset);
    setFormData({
      vehicle_number: asset.vehicle_number || '',
      driver_name: asset.driver_name || '',
      compensation_type: asset.compensation_type || 'KM Based',
      mileage: asset.mileage ?? '5.5',
      per_km_rate: asset.per_km_rate ?? '',
      fixed_salary: asset.fixed_salary ?? '',
      current_status: asset.current_status || 'Available',
    });
    setShowForm(true);
  };

  const openTruckHistory = async (vehicleNumber) => {
    setSelectedTruck(vehicleNumber);
    setHistoryDateFilter('All Time');
    setTruckTrips([]);
    setTruckHistoryLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/trips/truck/${encodeURIComponent(vehicleNumber)}`);
      setTruckTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching truck history:", err);
      alert(err.response?.data?.detail || "Unable to load truck history.");
    } finally {
      setTruckHistoryLoading(false);
    }
  };

  const handleDelete = async (vehicleNumber) => {
    if (!window.confirm(`Are you sure you want to archive ${vehicleNumber}?`)) return;

    try {
      await axios.delete(`${API_BASE}/assets/${encodeURIComponent(vehicleNumber)}`);
      fetchAssets();
    } catch (err) {
      console.error("Error deleting:", err);
      alert(err.response?.data?.detail || "Cannot delete: vehicle is in use.");
    }
  };

  const filteredAssets = assets.filter(asset => 
      (asset.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.driver_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.current_status || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Truck className="h-8 w-8 text-blue-600"/> Fleet Registry
            </h2>
            <p className="text-sm text-gray-500 mt-1">Manage active trucks, driver compensation models, and mileage.</p>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search truck, driver, or status..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 text-sm focus:ring-2 focus:ring-slate-100 outline-none" 
                />
            </div>

            <button 
                onClick={() => { resetTruckForm(); setShowForm(!showForm); }} 
                className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition shadow-sm flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
                <PlusCircle className="h-5 w-5"/> {showForm && !editingAsset ? 'Cancel' : 'Add Truck'}
            </button>
        </div>
      </div>

      {/* ADD / EDIT FORM */}
      {showForm && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <input 
                className="border p-3 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-slate-100" 
                placeholder="Vehicle No (e.g., RJ14GB1234) *" 
                value={formData.vehicle_number} 
                disabled={Boolean(editingAsset)}
                onChange={e => setFormData({...formData, vehicle_number: e.target.value})} 
              />
              
              <input 
                className="border p-3 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-slate-100" 
                list="driver-names" 
                placeholder="Assign Driver *" 
                value={formData.driver_name} 
                onChange={e => setFormData({...formData, driver_name: e.target.value})} 
              />
              <datalist id="driver-names">
                {drivers.map(driver => <option key={driver.driver_id} value={driver.name} />)}
              </datalist>

              {/* COMPENSATION TYPE SELECTOR */}
              <select 
                className="border p-3 rounded-lg text-sm bg-white outline-none font-medium cursor-pointer"
                value={formData.compensation_type}
                onChange={e => setFormData({...formData, compensation_type: e.target.value})}
              >
                <option value="KM Based">KM Based</option>
                <option value="Salary Based">Salary Based</option>
              </select>

              {/* CONDITIONAL INPUTS BASED ON COMPENSATION TYPE */}
              {formData.compensation_type === 'Salary Based' ? (
                <input 
                  className="border p-3 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-slate-100 font-bold text-emerald-700" 
                  type="number" 
                  placeholder="Fixed Salary Amount (₹) *" 
                  value={formData.fixed_salary} 
                  onChange={e => setFormData({...formData, fixed_salary: e.target.value})} 
                />
              ) : (
                <>
                  <input 
                    className="border p-3 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-slate-100" 
                    type="number" 
                    step="0.1"
                    placeholder="Mileage (e.g., 5.5)" 
                    value={formData.mileage} 
                    onChange={e => setFormData({...formData, mileage: e.target.value})} 
                  />
                  <input 
                    className="border p-3 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-slate-100" 
                    type="number" 
                    placeholder="Rate / KM (₹) *" 
                    value={formData.per_km_rate} 
                    onChange={e => setFormData({...formData, per_km_rate: e.target.value})} 
                  />
                </>
              )}
              
              <input 
                className="border p-3 rounded-lg text-sm bg-gray-50 outline-none focus:ring-2 focus:ring-slate-100" 
                list="asset-statuses" 
                placeholder="Current Status" 
                value={formData.current_status} 
                onChange={e => setFormData({...formData, current_status: e.target.value})} 
              />
              <datalist id="asset-statuses">
                <option value="Available" />
                <option value="In-Transit" />
                <option value="Maintenance" />
              </datalist>

              <div className="flex gap-2 lg:col-span-2">
                  <button onClick={handleSaveTruck} className="flex-1 bg-blue-600 text-white rounded-lg font-bold shadow-sm hover:bg-blue-700 transition cursor-pointer py-3">
                      {editingAsset ? 'Update Truck' : 'Save Truck'}
                  </button>
                  {editingAsset && (
                      <button onClick={resetTruckForm} className="px-6 border border-gray-200 rounded-lg font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer">
                          Cancel
                      </button>
                  )}
              </div>
          </div>
      )}

      {/* FLEET TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-gray-500 font-medium">Loading Fleet Data...</p>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 font-semibold">
              <tr>
                <th className="p-4">Vehicle Number</th>
                <th className="p-4">Assigned Driver</th>
                <th className="p-4">Compensation Model</th>
                <th className="p-4">Mileage</th>
                <th className="p-4">Rate / Salary</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAssets.map(asset => (
                <tr key={asset.vehicle_number} className="hover:bg-gray-50 transition group">
                  <td className="p-4 font-bold text-slate-800 text-base">{asset.vehicle_number}</td>
                  <td className="p-4 text-gray-700 font-medium">{asset.driver_name || <span className="text-gray-400 italic">Unassigned</span>}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${asset.compensation_type === 'Salary Based' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {asset.compensation_type || 'KM Based'}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-gray-700">{asset.mileage ? `${asset.mileage} km/l` : '-'}</td>
                  <td className="p-4 font-bold text-emerald-600">
                    {asset.compensation_type === 'Salary Based' ? `₹${asset.fixed_salary || 0} / mo` : `₹${asset.per_km_rate || 0} / km`}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${asset.current_status === 'Available' ? 'bg-green-100 text-green-700' : asset.current_status === 'In-Transit' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {asset.current_status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                        <button onClick={() => openTruckHistory(asset.vehicle_number)} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-200 shadow-sm text-xs transition flex items-center gap-1 cursor-pointer">
                            <History className="h-3 w-3"/> History
                        </button>
                        <button onClick={() => startEditingAsset(asset)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer">
                            <Edit className="h-4 w-4"/>
                        </button>
                        {asset.current_status !== 'Archived' && (
                            <button onClick={() => handleDelete(asset.vehicle_number)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded transition cursor-pointer">
                                <Trash2 className="h-4 w-4"/>
                            </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredAssets.length && (
                <tr>
                  <td className="p-10 text-center text-gray-500" colSpan="7">No trucks found matching your search.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}

export default FleetRegistry;