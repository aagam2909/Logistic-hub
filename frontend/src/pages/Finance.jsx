import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

function Finance() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allTrips, setAllTrips] = useState([]);

  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  // Fetch all trips so the search bar can autocomplete
  useEffect(() => {
    axios.get(`${API_BASE}/trips/all`)
      .then(res => setAllTrips(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error("Error fetching trips:", err));
  }, []);

  const handleSearch = async () => {
    if (!trackingNumber.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}`);
      setTrip(res.data.trip || res.data);
    } catch (err) {
      alert("Trip not found. Please check the tracking number.");
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  // Safely parse the advance details array if it exists
  const advances = trip?.advance_details 
    ? (typeof trip.advance_details === 'string' ? JSON.parse(trip.advance_details) : trip.advance_details) 
    : [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
      <h2 className="text-3xl font-bold text-slate-800">Automated Finance Ledger</h2>

      {/* SEARCH BAR */}
      <div className="print:hidden bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <input
          className="border p-3 rounded-lg flex-1 bg-gray-50 focus:ring-2 focus:ring-slate-200 outline-none font-semibold text-slate-700"
          list="all-trip-numbers"
          placeholder="Search Tracking Number (e.g., RJ14GQ2301-GNLOGI-260725)"
          value={trackingNumber}
          onChange={e => setTrackingNumber(e.target.value)}
        />
        <datalist id="all-trip-numbers">
          {allTrips.map(t => <option key={t.trip_id} value={t.tracking_number} />)}
        </datalist>
        <button 
            onClick={handleSearch} 
            disabled={loading} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? 'Loading...' : <><Search className="h-5 w-5"/> Load Trip</>}
        </button>
      </div>

      {/* READ-ONLY RECEIPT UI */}
      {trip && (
        <div className="space-y-4 animate-in fade-in duration-300">
          
          <div className="print:hidden flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-sm">
             <span className="font-semibold">Ledger Entry Loaded: {trip.tracking_number}</span>
             <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-slate-900 px-5 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-100 transition">
               <Printer className="h-5 w-5"/> Print Receipt
             </button>
          </div>

          <div className="bg-white shadow-lg border border-gray-200 rounded-xl overflow-hidden">
            <div ref={receiptRef} className="p-10 bg-white print:p-0">
              
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                  <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">JAIN FREIGHT CARRIERS</h1>
                    <p className="text-gray-500 mt-1 font-medium text-sm">Logistics & Transportation Services</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2>
                    <p className="text-sm font-semibold text-gray-500 mt-1">TRK: {trip.tracking_number}</p>
                    {trip.bill_no && (
                        <p className="text-sm font-bold text-blue-700 mt-1 uppercase tracking-wide">BILL NO: {trip.bill_no}</p>
                    )}
                  </div>
              </div>
              
              {/* Route & Party Info */}
              <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{trip.trip_start_date || '-'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-base">{trip.vehicle_number}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{trip.source_city} → {trip.destination_city}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Delivery Date:</span> <span className="font-bold">{trip.actual_delivery_date || 'Pending'}</span></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{trip.party_name || 'N/A'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{trip.gta_name || 'N/A'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{trip.lr_no || 'N/A'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">E-Way Bill:</span> <span className="font-bold">{trip.eway_bill || 'N/A'}</span></div>
                  </div>
              </div>

              <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  
                  {/* Additions */}
                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                        <span className="text-sm font-semibold text-gray-700">Total Freight</span>
                        <span className="font-bold">₹{trip.freight_amount || 0}</span>
                      </div>
                      {parseFloat(trip.loading_charge || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <span className="text-sm font-semibold text-gray-700">Loading/Unloading</span>
                          <span className="font-bold">₹{trip.loading_charge}</span>
                        </div>
                      )}
                      {parseFloat(trip.holding_charge || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <span className="text-sm font-semibold text-gray-700">Holding Charge</span>
                          <span className="font-bold">₹{trip.holding_charge}</span>
                        </div>
                      )}
                      {parseFloat(trip.gst || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <span className="text-sm font-semibold text-gray-900">GST (18%)</span>
                          <span className="font-bold text-emerald-600">₹{trip.gst}</span>
                        </div>
                      )}
                  </div>

                  {/* Deductions (WITH DATED ADVANCES) */}
                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions (-)</h4>
                      
                      {advances.map((adv, idx) => (
                          <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-1 mb-1">
                              <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                  Advance {adv.date && <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{adv.date}</span>}
                              </span>
                              <span className="font-bold text-rose-600">₹{adv.amount || 0}</span>
                          </div>
                      ))}

                      {parseFloat(trip.tds || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2 mt-2">
                          <span className="text-sm font-semibold text-gray-700">TDS Deduction</span>
                          <span className="font-bold text-rose-600">₹{trip.tds}</span>
                        </div>
                      )}
                      {parseFloat(trip.extra_deduction || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mt-2">
                          <span className="text-sm font-semibold text-gray-700">Extra Deduction</span>
                          <span className="font-bold text-rose-600">₹{trip.extra_deduction}</span>
                        </div>
                      )}
                  </div>
                  
                  <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30 print:border-2 print:bg-transparent">
                      <span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span>
                      <span className="font-extrabold text-2xl text-emerald-600 print:text-slate-900">₹{trip.balance_payment || 0}</span>
                  </div>

                  {trip.finance_remarks && (
                    <div className="col-span-2 mt-2">
                        <span className="block text-xs font-semibold text-gray-500 mb-1">Remarks / Payment Notes:</span>
                        <p className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 print:bg-transparent print:border-0 print:p-0">{trip.finance_remarks}</p>
                    </div>
                  )}
              </div>

              <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Driver Settlement (Hisaab)</h3>
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-sm font-semibold text-gray-700">Total KM Traveled</span>
                    <span className="font-bold text-blue-700">{trip.total_km || 0} KM</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-sm font-semibold text-gray-700">Driver Advance (₹3.5/km)</span>
                    <span className="font-bold text-slate-900">₹{trip.driver_advance || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-sm font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span>
                    <span className="font-bold text-slate-900">₹{trip.driver_remaining || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-sm font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span>
                    <span className="font-extrabold text-blue-700">₹{trip.driver_total || 0}</span>
                  </div>
              </div>
              
              <div className="hidden print:flex justify-between mt-20 pt-8">
                  <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Receiver's Signature</div>
                  <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
              </div>

            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

export default Finance;