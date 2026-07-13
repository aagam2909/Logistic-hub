import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = "http://127.0.0.1:8000";

function PartyHistory() {
  const [parties, setParties] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');

  const fetchParties = async () => {
    try {
        // Backend ke sahi endpoint '/parties' ka use karo
        const res = await axios.get(`${API_BASE}/parties`);
        setParties(res.data);
    } catch (err) { console.error("Error fetching parties:", err); }
  };

  useEffect(() => { fetchParties(); }, []);

  const addParty = async () => {
    if(!newPartyName.trim()) return;
    try {
        const formData = new FormData();
        formData.append('name', newPartyName.trim());
        // POST request to '/parties'
        await axios.post(`${API_BASE}/parties`, formData);
        await fetchParties();
        setNewPartyName('');
        setShowAdd(false);
    } catch(err) { alert("Error saving client"); }
  };

  const deleteParty = async (partyName) => {
    if(window.confirm(`Delete all trips for ${partyName}?`)) {
        try {
            await axios.delete(`${API_BASE}/parties/${encodeURIComponent(partyName)}`);
            await fetchParties();
            if(selected === partyName) setSelected(null);
        } catch(e) { alert("Could not delete."); }
    }
  };

  const fetchHistory = async (partyName) => {
    if(!partyName) return;
    setSelected(partyName);
    try {
        const res = await axios.get(`${API_BASE}/trips/by-party/${encodeURIComponent(partyName)}`);
        setHistory(res.data);
    } catch (err) { console.error("History fetch error:", err); }
  };

  return (
    <div className="flex h-screen bg-gray-50 p-6">
      {/* Client Directory Sidebar */}
      <div className="w-1/4 bg-white shadow-lg p-4 border-r rounded-l-lg">
        <h3 className="font-bold mb-4 text-lg border-b pb-2">Client Directory</h3>
        <button onClick={() => setShowAdd(!showAdd)} className="w-full bg-green-600 text-white p-2 rounded mb-4 font-bold text-sm">+ Add New Client</button>
        {showAdd && (
            <div className="mb-4 p-2 bg-gray-100 rounded border border-green-200">
                <input className="w-full border p-1 mb-1 text-sm" placeholder="Client Name" value={newPartyName} onChange={e => setNewPartyName(e.target.value)} />
                <button onClick={addParty} className="w-full bg-blue-600 text-white py-1 rounded text-xs font-bold">Save Client</button>
            </div>
        )}
        <div className="overflow-y-auto max-h-[65vh]">
          {parties.map(p => (
            <div key={p} className="flex justify-between items-center mb-2 bg-white border rounded shadow-sm hover:border-blue-400">
                <button onClick={() => fetchHistory(p)} className={`flex-1 text-left p-3 transition-all ${selected === p ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-700'}`}>{p}</button>
                <button onClick={() => deleteParty(p)} className="px-3 text-red-400 font-bold hover:text-red-600">X</button>
            </div>
          ))}
        </div>
      </div>

      {/* History Area */}
      <div className="w-3/4 p-6 bg-white shadow-lg rounded-r-lg ml-2">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">{selected ? `Work History: ${selected}` : "Select a Client to View History"}</h2>
        {selected && (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-100"><tr><th className="p-3 border-b">Trip ID</th><th className="p-3 border-b">Vehicle</th><th className="p-3 border-b">Date</th><th className="p-3 border-b">Status</th></tr></thead>
            <tbody>
              {history.length > 0 ? history.map(h => (
                <tr key={h.trip_id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{h.tracking_number}</td>
                  <td className="p-3">{h.vehicle_number}</td>
                  <td className="p-3">{h.trip_start_date}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${h.actual_delivery_date ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{h.actual_delivery_date ? "Completed" : "Active"}</span></td>
                </tr>
              )) : <tr><td colSpan="4" className="p-4 text-center text-gray-500">No history found for this party.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
export default PartyHistory;