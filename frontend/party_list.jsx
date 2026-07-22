import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

function PartyHistory() {
  const [parties, setParties] = useState([]);
  const [selectedParty, setSelectedParty] = useState('');
  const [history, setHistory] = useState([]);

  // Load unique parties once when the page opens
  useEffect(() => {
    axios.get(`${API_BASE}/trips/all`).then(res => {
        // This automatically pulls all unique parties from your existing trips
        const unique = [...new Set(res.data?.map?.(t => t.party_name) ?? [])];
        setParties(unique);
    });
  }, []);

  // Fetch data for the chosen party
  const loadHistory = async (party) => {
    setSelectedParty(party);
    const res = await axios.get(`${API_BASE}/trips/by-party/${party}`);
    setHistory(res.data);
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-bold">Client History Ledger</h2>
      <select className="border p-3 w-full rounded" onChange={(e) => loadHistory(e.target.value)}>
        <option value="">Select a Party to see full history</option>
        {parties?.map?.(p => <option key={p} value={p}>{p}</option>)}
      </select>

      <table className="w-full bg-white shadow rounded">
        <thead className="bg-gray-100">
            <tr><th className="p-2">Trip ID</th><th className="p-2">Vehicle</th><th className="p-2">LR No</th><th className="p-2">Status</th></tr>
        </thead>
        <tbody>
          {history?.map?.(h => (
            <tr key={h.trip_id} className="border-t text-center">
                <td>{h.tracking_number}</td>
                <td>{h.vehicle_number}</td>
                <td>{h.lr_no}</td>
                <td>{h.pod_status || 'Active'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default PartyHistory;
