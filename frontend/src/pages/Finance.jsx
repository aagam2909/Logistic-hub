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
  
  // FIX APPLIED HERE FOR REACT-TO-PRINT V3
  const componentRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: componentRef });

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
        const tripData = res.data.trip || res.data;
        setSelectedTrip(tripData);
        
        if (tripData.freight_amount !== undefined) {
            setFinance({
                freight_amount: tripData.freight_amount || 0,
                adv_amt: tripData.adv_amt || 0,
                expenses: tripData.expenses || 0,
                tds: tripData.tds || 0,
                finance_remarks: tripData.finance_remarks || ''
            });
        }
    } catch (err) { alert("Error loading trip details"); }
  };

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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      
      <div className="print:hidden">
        <h2 className="text-3xl font-bold mb-4">Automated Finance Ledger</h2>
        <div className="flex gap-3 bg-white p-4 rounded-lg shadow-sm border">
          <input
            className="border p-3 w-full rounded-lg bg-gray-50 focus:ring-2 focus:ring-blue-100 outline-none"
            list="tracking-numbers"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Search tracking number..."
          />
          <datalist id="tracking-numbers">
            {trips?.map?.((trip) => (
              <option key={trip.trip_id} value={trip.tracking_number} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={loadTripFinance}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 rounded-lg font-bold transition shadow-sm"
          >
            Load Trip
          </button>
        </div>
      </div>

      {selectedTrip && (
        <div className="bg-white shadow-lg border rounded-xl overflow-hidden">
          
          <div className="print:hidden bg-gray-50 px-8 py-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-gray-600">Ledger Entry Loaded</h3>
            <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg font-bold shadow-sm transition flex items-center gap-2">
              🖨️ Print Receipt
            </button>
          </div>

          <div ref={componentRef} className="p-10 bg-white print:p-0">
            
            <div className="border-b-2 border-slate-900 pb-6 mb-8 text-center print:text-left print:flex print:justify-between print:items-end">
                <div>
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">JAIN FREIGHT CARRIERS</h1>
                  <p className="text-gray-500 mt-1 font-medium">Logistics & Transportation Services</p>
                </div>
                <div className="mt-4 print:mt-0 text-right">
                  <h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2>
                  <p className="text-sm font-semibold text-gray-500 mt-1">TRK: {selectedTrip.tracking_number}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="space-y-3">
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{selectedTrip.trip_start_date || '-'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-lg">{selectedTrip.vehicle_number}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{selectedTrip.source_city} → {selectedTrip.destination_city}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Delivery Date:</span> <span className="font-bold">{selectedTrip.actual_delivery_date || 'Pending'}</span></div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{selectedTrip.party_name || 'N/A'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{selectedTrip.gta_name || 'N/A'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{selectedTrip.lr_no || 'N/A'}</span></div>
                  <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">E-Way Bill:</span> <span className="font-bold">{selectedTrip.eway_bill || 'N/A'}</span></div>
                </div>
            </div>

            <h3 className="font-bold text-lg mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
            <div className="bg-slate-50 border rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0">
                
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <label className="text-sm font-semibold text-gray-700">Total Freight (₹)</label>
                  <input className="border p-2 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.freight_amount} onChange={e => setFinance({...finance, freight_amount: e.target.value})} />
                </div>
                
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <label className="text-sm font-semibold text-gray-700">Advance Received (₹)</label>
                  <input className="border p-2 rounded w-32 text-right font-bold text-rose-600 print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.adv_amt} onChange={e => setFinance({...finance, adv_amt: e.target.value})} />
                </div>
                
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <label className="text-sm font-semibold text-gray-700">Trip Expenses (₹)</label>
                  <input className="border p-2 rounded w-32 text-right font-bold text-rose-600 print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.expenses} onChange={e => setFinance({...finance, expenses: e.target.value})} />
                </div>
                
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <label className="text-sm font-semibold text-gray-700">TDS Deduction (₹)</label>
                  <input className="border p-2 rounded w-32 text-right font-bold text-rose-600 print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.tds} onChange={e => setFinance({...finance, tds: e.target.value})} />
                </div>
                
                <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-white print:border-2 print:bg-transparent">
                    <span className="font-extrabold text-xl text-slate-900">NET BALANCE PAYABLE</span>
                    <span className="font-extrabold text-2xl text-emerald-600 print:text-slate-900">₹{calculatePending()}</span>
                </div>
                
                <div className="col-span-2 mt-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Remarks / Payment Notes:</label>
                  <textarea 
                    className="border p-3 rounded-lg w-full text-sm font-medium resize-none print:border-0 print:p-0 print:bg-transparent" 
                    rows="2" 
                    value={finance.finance_remarks}
                    placeholder="Add remarks for payment..." 
                    onChange={e => setFinance({...finance, finance_remarks: e.target.value})} 
                  />
                </div>
            </div>
            
            <div className="hidden print:flex justify-between mt-20 pt-8">
               <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Receiver's Signature</div>
               <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
            </div>

          </div>
          
          <div className="print:hidden p-6 bg-gray-50 border-t">
            <button onClick={handleSaveFinance} className="bg-emerald-600 text-white px-8 py-3 rounded-lg font-bold w-full hover:bg-emerald-700 shadow-sm transition">
              Save Financial Ledger
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

export default Finances;