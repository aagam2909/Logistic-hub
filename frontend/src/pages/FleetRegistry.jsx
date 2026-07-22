import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

function FleetRegistry() {
  const [assets, setAssets] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [truckTrips, setTruckTrips] = useState([]);
  const [truckHistoryLoading, setTruckHistoryLoading] = useState(false);
  const [historyDateFilter, setHistoryDateFilter] = useState('All Time');
  const [formData, setFormData] = useState({
    vehicle_number: '',
    driver_name: '',
    per_km_rate: '',
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
    setFormData({ vehicle_number: '', driver_name: '', per_km_rate: '', current_status: 'Available' });
  };

  const handleSaveTruck = async () => {
    if (!formData.vehicle_number || !formData.per_km_rate || !formData.driver_name) {
      alert("Please fill all fields!");
      return;
    }

    try {
      if (editingAsset) {
        await axios.put(`${API_BASE}/assets/${encodeURIComponent(editingAsset.vehicle_number)}`, {
          driver_name: formData.driver_name,
          per_km_rate: Number(formData.per_km_rate),
          current_status: formData.current_status,
        });
      } else {
        const data = new FormData();
        data.append("vehicle_number", formData.vehicle_number);
        data.append("driver_name", formData.driver_name);
        data.append("per_km_rate", formData.per_km_rate);
        await axios.post(`${API_BASE}/assets`, data);
      }
      resetTruckForm();
      await fetchAssets();
    } catch (err) {
      console.error("Error saving truck:", err.response?.data ?? err.message);
      alert(err.response?.data?.detail || "Unable to save truck.");
    }
  };

  const startEditingAsset = (asset) => {
    setEditingAsset(asset);
    setFormData({
      vehicle_number: asset.vehicle_number || '',
      driver_name: asset.driver_name || '',
      per_km_rate: asset.per_km_rate ?? '',
      current_status: asset.current_status || 'Available',
    });
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

  const filteredTruckTrips = truckTrips.filter((trip) => {
    if (historyDateFilter === 'All Time') return true;
    const tripDate = new Date(trip.trip_start_date || trip.created_at);
    if (Number.isNaN(tripDate.getTime())) return false;

    const now = new Date();
    if (historyDateFilter === 'Last 7 Days') {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);
      return tripDate >= sevenDaysAgo;
    }
    return tripDate.getFullYear() === now.getFullYear()
      && tripDate.getMonth() === now.getMonth();
  });

  const handleDelete = async (vehicleNumber) => {
    if (!window.confirm("Are you sure you want to delete this truck?")) return;

    try {
      await axios.delete(
        `${API_BASE}/assets/${encodeURIComponent(vehicleNumber)}`
      );
      fetchAssets();
    } catch (err) {
      console.error("Error deleting:", err);
      alert(err.response?.data?.detail || "Cannot delete: vehicle is in use or unavailable.");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6">Fleet Registry</h2>

      <div className="bg-white p-6 rounded-lg shadow-md mb-8 grid grid-cols-2 gap-4">
        <input
          className="border p-2 rounded"
          placeholder="Vehicle No *"
          value={formData.vehicle_number}
          disabled={Boolean(editingAsset)}
          onChange={(e) =>
            setFormData({ ...formData, vehicle_number: e.target.value })
          }
        />

        <input
          className="border p-2 rounded"
          list="driver-names"
          placeholder="Search driver"
          value={formData.driver_name}
          onChange={(e) =>
            setFormData({ ...formData, driver_name: e.target.value })
          }
        />
        <datalist id="driver-names">
          {drivers?.map?.((driver) => (
            <option key={driver.driver_id} value={driver.name} />
          ))}
        </datalist>

        <input
          className="border p-2 rounded"
          type="number"
          placeholder="Rate/KM *"
          value={formData.per_km_rate}
          onChange={(e) =>
            setFormData({ ...formData, per_km_rate: e.target.value })
          }
        />

        <input
          className="border p-2 rounded"
          list="asset-statuses"
          placeholder="Truck status"
          value={formData.current_status}
          onChange={(e) => setFormData({ ...formData, current_status: e.target.value })}
        />
        <datalist id="asset-statuses">
          <option value="Available" />
          <option value="In-Transit" />
          <option value="Maintenance" />
        </datalist>

        <button
          onClick={handleSaveTruck}
          className="bg-blue-600 text-white p-2 rounded font-semibold col-span-2 hover:bg-blue-700"
        >
          {editingAsset ? 'Update Truck' : 'Add Truck'}
        </button>
        {editingAsset && (
          <button onClick={resetTruckForm} className="border p-2 rounded font-semibold col-span-2">
            Cancel Edit
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <p className="p-4 text-center">Loading...</p>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4">Vehicle</th>
                <th className="p-4">Driver</th>
                <th className="p-4">Rate/KM</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {assets?.map?.((asset) => (
                <tr key={asset.vehicle_number} className="border-b">
                  <td className="p-4 font-medium">
                    <button
                      onClick={() => openTruckHistory(asset.vehicle_number)}
                      className="text-blue-600 underline font-semibold hover:text-blue-800"
                    >
                      {asset.vehicle_number}
                    </button>
                  </td>
                  <td className="p-4">{asset.driver_name}</td>
                  <td className="p-4">₹ {asset.per_km_rate}</td>
                  <td className="p-4">{asset.current_status}</td>
                  <td className="p-4">
                    <button
                      onClick={() => startEditingAsset(asset)}
                      className="mr-4 text-blue-600 font-bold"
                    >
                      Edit
                    </button>
                    {asset.current_status !== 'Archived' && (
                        <button
                          onClick={() => handleDelete(asset.vehicle_number)}
                          className="text-red-600 font-bold"
                        >
                          Delete
                        </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedTruck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-2xl font-bold">Trip History: {selectedTruck}</h3>
              <button onClick={() => setSelectedTruck(null)} className="text-xl font-bold text-gray-600">×</button>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <label className="font-medium">Date range</label>
              <input
                className="border p-2 rounded"
                list="truck-history-date-filters"
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
              />
              <datalist id="truck-history-date-filters">
                <option value="All Time" />
                <option value="Last 7 Days" />
                <option value="This Month" />
              </datalist>
            </div>
            {truckHistoryLoading ? (
              <p>Loading trip history...</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-100">
                  <tr><th className="p-3">Tracking No.</th><th className="p-3">Date</th><th className="p-3">Route</th><th className="p-3">Party</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody>
                  {filteredTruckTrips?.map?.((trip) => (
                    <tr key={trip.trip_id} className="border-t">
                      <td className="p-3">{trip.tracking_number}</td>
                      <td className="p-3">{trip.trip_start_date || trip.created_at || '-'}</td>
                      <td className="p-3">{trip.source_city} → {trip.destination_city}</td>
                      <td className="p-3">{trip.party_name}</td>
                      <td className="p-3">{trip.actual_delivery_date ? 'Completed' : 'Active'}</td>
                    </tr>
                  ))}
                  {!filteredTruckTrips.length && (
                    <tr><td className="p-4 text-center text-gray-500" colSpan="5">No trips match this date range.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FleetRegistry;