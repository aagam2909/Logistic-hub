import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;
const PRESET_BANKS = ['JTA 0706', 'JTA 0611', 'JFC 7734', 'JFC 1487'];

function Finance() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allTrips, setAllTrips] = useState([]);

  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

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

  const advances = trip?.advance_details 
    ? (typeof trip.advance_details === 'string' ? JSON.parse(trip.advance_details) : trip.advance_details) 
    : [];

  // Parse Fastag Details
  const parsedFastag = trip?.fastag_details 
    ? (typeof trip.fastag_details === 'string' ? JSON.parse(trip.fastag_details) : trip.fastag_details) 
    : [];

  const km = parseFloat(trip?.total_km) || 0;
  const mileage = parseFloat(trip?.mileage) || 5.5;
  const displayDiesel = parseFloat(trip?.diesel_liters_needed) || (km > 0 ? (km / mileage).toFixed(2) : 0);
  const displayFastagEst = parseFloat(trip?.fastag_estimate) || (km > 0 ? km * 5.75 : 0);
  const totalFastagActual = parsedFastag.reduce((s, f) => s + parseFloat(f.amount || 0), 0);

  // DYNAMIC BANK OPTIONS LOGIC
  const currentOwner = trip?.owner_name?.toUpperCase() || '';
  const isOwnerJTA = ['JTA', 'JTA(A)'].includes(currentOwner);
  const isOwnerJFC = currentOwner === 'JFC';
  
  let availablePresetBanks = PRESET_BANKS;
  if (isOwnerJTA) availablePresetBanks = ['JTA 0706', 'JTA 0611'];
  if (isOwnerJFC) availablePresetBanks = ['JFC 7734', 'JFC 1487'];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
      <h2 className="text-3xl font-bold text-slate-800">Automated Finance Ledger</h2>

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
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? 'Loading...' : <><Search className="h-5 w-5"/> Load Trip</>}
        </button>
      </div>

      {trip && (
        <div className="space-y-4 animate-in fade-in duration-300">
          
          <div className="print:hidden flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl shadow-sm">
             <span className="font-semibold">Ledger Entry Loaded: {trip.tracking_number}</span>
             <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-slate-900 px-5 py-2 rounded-lg font-bold shadow-sm hover:bg-gray-100 transition cursor-pointer">
               <Printer className="h-5 w-5"/> Print Receipt
             </button>
          </div>

          <div className="bg-white shadow-lg border border-gray-200 rounded-xl overflow-hidden">
            <div ref={receiptRef} className="p-10 bg-white print:p-0">
              
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
              
              <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{trip.trip_start_date || '-'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-base">{trip.vehicle_number}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{trip.source_city} → {trip.destination_city}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Delivery Date:</span> <span className="font-bold">{trip.actual_delivery_date || 'Pending'}</span></div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{trip.party_name || 'N/A'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Owner Name:</span> <span className="font-bold">{trip.owner_name || 'N/A'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{trip.gta_name || 'N/A'}</span></div>
                    <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{trip.lr_no || 'N/A'}</span></div>
                  </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-8 grid grid-cols-4 gap-4 text-xs">
                  <div>
                      <span className="text-gray-500 font-semibold block">POD STATUS</span>
                      <span className="font-bold text-slate-800 text-sm">{trip.pod_status || 'Pending'}</span>
                  </div>
                  <div>
                      <span className="text-gray-500 font-semibold block">OFFICE ARRIVAL</span>
                      <span className="font-bold text-slate-800 text-sm">{trip.pod_arrived_office_date || '-'}</span>
                  </div>
                  <div>
                      <span className="text-gray-500 font-semibold block">FORWARDED TO PARTY</span>
                      <span className="font-bold text-slate-800 text-sm">{trip.pod_forwarded_client_date || '-'}</span>
                  </div>
                  <div>
                      <span className="text-gray-500 font-semibold block">PARTY RECEIVED</span>
                      <span className="font-bold text-emerald-700 text-sm">{trip.pod_received_client_date || '-'}</span>
                  </div>
              </div>

              {trip.bank_account && (
                <div className="mb-6 flex justify-between border-b pb-2 text-sm">
                   <span className="text-gray-500 font-bold uppercase tracking-wider">Deposit Bank Account</span> 
                   <span className="font-bold text-blue-700">{trip.bank_account}</span>
                </div>
              )}

              <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  
                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                        <span className="text-sm font-semibold text-gray-700">Total Freight (₹)</span>
                        <span className="font-bold w-32 text-right text-slate-800">{trip.freight_amount || 0}</span>
                      </div>
                      {parseFloat(trip.loading_charge || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <span className="text-sm font-semibold text-gray-700">Loading/Unloading (₹)</span>
                          <span className="font-bold w-32 text-right text-slate-800">{trip.loading_charge}</span>
                        </div>
                      )}
                      {parseFloat(trip.holding_charge || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <span className="text-sm font-semibold text-gray-700">Holding Charge (₹)</span>
                          <span className="font-bold w-32 text-right text-slate-800">{trip.holding_charge}</span>
                        </div>
                      )}
                      {parseFloat(trip.gst || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <span className="text-sm font-bold text-gray-900">GST (18%) (₹)</span>
                          <span className="font-bold w-32 text-right text-emerald-600">{trip.gst}</span>
                        </div>
                      )}
                  </div>

                  <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions (-)</h4>
                      
                      <div className="border-b border-gray-100 pb-2 mb-2">
                          <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-semibold text-gray-700">Advance Received</span>
                          </div>
                          {advances.map((adv, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1 gap-2 text-sm">
                                  <span className="text-gray-500 w-[110px]">{adv.date || '-'}</span>
                                  <span className="w-[100px] text-right font-bold text-rose-600">₹{adv.amount || 0}</span>
                              </div>
                          ))}
                          {advances.length === 0 && <span className="text-xs text-gray-400 italic">No advances logged</span>}
                      </div>

                      {parseFloat(trip.tds || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2 mt-2">
                          <span className="text-sm font-semibold text-gray-700">TDS (₹)</span>
                          <span className="w-[100px] text-right font-bold text-rose-600">{trip.tds}</span>
                        </div>
                      )}
                      {parseFloat(trip.extra_deduction || 0) > 0 && (
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mt-2">
                          <span className="text-sm font-semibold text-gray-700">Extra Deduction</span>
                          <span className="w-[100px] text-right font-bold text-rose-600">{trip.extra_deduction}</span>
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

              {/* 🌟 OPERATIONAL TRACKING INJECTION */}
              <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Operational Tracking (Internal)</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 print:p-0 print:border-none">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Diesel & Fastag (Estimates)</h4>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                        <span className="text-sm font-semibold text-gray-700">Total KM Traveled</span>
                        <span className="font-bold text-slate-700">{km} KM</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                        <span className="text-sm font-semibold text-gray-700">Diesel Required (Est)</span>
                        <span className="font-bold text-slate-900">{displayDiesel} Liters</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-sm font-semibold text-gray-700">Fastag (Est @ ₹5.75/km)</span>
                        <span className="font-bold text-slate-900">₹{parseFloat(displayFastagEst).toFixed(2)}</span>
                      </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 print:p-0 print:border-none">
                      <div className="flex justify-between items-center mb-3">
                          <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Actual Fastag Logs</h4>
                      </div>
                      {parsedFastag.map((f, idx) => (
                          <div key={idx} className="flex justify-between items-center mb-1.5 gap-2 text-sm">
                             <span className="text-gray-500 w-[95px]">{f.date || '-'}</span>
                             <span className="text-gray-700 flex-1">{f.place || 'Unknown Location'}</span>
                             <span className="font-bold text-rose-600">₹{f.amount || 0}</span>
                          </div>
                      ))}
                      {parsedFastag.length === 0 && <span className="text-xs text-gray-400 italic">No toll logs added</span>}
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-300">
                         <span className="text-sm font-extrabold text-amber-900">Total Actual Fastag</span>
                         <span className="font-extrabold text-rose-600">₹{totalFastagActual}</span>
                      </div>
                  </div>
              </div>

              <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Driver Settlement (Hisaab)</h3>
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0 text-sm">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-semibold text-gray-700">Driver Advance (₹3.5/km)</span>
                    <span className="font-bold text-slate-900">₹{trip.driver_advance || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span>
                    <span className="font-bold text-slate-900">₹{trip.driver_remaining || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2 col-span-2 bg-blue-100 p-2 rounded print:bg-transparent print:p-0">
                    <span className="font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span>
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