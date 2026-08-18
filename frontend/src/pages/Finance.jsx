import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search, FileText, Receipt, Loader2 } from 'lucide-react';
import ActivityLog from '../utils/ActivityLog'; 

const API_BASE = import.meta.env.VITE_API_URL;

function numberToWords(num) {
    if (!num || isNaN(num) || num === 0) return "ZERO ONLY";
    const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
    const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return;
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'CRORE ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'LAKH ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'THOUSAND ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'HUNDRED ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'AND ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'ONLY' : 'ONLY';
    return str;
}

function Finance() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [allTrips, setAllTrips] = useState([]);
  
  const [viewType, setViewType] = useState('receipt'); 
  const [localInvoiceNo, setLocalInvoiceNo] = useState('');

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

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
      const tripData = res.data.trip || res.data;
      setTrip(tripData);
      setLocalInvoiceNo(tripData.bill_no || '');
    } catch (err) {
      alert("Trip not found. Please check the tracking number.");
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  const advances = trip?.advance_details ? (typeof trip.advance_details === 'string' ? JSON.parse(trip.advance_details) : trip.advance_details) : [];
  const parsedFastag = trip?.fastag_details ? (typeof trip.fastag_details === 'string' ? JSON.parse(trip.fastag_details) : trip.fastag_details) : [];

  const km = parseFloat(trip?.total_km) || 0;
  const mileage = parseFloat(trip?.mileage) || 5.5;

  const displayDiesel = parseFloat(trip?.diesel_liters_needed) || (km > 0 ? (km / mileage).toFixed(2) : 0);
  const displayFastagEst = parseFloat(trip?.fastag_estimate) || (km > 0 ? km * 5.75 : 0);
  const totalFastagActual = parsedFastag.reduce((s, f) => s + parseFloat(f.amount || 0), 0);
  
  const freight = parseFloat(trip?.freight_amount || 0);
  const loadingCharge = parseFloat(trip?.loading_charge || 0);
  const holdingCharge = parseFloat(trip?.holding_charge || 0);
  const gstAmount = parseFloat(trip?.gst || 0);
  const tds = parseFloat(trip?.tds || 0);
  const extraDeduction = parseFloat(trip?.extra_deduction || 0);
  
  const totalAdvances = advances.reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);
  const balancePayment = parseFloat(trip?.balance_payment || 0);

  const exactBillTotalFreight = freight + loadingCharge + holdingCharge; 
  const finalTotalAmount = exactBillTotalFreight + gstAmount;
  const finalBalancePayable = finalTotalAmount - totalAdvances; 
  const gstHalf = (gstAmount / 2).toFixed(2);
  const isIGST = trip?.source_city?.toLowerCase() !== trip?.destination_city?.toLowerCase(); 
  const isGstEnabled = Boolean(trip?.gst_enabled);

  const currentOwner = trip?.owner_name?.toUpperCase() || '';
  const isJFC = currentOwner === 'JFC'; 
  const activeCompanyCode = isJFC ? 'JFC' : 'JTA';

  const companyDetails = {
      JTA: { name: "JAIPUR TRANSPORT AGENCY", address: "K-13 GRAM ASARPUR, GOPALPURA BY PASS\nNARAYAN VIHAR, JAIPUR-302026", gst: "08AEOPJ8154L2ZT", pan: "AEOPJ8154L", email: "rohit_jain_2006@yahoo.com", phone: "9351925015, 9314111968" },
      JFC: { name: "JAIN FREIGHT CARRIER", address: "K-13 GRAM ASARPUR, GOPALPURA BY PASS\nNARAYAN VIHAR, JAIPUR-302026", gst: "08AEOPJ8154L2ZT", pan: "AEOPJ8154L", email: "rohit_jain_2006@yahoo.com", phone: "9351925015, 9314111968" }
  };
  const currentComp = companyDetails[activeCompanyCode];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      
      <div className="print:hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Finance & Billing (Read-Only)</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className="border border-gray-300 p-3.5 rounded-xl flex-1 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none font-semibold text-slate-700 transition w-full"
            list="all-trip-numbers"
            placeholder="Search Tracking Number (e.g., RJ14GQ2301...)"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
          />
          <datalist id="all-trip-numbers">
            {allTrips.map(t => <option key={t.trip_id} value={t.tracking_number} />)}
          </datalist>
          <button onClick={handleSearch} disabled={loading} className="w-full md:w-auto shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer">
            {loading ? <Loader2 className="h-5 w-5 animate-spin"/> : <><Search className="h-5 w-5"/> Load Trip</>}
          </button>
        </div>
      </div>

      {trip && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="print:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col lg:flex-row justify-between items-stretch gap-4">
             <div className="bg-slate-50 px-5 py-3 rounded-xl border border-gray-200 w-full lg:flex-1 flex flex-col justify-center">
                <span className="text-xs text-gray-500 font-bold block uppercase tracking-wider mb-1">Loaded Entry</span>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800 break-all text-sm md:text-base leading-tight">
                        {trip.tracking_number}
                    </span>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold border bg-white text-slate-600 border-slate-200 uppercase tracking-wider shadow-sm">
                        Read-Only
                    </span>
                </div>
             </div>
             
             <div className="flex flex-row items-center gap-2 w-full lg:w-auto bg-gray-100 p-1.5 rounded-xl shrink-0 h-full">
                 <button onClick={() => setViewType('receipt')} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 md:py-2 h-full rounded-lg font-bold transition cursor-pointer ${viewType === 'receipt' ? 'bg-white text-slate-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-slate-700'}`}>
                     <Receipt className="h-4 w-4"/> Internal Receipt
                 </button>
                 <button onClick={() => setViewType('bill')} className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 md:py-2 h-full rounded-lg font-bold transition cursor-pointer ${viewType === 'bill' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-slate-700'}`}>
                     <FileText className="h-4 w-4"/> View Client Bill
                 </button>
             </div>
          </div>

          <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200 gap-4">
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                      <label className="font-bold text-gray-600 text-sm">Billing Company:</label>
                      <div className="bg-gray-100 px-3 py-2 rounded-lg text-sm font-bold text-slate-800 border border-gray-200 flex items-center gap-2 flex-wrap">
                          {currentComp.name}
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0">Auto-Assigned</span>
                      </div>
                  </div>

                  {viewType === 'bill' && (
                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                          <label className="font-bold text-blue-900 text-sm whitespace-nowrap">Invoice No:</label>
                          <input 
                              type="text" 
                              placeholder="Leave blank to print empty" 
                              className="bg-white border border-blue-200 rounded px-2 py-1 text-sm font-bold text-blue-900 outline-none focus:border-blue-500 w-48"
                              value={localInvoiceNo}
                              onChange={(e) => setLocalInvoiceNo(e.target.value)}
                          />
                      </div>
                  )}
              </div>

              <button onClick={handlePrint} className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer">
                <Printer className="h-5 w-5"/> Print Document
              </button>
          </div>

          <div className="bg-white shadow-lg border border-gray-200 rounded-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none print:overflow-visible">
            <div ref={printRef} className="p-8 print:p-0 bg-white flex justify-center">
              
              {viewType === 'receipt' && (
                <div className="w-full max-w-3xl">
                  <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                      <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">{currentComp.name}</h1>
                        <p className="text-gray-500 mt-1 font-medium text-sm">Logistics & Transportation Services</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2>
                        <p className="text-sm font-semibold text-gray-500 mt-1">TRK: {trip.tracking_number}</p>
                        {localInvoiceNo && (<p className="text-sm font-bold text-blue-700 mt-1 uppercase tracking-wide">BILL NO: {localInvoiceNo}</p>)}
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
                      <div><span className="text-gray-500 font-semibold block">POD STATUS</span><span className="font-bold text-slate-800 text-sm">{trip.pod_status || 'Pending'}</span></div>
                      <div><span className="text-gray-500 font-semibold block">OFFICE ARRIVAL</span><span className="font-bold text-slate-800 text-sm">{trip.pod_arrived_office_date || '-'}</span></div>
                      <div><span className="text-gray-500 font-semibold block">FORWARDED TO PARTY</span><span className="font-bold text-slate-800 text-sm">{trip.pod_forwarded_client_date || '-'}</span></div>
                      <div><span className="text-gray-500 font-semibold block">PARTY RECEIVED</span><span className="font-bold text-emerald-700 text-sm">{trip.pod_received_client_date || '-'}</span></div>
                  </div>

                  <div className="mb-6 flex justify-between border-b pb-2 text-sm">
                     <span className="text-gray-500 font-bold uppercase tracking-wider">Deposit Bank Account</span> 
                     <span className="font-bold text-blue-700">{trip.bank_account || 'N/A'}</span>
                  </div>

                  <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Total Freight (₹)</span><span className="font-bold text-slate-800">{freight}</span></div>
                        {loadingCharge > 0 && <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Loading/Unloading (₹)</span><span className="font-bold text-slate-800">{loadingCharge}</span></div>}
                        {holdingCharge > 0 && <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Detention Charge (₹)</span><span className="font-bold text-slate-800">{holdingCharge}</span></div>}
                        {gstAmount > 0 && <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-bold text-gray-900">GST (18%) (₹)</span><span className="font-bold text-emerald-600">{gstAmount}</span></div>}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions (-)</h4>
                        <div className="border-b border-gray-100 pb-2 mb-2">
                           <div className="flex justify-between items-center mb-2"><span className="text-sm font-semibold text-gray-700">Advance Received</span></div>
                           {advances.map((adv, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1 gap-2 text-sm">
                                 <span className="text-gray-500 w-[110px]">{adv.date || '-'}</span><span className="font-bold text-rose-600">₹{adv.amount || 0}</span>
                              </div>
                           ))}
                           {advances.length === 0 && <span className="text-xs text-gray-400 italic">No advances logged</span>}
                        </div>
                        {tds > 0 && <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">TDS (₹)</span><span className="font-bold text-rose-600">{tds}</span></div>}
                        {extraDeduction > 0 && <div className="flex justify-between items-center border-b border-gray-100 pb-2"><span className="text-sm font-semibold text-gray-700">Extra Deduction</span><span className="font-bold text-rose-600">{extraDeduction}</span></div>}
                      </div>
                      
                      <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30"><span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span><span className="font-extrabold text-2xl text-emerald-600">₹{balancePayment}</span></div>
                  </div>

                  {trip.finance_remarks && (
                      <div className="mt-4"><span className="block text-xs font-semibold text-gray-500 mb-1">Remarks / Payment Notes:</span><p className="text-sm font-medium text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 print:bg-transparent print:border-0 print:p-0">{trip.finance_remarks}</p></div>
                  )}

                  <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Operational Tracking (Internal)</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 print:p-0 print:border-none">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Diesel & Fastag (Estimates)</h4>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Total KM Traveled</span><span className="font-bold text-slate-700">{km} KM</span></div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Diesel Required (Est)</span><span className="font-bold text-slate-900">{displayDiesel} Liters</span></div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="text-sm font-semibold text-gray-700">Fastag (Est @ ₹5.75/km)</span><span className="font-bold text-slate-900">₹{displayFastagEst.toFixed(2)}</span></div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 print:p-0 print:border-none">
                          <div className="flex justify-between items-center mb-3"><h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Actual Fastag Logs</h4></div>
                          {parsedFastag.map((f, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1.5 gap-2 text-sm">
                                 <span className="text-gray-500 w-[95px]">{f.date || '-'}</span><span className="text-gray-700 flex-1">{f.place || 'Unknown Location'}</span><span className="font-bold text-rose-600">₹{f.amount || 0}</span>
                              </div>
                          ))}
                          {parsedFastag.length === 0 && <span className="text-xs text-gray-400 italic">No toll logs added</span>}
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-300"><span className="text-sm font-extrabold text-amber-900">Total Actual Fastag</span><span className="font-extrabold text-rose-600">₹{totalFastagActual}</span></div>
                      </div>
                  </div>

                  <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Driver Settlement (Hisaab)</h3>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0 text-sm">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Driver Advance (₹3.5/km)</span><span className="font-bold text-slate-900">₹{trip.driver_advance || 0}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span><span className="font-bold text-slate-900">₹{trip.driver_remaining || 0}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2 col-span-2 bg-blue-100 p-2 rounded"><span className="font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span><span className="font-extrabold text-slate-700">₹{trip.driver_total || 0}</span></div>
                  </div>
                  
                  <div className="hidden print:flex justify-between mt-20 pt-8">
                      <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Receiver's Signature</div>
                      <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
                  </div>
                </div>
              )}

              {/* 🌟 FULL WIDTH, NO-OVERLAP CLIENT BILL */}
              {viewType === 'bill' && (
                  <div className="w-full max-w-[900px] text-black font-sans leading-snug mx-auto p-2 print:p-0">
                      
                      <div className="text-center mb-2">
                          <h1 className="text-3xl font-extrabold text-black tracking-widest leading-none mb-1">{currentComp.name}</h1>
                          <p className="text-[13px] font-bold whitespace-pre-line leading-tight">{currentComp.address}</p>
                          <div className="flex justify-center gap-6 mt-1 text-[12px] font-bold"><span>GST NO.: {currentComp.gst}</span><span>PAN No.: {currentComp.pan}</span></div>
                          <p className="text-[11px] font-bold mt-1">Email: {currentComp.email}, Mob. {currentComp.phone}</p>
                      </div>

                      <div className="border border-black flex justify-between">
                          <div className="w-[60%] border-r border-black p-2 text-[12px]">
                              <p className="font-bold">TO,</p>
                              <p className="font-bold mt-1 leading-tight">{trip.party_name?.toUpperCase() || 'VELINK INDIA PVT. LTD.'}</p>
                              <p className="font-bold leading-tight">{(trip.destination_city || 'RAIPUR').toUpperCase()}, RAJ.</p>
                              <p className="font-bold mt-2">GST:- {trip.party_gst || '08AAGCV0492E1ZB'}</p>
                              <p className="font-bold">STATE: RAJASTHAN / STATE CODE: 08</p>
                          </div>
                          <div className="w-[40%] text-[13px] font-bold">
                              <div className="border-b border-black p-2 flex justify-between">
                                  <span>Invoice No.:</span>
                                  <span>{localInvoiceNo}</span>
                              </div>
                              <div className="p-2 flex justify-between">
                                  <span>Date:</span>
                                  <span>{trip.trip_start_date || '05/08/2026'}</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="border-x border-b border-black p-1 text-center text-[12px] font-bold">GST PAYABLE UNDER REVERSE CHARGES - YES/NO</div>

                      {/* 🌟 WIDE 11-COLUMN TABLE WITH NO OVERLAP */}
                      <table className="w-full table-fixed border-collapse border border-black text-[10px] font-bold text-center mt-[-1px]">
                          <thead>
                              <tr>
                                  <th className="border border-black p-1.5 w-[8%] leading-tight">LOADING<br/>DATE</th>
                                  <th className="border border-black p-1.5 w-[6%] leading-tight break-words">LR.NO.</th>
                                  <th className="border border-black p-1.5 w-[11%] leading-tight break-words">VEHICLE<br/>NO.</th>
                                  <th className="border border-black p-1.5 w-[13%] leading-tight break-words">FROM</th>
                                  <th className="border border-black p-1.5 w-[14%] leading-tight break-words">TO</th>
                                  <th className="border border-black p-1.5 w-[5%] leading-tight">WT</th>
                                  <th className="border border-black p-1.5 w-[5%] leading-tight">RATE</th>
                                  <th className="border border-black p-1.5 w-[9%] leading-tight">FREIGHT</th>
                                  <th className="border border-black p-1.5 w-[9%] leading-tight break-words">UNLOADING<br/>CHG</th>
                                  <th className="border border-black p-1.5 w-[9%] leading-tight break-words">DETENTION<br/>CHG</th>
                                  <th className="border border-black p-1.5 w-[11%] leading-tight">TOTAL<br/>FREIGHT</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr>
                                  <td className="border-r border-black p-1.5 align-top pt-2 h-16">{trip.trip_start_date || '05/08/2026'}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2">{trip.lr_no || '---'}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2 break-words">{trip.vehicle_number}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2 uppercase break-words">{trip.source_city}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2 uppercase break-words">{trip.destination_city}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2"></td>
                                  <td className="border-r border-black p-1.5 align-top pt-2"></td>
                                  <td className="border-r border-black p-1.5 align-top pt-2 text-right pr-2">{freight.toFixed(2)}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2 text-right pr-2">{loadingCharge > 0 ? loadingCharge.toFixed(2) : ''}</td>
                                  <td className="border-r border-black p-1.5 align-top pt-2 text-right pr-2">{holdingCharge > 0 ? holdingCharge.toFixed(2) : ''}</td>
                                  <td className="p-1.5 align-top pt-2 text-right pr-2">{exactBillTotalFreight.toFixed(2)}</td>
                              </tr>
                              
                              <tr className="border-t border-black">
                                  <td colSpan="8" rowSpan="7" className="border-r border-black p-2 align-bottom text-left uppercase text-[12px]">
                                      TOTAL INVOICE AMOUNT (IN WORDS):<br/>
                                      {numberToWords(finalBalancePayable)}
                                  </td>
                                  <td colSpan="2" className="border-r border-black p-1 text-left pl-2">TOTAL</td>
                                  <td className="p-1 text-right pr-2">{exactBillTotalFreight.toFixed(2)}</td>
                              </tr>
                              <tr>
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">ADD:SGST</td>
                                  <td className="border-t border-black p-1 text-right pr-2">{(!isIGST && isGstEnabled && gstAmount > 0) ? gstHalf : ''}</td>
                              </tr>
                              <tr>
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">ADD:CGST</td>
                                  <td className="border-t border-black p-1 text-right pr-2">{(!isIGST && isGstEnabled && gstAmount > 0) ? gstHalf : ''}</td>
                              </tr>
                              <tr>
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">ADD:IGST</td>
                                  <td className="border-t border-black p-1 text-right pr-2">{(isIGST && isGstEnabled && gstAmount > 0) ? gstAmount.toFixed(2) : ''}</td>
                              </tr>
                              <tr>
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">TOTAL TAX AMOUNT</td>
                                  <td className="border-t border-black p-1 text-right pr-2">{(isGstEnabled && gstAmount > 0) ? gstAmount.toFixed(2) : ''}</td>
                              </tr>
                              <tr>
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">TOTAL AMOUNT</td>
                                  <td className="border-t border-black p-1 text-right pr-2">{finalTotalAmount.toFixed(2)}</td>
                              </tr>
                              <tr>
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">ADVANCE</td>
                                  <td className="border-t border-black p-1 text-right pr-2">{totalAdvances > 0 ? totalAdvances.toFixed(2) : ''}</td>
                              </tr>
                              <tr className="border-t border-black">
                                  <td colSpan="8" className="border-r border-black p-0 text-left align-top">
                                      <div className="bg-black text-white text-center py-0.5 text-[11px]">BANK DETAILS</div>
                                      <div className="flex text-[10px]">
                                          <div className="w-1/2 p-1 border-r border-black">
                                              A/C NO. <br/>510605010060611<br/>IFSC CODE: UBIN0551066<br/>BRANCH: SSI, JAIPUR<br/>UNION BANK OF INDIA
                                          </div>
                                          <div className="w-1/2 p-1">
                                              A/C NO. <br/>756001010050706<br/>IFSC CODE: UBIN0575607<br/>BRANCH: NEW SANGANER ROAD<br/>UNION BANK OF INDIA
                                          </div>
                                      </div>
                                  </td>
                                  <td colSpan="2" className="border-r border-black p-1 text-left pl-2 text-[12px]">BALANCE</td>
                                  <td className="p-1 text-right pr-2 text-[12px]">{balancePayment.toFixed(2)}</td>
                              </tr>
                          </tbody>
                      </table>

                      <div className="flex justify-end mt-12 pr-4 text-[12px] font-bold">
                          <div className="text-center"><p className="mb-8">For {currentComp.name}</p><p>Auth. Signatory</p></div>
                      </div>
                  </div>
              )}

            </div>
          </div>
        </div>
      )}

      <div className="print:hidden mt-8">
          <ActivityLog />
      </div>

    </div>
  );
}

export default Finance;