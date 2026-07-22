import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';

const API_BASE = import.meta.env.VITE_API_URL;

function Finances() {
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [finance, setFinance] = useState({ 
    freight_amount: 0, adv_amt: 0, expenses: 0, tds: 0, finance_remarks: '' 
  });
  
  const componentRef = useRef();
  const handlePrint = useReactToPrint({ content: () => componentRef.current });

  useEffect(() => {
    axios.get(`${API_BASE}/trips/all`)
      .then((res) => setTrips(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error fetching trips:", err);
        setTrips([]);
      });
  }, []);

  const loadTripFinance = async () => {
    const trackingId = trackingNumber.trim();
    if (!trackingId) return;
    try {
        const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trackingId)}`);
        setSelectedTrip(res.data.trip || res.data);
    } catch (err) { alert("Error loading trip details"); }
  };

  // Calculation Logic: Freight - Advance - Expenses - TDS = Net Balance Payable
  const calculatePending = () => {
    const total = parseFloat(finance.freight_amount || 0);
    const deductions = parseFloat(finance.adv_amt || 0) + parseFloat(finance.expenses || 0) + parseFloat(finance.tds || 0);
    return (total - deductions).toFixed(2);
  };

  const handleSaveFinance = async () => {
    if (!selectedTrip) return;
    try {
      await axios.post(`${API_BASE}/finances/calculate`, { ...finance, trip_id: selectedTrip.trip_id });
      alert("Finance Record Saved Successfully!");
    } catch (err) { alert("Error saving record."); }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-3xl font-bold">Automated Finance Ledger</h2>
      <div className="flex gap-3">
        <input
          className="border p-3 w-full rounded"
          list="tracking-numbers"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Enter tracking number"
        />
        <datalist id="tracking-numbers">
          {trips?.map?.((trip) => (
            <option key={trip.trip_id} value={trip.tracking_number} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={loadTripFinance}
          className="bg-blue-600 text-white px-6 rounded font-bold"
        >
          Load Trip
        </button>
      </div>

      {selectedTrip && (
        <div className="bg-white p-8 shadow-lg border rounded">
          <div ref={componentRef} className="p-4">
            <div className="flex justify-between border-b pb-4 mb-6">
                <h1 className="text-2xl font-bold">Freight Receipt: {selectedTrip.tracking_number}</h1>
                <button onClick={handlePrint} className="bg-slate-900 text-white px-6 py-2 rounded">Print Bill 🖨️</button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
                <div><label className="block text-sm font-semibold">Total Freight (₹)</label><input className="border p-2 w-full" type="number" onChange={e => setFinance({...finance, freight_amount: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold">Advance Amount (₹)</label><input className="border p-2 w-full" type="number" onChange={e => setFinance({...finance, adv_amt: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold">Expenses (₹)</label><input className="border p-2 w-full" type="number" onChange={e => setFinance({...finance, expenses: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold">TDS (₹)</label><input className="border p-2 w-full" type="number" onChange={e => setFinance({...finance, tds: e.target.value})} /></div>
                
                <div className="col-span-2 p-4 bg-gray-100 rounded font-bold text-xl text-center">
                    Net Balance Payable: ₹{calculatePending()}
                </div>
                
                <textarea className="border p-2 col-span-2 w-full" placeholder="Add remarks for payment..." onChange={e => setFinance({...finance, finance_remarks: e.target.value})} />
            </div>
          </div>
          
          <button onClick={handleSaveFinance} className="bg-green-600 text-white px-8 py-3 mt-6 rounded font-bold w-full hover:bg-green-700">Save Ledger & Log Update</button>
        </div>
      )}
    </div>
  );
}
export default Finances;
