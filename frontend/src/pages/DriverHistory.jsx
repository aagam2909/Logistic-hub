import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Users, Search, Plus, Phone, FileSignature, MapPin, Trash2, Edit, Printer, X, Receipt, IndianRupee, AlertCircle, CheckCircle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const API_BASE = import.meta.env.VITE_API_URL;

const HistoryTag = ({ completed }) => (
  <span className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${completed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
    {completed ? 'Completed' : 'Active'}
  </span>
);

function DriversHistory() {
  const [drivers, setDrivers] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newDriver, setNewDriver] = useState({ name: '', dl_number: '', aadhaar_number: '', mobile_number: '', dl_expiry_date: '' });

  // Settlement Date state per trip
  const [settleDates, setSettleDates] = useState({});

  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

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
      const res = await axios.get(`${API_BASE}/trips/by-driver/${encodeURIComponent(driver.name)}`);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setHistory([]); }
  };

  const handleSettleDriver = async (tripId) => {
    const paymentDate = settleDates[tripId] || new Date().toISOString().split('T')[0];
    try {
      await axios.post(`${API_BASE}/finances/settle-driver`, { trip_id: tripId, payment_date: paymentDate });
      alert("Driver payment marked as settled successfully! ✅");
      handleSelectDriver(selectedDriver); // Refresh data
    } catch (err) {
      alert("Failed to settle payment.");
    }
  };

  const filteredDrivers = drivers.filter(d => d.name?.toLowerCase().includes(searchQuery.toLowerCase()) || d.mobile_number?.includes(searchQuery));

  // --- DRIVER LEDGER MATH ---
  const unpaidTrips = history.filter(h => !h.driver_paid && parseFloat(h.driver_remaining || 0) > 0);
  const totalDriverDue = unpaidTrips.reduce((sum, h) => sum + parseFloat(h.driver_remaining || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row h-[85vh] gap-6 p-6">
      
      {/* 1/3 COLUMN: Driver Directory */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border flex flex-col">
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><Users className="h-5 w-5 text-gray-400"/> Directory</h3>
          <button onClick={() => { resetDriverForm(); setShowForm(!showForm); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-blue-700 transition cursor-pointer"><Plus className="h-4 w-4"/> Add</button>
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
                  <button onClick={saveDriver} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg font-bold text-sm cursor-pointer">{editingDriver ? "Update" : "Save"}</button>
                  <button onClick={() => setShowForm(false)} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer">Cancel</button>
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
                <button onClick={(e) => startEditingDriver(d, e)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md cursor-pointer"><Edit className="h-4 w-4"/></button>
                <button onClick={(e) => deleteDriver(d.driver_id, e)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md cursor-pointer"><Trash2 className="h-4 w-4"/></button>
              </div>
            </div>
          ))}
          {!filteredDrivers.length && <p className="text-sm text-gray-500 text-center py-4">No drivers found.</p>}
        </div>
      </div>

      {/* 2/3 COLUMN: Driver Details & Hisaab Ledger */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {selectedDriver ? (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center font-bold text-2xl text-blue-700">{selectedDriver.name.substring(0, 2).toUpperCase()}</div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">{selectedDriver.name}</h2>
                        <p className="text-sm text-gray-500">ID: {selectedDriver.driver_id}</p>
                    </div>
                </div>
                <button 
                  onClick={() => setShowReceipt(true)} 
                  className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-800 shadow-sm text-sm transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Receipt className="h-4 w-4"/> Hisaab Receipt
                </button>
            </div>

            {/* DRIVER OUTSTANDING PAYMENTS BOX */}
            <div className="bg-white rounded-2xl shadow-sm border-2 border-rose-200 overflow-hidden">
               <div className="bg-rose-50 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-rose-100">
                  <div>
                     <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                         <AlertCircle className="h-5 w-5"/> Pending Driver Dues (Remaining Pay)
                     </h3>
                     <p className="text-xs text-rose-700 font-medium mt-0.5">Unsettled remaining balances for <strong>{selectedDriver.name}</strong></p>
                  </div>
                  <div className="bg-white px-5 py-2.5 rounded-xl border border-rose-200 shadow-sm text-right">
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Total Driver Due</p>
                     <p className="text-2xl font-black text-rose-600 flex items-center gap-0.5">
                        <IndianRupee className="h-5 w-5"/> {totalDriverDue.toLocaleString('en-IN')}
                     </p>
                  </div>
               </div>

               <div className="p-5 bg-white">
                  {unpaidTrips.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {unpaidTrips.map(trip => (
                              <div key={trip.trip_id} className="border border-gray-200 p-4 rounded-xl shadow-sm bg-gray-50 flex flex-col justify-between space-y-3">
                                  <div>
                                     <span className="font-bold text-blue-700 text-xs">{trip.tracking_number}</span>
                                     <p className="text-xs text-gray-500 mt-0.5">{trip.source_city} → {trip.destination_city}</p>
                                     <div className="flex justify-between items-center mt-2">
                                         <span className="text-xs text-gray-600">Remaining Pay:</span>
                                         <span className="font-extrabold text-base text-rose-600">₹{trip.driver_remaining}</span>
                                     </div>
                                  </div>

                                  {/* SETTLEMENT CONTROLS */}
                                  <div className="pt-2 border-t border-gray-200 flex items-center gap-2">
                                      <input 
                                          type="date" 
                                          className="border p-1.5 rounded text-xs bg-white text-gray-700 flex-1 font-medium"
                                          value={settleDates[trip.trip_id] || new Date().toISOString().split('T')[0]}
                                          onChange={(e) => setSettleDates({...settleDates, [trip.trip_id]: e.target.value})}
                                      />
                                      <button 
                                          onClick={() => handleSettleDriver(trip.trip_id)}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
                                      >
                                          <CheckCircle className="h-3.5 w-3.5"/> Done
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="text-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-emerald-700 font-bold text-base">All Settled! 🎉</p>
                          <p className="text-emerald-600 text-xs mt-0.5">This driver has no pending remaining dues.</p>
                      </div>
                  )}
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
                <div className="p-5 border-b bg-gray-50"><h3 className="font-bold text-gray-900">Complete Trip History & Diesel Breakdown</h3></div>
                <table className="w-full text-sm">
                    <thead className="border-b text-gray-600 bg-white">
                        <tr className="text-left">
                            <th className="p-4">Trip ID</th>
                            <th className="p-4">Vehicle</th>
                            <th className="p-4">Route / KM</th>
                            <th className="p-4">Diesel Needed</th>
                            <th className="p-4">Driver Pay Status</th>
                            <th className="p-4 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map((h, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="p-4 font-semibold text-blue-600">{h.tracking_number}</td>
                                <td className="p-4 font-bold text-gray-900">{h.vehicle_number}</td>
                                <td className="p-4 text-gray-600">{h.source_city} → {h.destination_city} ({h.total_km || 0} km)</td>
                                <td className="p-4 font-semibold text-amber-600">{h.diesel_liters_needed || 0} L (₹{h.diesel_cost || 0})</td>
                                <td className="p-4">
                                    {h.driver_paid ? (
                                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">Paid on {h.driver_payment_date}</span>
                                    ) : (
                                        <span className="text-xs bg-rose-100 text-rose-800 px-2.5 py-1 rounded-full font-bold">Due: ₹{h.driver_remaining}</span>
                                    )}
                                </td>
                                <td className="p-4 text-center"><HistoryTag completed={h.actual_delivery_date} /></td>
                            </tr>
                        ))}
                        {!history.length && <tr><td colSpan="6" className="p-8 text-center text-gray-500">No trips recorded for this driver.</td></tr>}
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

      {/* Hisaab Receipt Modal */}
      {showReceipt && selectedDriver && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
               <h3 className="font-bold text-lg text-slate-800">Driver Settlement Receipt</h3>
               <button onClick={() => setShowReceipt(false)} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition cursor-pointer"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
               <div ref={receiptRef} className="bg-white p-10 mx-auto shadow-sm border border-gray-200 rounded-xl">
                  
                  <div className="border-b-2 border-slate-900 pb-6 mb-6 flex justify-between items-end">
                      <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">JAIN FREIGHT CARRIERS</h1>
                        <p className="text-gray-500 mt-1 font-medium text-sm">Driver Payment Ledger</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-gray-800 uppercase">Driver Hisaab</h2>
                        <p className="text-sm font-bold text-blue-700 mt-1">{selectedDriver.name}</p>
                      </div>
                  </div>

                  <h3 className="font-bold text-sm mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Trip & Diesel Breakdown</h3>
                  
                  {history.map(trip => (
                      <div key={trip.trip_id} className="mb-6 p-4 border border-gray-200 rounded-lg bg-slate-50 print:bg-transparent print:border-b">
                          <div className="flex justify-between mb-3 text-sm border-b pb-2">
                              <span className="font-bold text-slate-800">TRK: {trip.tracking_number}</span>
                              <span className="font-semibold text-gray-600">{trip.source_city} → {trip.destination_city}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-gray-600">Total KM:</span> <span className="font-bold">{trip.total_km || 0} km</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Diesel Needed:</span> <span className="font-bold text-amber-600">{trip.diesel_liters_needed || 0} L</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Driver Advance:</span> <span className="font-bold text-slate-900">₹{trip.driver_advance || 0}</span></div>
                              <div className="flex justify-between"><span className="text-gray-600">Remaining Balance:</span> <span className="font-bold text-slate-900">₹{trip.driver_remaining || 0}</span></div>
                              <div className="flex justify-between col-span-2 bg-blue-50/50 print:bg-transparent p-1.5 rounded">
                                  <span className="font-extrabold text-gray-900">Payment Status:</span>
                                  <span className={`font-extrabold ${trip.driver_paid ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {trip.driver_paid ? `Paid on ${trip.driver_payment_date}` : `Pending (₹${trip.driver_remaining})`}
                                  </span>
                              </div>
                          </div>
                      </div>
                  ))}

                  {!history.length && <p className="text-center text-gray-500 py-4">No trips recorded for this driver.</p>}

                  <div className="hidden print:flex justify-between mt-20 pt-8">
                     <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Driver's Signature</div>
                     <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
                  </div>

               </div>
            </div>

            <div className="p-5 border-t bg-white flex justify-end gap-4">
               <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-bold transition cursor-pointer">
                 <Printer className="h-5 w-5"/> Print Driver Hisaab
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default DriversHistory;