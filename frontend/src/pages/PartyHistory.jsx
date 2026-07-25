import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BriefcaseBusiness, Search, Plus, Trash2, Edit, IndianRupee, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

function PartyHistory() {
  const [parties, setParties] = useState([]);
  const [partyTrips, setPartyTrips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingParty, setEditingParty] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPartyName, setNewPartyName] = useState('');

  const fetchParties = async () => {
    try {
        const res = await axios.get(`${API_BASE}/parties`);
        setParties(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setParties([]); }
  };

  useEffect(() => { fetchParties(); }, []);

  const resetForm = () => { setEditingParty(null); setNewPartyName(''); setShowAdd(false); };

  const saveParty = async () => {
    if(!newPartyName.trim()) return;
    try {
        const formData = new FormData(); formData.append('name', newPartyName.trim());
        if (editingParty) await axios.put(`${API_BASE}/parties/${encodeURIComponent(editingParty)}`, formData);
        else await axios.post(`${API_BASE}/parties`, formData);
        await fetchParties(); resetForm();
    } catch(err) { alert("Error saving client"); }
  };

  const startEditParty = (p, e) => {
    e.stopPropagation(); setEditingParty(p); setNewPartyName(typeof p === 'string' ? p : p.party_name); setShowAdd(true);
  };

  const deleteParty = async (partyName, e) => {
    e.stopPropagation();
    if(window.confirm(`Delete client ${partyName}?`)) {
        try {
            await axios.delete(`${API_BASE}/parties/${encodeURIComponent(partyName)}`);
            await fetchParties(); if(selected === partyName) setSelected(null);
        } catch (err) { alert("Cannot delete: party is in use."); }
    }
  };

  const fetchHistory = async (partyName) => {
    setSelected(partyName);
    try {
        const res = await axios.get(`${API_BASE}/trips/by-party/${encodeURIComponent(partyName)}`);
        setPartyTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setPartyTrips([]); }
  };

  const filteredParties = parties.filter(p => {
    const name = typeof p === 'string' ? p : p.party_name;
    return name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // --- LEDGER MATH ---
  const outstandingTrips = partyTrips.filter(t => parseFloat(t.balance_payment || 0) > 0);
  const totalOutstanding = outstandingTrips.reduce((sum, t) => sum + parseFloat(t.balance_payment || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row h-[85vh] gap-6 p-6">
      
      {/* 1/3 SIDEBAR: Client Directory with Search */}
      <div className="w-full lg:w-1/3 bg-white p-6 rounded-2xl shadow-sm border flex flex-col">
        <div className="flex items-center justify-between mb-4 border-b pb-4">
          <h3 className="font-bold text-lg flex items-center gap-2"><BriefcaseBusiness className="h-5 w-5 text-gray-400"/> Client Directory</h3>
          <button onClick={() => { resetForm(); setShowAdd(!showAdd); }} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 hover:bg-blue-700 transition"><Plus className="h-4 w-4"/> Add</button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full border rounded-lg p-2.5 pl-9 text-sm focus:ring-2 focus:ring-blue-100 outline-none" />
        </div>

        {showAdd && (
            <div className="bg-gray-50 p-4 mb-4 rounded-xl border space-y-2">
                <input className="w-full border p-2 rounded text-sm outline-none" placeholder="Client Name *" value={newPartyName} onChange={e => setNewPartyName(e.target.value)} />
                <div className="flex gap-2 pt-2">
                    <button onClick={saveParty} className="flex-1 bg-green-600 text-white py-1.5 rounded-lg font-bold text-sm">{editingParty ? "Update" : "Save"}</button>
                    <button onClick={resetForm} className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-semibold">Cancel</button>
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {filteredParties.map(p => {
            const pName = typeof p === 'string' ? p : p.party_name;
            return (
              <div key={pName} onClick={() => fetchHistory(pName)} className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between transition group ${selected === pName ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center gap-3">
                     <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${selected === pName ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                        {pName.substring(0,2).toUpperCase()}
                     </div>
                     <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]">{pName}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={(e) => startEditParty(p, e)} className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-md"><Edit className="h-4 w-4"/></button>
                      <button onClick={(e) => deleteParty(pName, e)} className="p-1.5 text-red-500 hover:bg-red-100 rounded-md"><Trash2 className="h-4 w-4"/></button>
                  </div>
              </div>
            );
          })}
          {!filteredParties.length && <p className="text-sm text-gray-500 text-center py-4">No clients found.</p>}
        </div>
      </div>

      {/* 2/3 MAIN: Detailed Client Ledger Area */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {selected ? (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border flex justify-between items-center">
               <div>
                   <h2 className="text-2xl font-bold text-gray-900 mb-1">{selected}</h2>
                   <p className="text-sm text-gray-500">Total Shipments Managed: <span className="font-bold text-gray-800">{partyTrips.length}</span></p>
               </div>
            </div>
            
            {/* PENDING PAYMENTS LEDGER BOX */}
            <div className="bg-white rounded-2xl shadow-sm border-2 border-rose-200 overflow-hidden">
               <div className="bg-rose-50 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-rose-100">
                  <div>
                     <h3 className="text-lg font-bold text-rose-900 flex items-center gap-2">
                         <AlertCircle className="h-5 w-5"/> Pending Payments Ledger
                     </h3>
                     <p className="text-xs text-rose-700 font-medium mt-0.5">Trips with outstanding balances remaining</p>
                  </div>
                  <div className="bg-white px-5 py-2.5 rounded-xl border border-rose-200 shadow-sm text-right">
                     <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Total Amount Due</p>
                     <p className="text-2xl font-black text-rose-600 flex items-center gap-0.5">
                        <IndianRupee className="h-5 w-5"/> {totalOutstanding.toLocaleString('en-IN')}
                     </p>
                  </div>
               </div>

               <div className="p-5 bg-white">
                  {outstandingTrips.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {outstandingTrips.map(trip => (
                              <div key={trip.trip_id} className="border border-gray-200 p-3.5 rounded-xl hover:border-rose-300 transition shadow-sm bg-gray-50 flex flex-col justify-between">
                                  <div>
                                     <a href={`/trip-details/${trip.trip_id}`} className="font-bold text-blue-700 hover:underline text-xs break-all">
                                        {trip.tracking_number}
                                     </a>
                                     <p className="text-xs text-gray-500 mt-1 font-medium">{trip.source_city} → {trip.destination_city}</p>
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-gray-200 flex justify-between items-center">
                                     <span className="text-[11px] font-bold text-gray-600 uppercase">Remaining Balance:</span>
                                     <span className="font-extrabold text-base text-rose-600">₹{trip.balance_payment}</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <div className="text-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                          <p className="text-emerald-700 font-bold text-base">All Clear! 🎉</p>
                          <p className="text-emerald-600 text-xs mt-0.5">This client has no outstanding balances.</p>
                      </div>
                  )}
               </div>
            </div>

            {/* FULL WORK HISTORY TABLE */}
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-5 border-b bg-gray-50"><h3 className="font-bold text-gray-900">Complete Work History & Logistics Log</h3></div>
              <table className="w-full text-sm text-left">
                <thead className="border-b text-gray-600 bg-white">
                    <tr><th className="p-4">Trip ID</th><th className="p-4">Vehicle</th><th className="p-4">Date</th><th className="p-4 text-center">Status</th></tr>
                </thead>
                <tbody>
                  {partyTrips.map(h => (
                    <tr key={h.trip_id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-4">
                        <a href={`/trip-details/${h.trip_id}`} className="font-semibold text-blue-600 hover:underline">
                          {h.tracking_number}
                        </a>
                      </td>
                      <td className="p-4 font-bold text-gray-900">{h.vehicle_number}</td>
                      <td className="p-4 text-gray-600">{h.trip_start_date || '-'}</td>
                      <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-xs font-semibold ${h.actual_delivery_date ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{h.actual_delivery_date ? "Completed" : "Active"}</span></td>
                    </tr>
                  ))}
                  {!partyTrips.length && <tr><td colSpan="4" className="p-8 text-center text-gray-500">No active or past shipments found for this client.</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="bg-white h-full min-h-[400px] flex items-center justify-center rounded-2xl border shadow-sm text-gray-400">
             Choose a client from the directory to review their ledger.
          </div>
        )}
      </div>
    </div>
  );
}

export default PartyHistory;