import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search, FileText, Receipt, PlusCircle, X, Save } from 'lucide-react';
import ActivityLog from '../utils/ActivityLog';

const API_BASE = import.meta.env.VITE_API_URL;
const PRESET_BANKS = ['JTA 0706', 'JTA 0611', 'JFC 7734', 'JFC 1487'];

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

  // --- EDITABLE FINANCE STATE ---
  const [activeCharges, setActiveCharges] = useState({ loading: false, holding: false, gst: false, bill_no: false });
  const [finance, setFinance] = useState({ 
    freight_amount: 0, tds: 0, finance_remarks: '', loading_charge: 0, gst: 0, holding_charge: 0, extra_deduction: 0,
    total_km: 0, driver_advance: 0, driver_remaining: 0, driver_total: 0, diesel_liters_needed: 0, fastag_estimate: 0,
    advance_details: [{ date: '', amount: '' }], fastag_details: [], bill_no: '', bank_account: 'JFC 7734', 
    gst_enabled: false, include_loading_in_gst: false, include_holding_in_gst: false
  });

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

      const parsedAdvances = tripData.advance_details ? (typeof tripData.advance_details === 'string' ? JSON.parse(tripData.advance_details) : tripData.advance_details) : [];
      const parsedFastag = tripData.fastag_details ? (typeof tripData.fastag_details === 'string' ? JSON.parse(tripData.fastag_details) : tripData.fastag_details) : [];
      
      const km = parseFloat(tripData.total_km) || 0;
      const mileage = parseFloat(tripData.mileage) || 5.5;
      
      const currentOwner = tripData.owner_name?.toUpperCase() || '';

      setFinance({
        freight_amount: tripData.freight_amount || 0, loading_charge: tripData.loading_charge || 0, gst: tripData.gst || 0, holding_charge: tripData.holding_charge || 0,
        tds: tripData.tds || 0, extra_deduction: tripData.extra_deduction || 0, finance_remarks: tripData.finance_remarks || '',
        total_km: km, driver_advance: tripData.driver_advance || 0, driver_remaining: tripData.driver_remaining || 0, driver_total: tripData.driver_total || 0,
        diesel_liters_needed: parseFloat(tripData.diesel_liters_needed) || (km > 0 ? (km / mileage).toFixed(2) : 0), 
        fastag_estimate: parseFloat(tripData.fastag_estimate) || (km > 0 ? km * 5.75 : 0),
        advance_details: parsedAdvances.length > 0 ? parsedAdvances : [{ date: '', amount: '' }], fastag_details: parsedFastag,
        bill_no: tripData.bill_no || '', bank_account: tripData.bank_account || (['JTA', 'JTA(A)'].includes(currentOwner) ? 'JTA 0706' : 'JFC 7734'), 
        gst_enabled: Boolean(tripData.gst_enabled), include_loading_in_gst: Boolean(tripData.include_loading_in_gst), include_holding_in_gst: Boolean(tripData.include_holding_in_gst)
      });

      setActiveCharges({ loading: parseFloat(tripData.loading_charge || 0) > 0, holding: parseFloat(tripData.holding_charge || 0) > 0, gst: Boolean(tripData.gst_enabled), bill_no: !!tripData.bill_no });

    } catch (err) {
      alert("Trip not found. Please check the tracking number.");
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFinanceChange = (field, value, customActiveCharges = activeCharges, customFinance = finance) => {
    let newFinance = { ...customFinance };
    if (field !== 'TOGGLE_ACTIVE') newFinance[field] = value;
    if (['freight_amount', 'loading_charge', 'holding_charge', 'gst_enabled', 'include_loading_in_gst', 'include_holding_in_gst', 'TOGGLE_ACTIVE'].includes(field)) {
        const freight = parseFloat(newFinance.freight_amount || 0); 
        const loading = customActiveCharges.loading ? parseFloat(newFinance.loading_charge || 0) : 0; 
        const holding = customActiveCharges.holding ? parseFloat(newFinance.holding_charge || 0) : 0;
        newFinance.gst = newFinance.gst_enabled ? ((freight + (newFinance.include_loading_in_gst ? loading : 0) + (newFinance.include_holding_in_gst ? holding : 0)) * 0.18).toFixed(2) : 0.00;
    }
    setFinance(newFinance);
  };

  const toggleCharge = (chargeName) => {
    const newActive = { ...activeCharges, [chargeName]: !activeCharges[chargeName] };
    setActiveCharges(newActive); handleFinanceChange('TOGGLE_ACTIVE', null, newActive, finance);
  };

  const handleArrayChange = (arrayName, index, field, value) => {
    const newArr = [...finance[arrayName]];
    newArr[index] = { ...newArr[index], [field]: value };
    setFinance({ ...finance, [arrayName]: newArr });
  };
  const addArrayRow = (arrayName, emptyObj) => setFinance({ ...finance, [arrayName]: [...finance[arrayName], emptyObj] });
  const removeArrayRow = (arrayName, index) => setFinance({ ...finance, [arrayName]: finance[arrayName].filter((_, i) => i !== index) });

  const calculatePending = () => {
    const loading = activeCharges.loading ? parseFloat(finance.loading_charge || 0) : 0; 
    const holding = activeCharges.holding ? parseFloat(finance.holding_charge || 0) : 0; 
    const gst = finance.gst_enabled ? parseFloat(finance.gst || 0) : 0;
    const totalAdv = finance.advance_details.reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);
    return ((parseFloat(finance.freight_amount || 0) + loading + gst + holding) - (totalAdv + parseFloat(finance.tds || 0) + parseFloat(finance.extra_deduction || 0))).toFixed(2);
  };

  const handleKmChange = (e) => {
    const km = parseFloat(e.target.value) || 0;
    const mileage = parseFloat(trip?.mileage) || 5.5; 
    setFinance({ ...finance, total_km: km, driver_advance: km * 3.5, driver_remaining: km * 1.0, driver_total: km * 4.5, fastag_estimate: km * 5.75, diesel_liters_needed: km > 0 ? (km / mileage).toFixed(2) : 0 });
  };

  const handleSaveFinance = async () => {
    try {
      await axios.post(`${API_BASE}/finances/calculate`, { ...finance, loading_charge: activeCharges.loading ? finance.loading_charge : 0, holding_charge: activeCharges.holding ? finance.holding_charge : 0, gst: finance.gst_enabled ? finance.gst : 0, bill_no: activeCharges.bill_no ? finance.bill_no : '', trip_id: trip.trip_id });
      alert("Ledger Saved & Logged!"); 
    } catch (err) {
      alert("Error saving finance data.");
    }
  };

  const isCustomBank = finance.bank_account === '' || !PRESET_BANKS.includes(finance.bank_account);
  const totalFastagActual = finance.fastag_details.reduce((s, f) => s + parseFloat(f.amount || 0), 0);
  
  const freight = parseFloat(finance.freight_amount || 0);
  const unloading = activeCharges.loading ? parseFloat(finance.loading_charge || 0) : 0; 
  const holding = activeCharges.holding ? parseFloat(finance.holding_charge || 0) : 0;
  
  const exactBillTotalFreight = freight + unloading; // Holding excluded from Bill PDF
  const gstAmount = parseFloat(finance.gst || 0);
  const gstHalf = (gstAmount / 2).toFixed(2);
  const isIGST = trip?.source_city?.toLowerCase() !== trip?.destination_city?.toLowerCase(); 
  const isGstEnabled = finance.gst_enabled;

  const finalTotalAmount = exactBillTotalFreight + gstAmount;
  const totalAdvances = finance.advance_details.reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);
  const finalBalancePayable = finalTotalAmount - totalAdvances;

  // 🌟 FULLY AUTOMATIC COMPANY DETECTION LOGIC 🌟
  const currentOwner = trip?.owner_name?.toUpperCase() || '';
  const isJFC = currentOwner === 'JFC'; // Auto logic based on owner_name
  const activeCompanyCode = isJFC ? 'JFC' : 'JTA';

  const companyDetails = {
      JTA: { name: "JAIPUR TRANSPORT AGENCY", address: "K-13 GRAM ASARPUR, GOPALPURA BY PASS\nNARAYAN VIHAR, JAIPUR-302026", gst: "08AEOPJ8154L2ZT", pan: "AEOPJ8154L", email: "rohit_jain_2006@yahoo.com", phone: "9351925015, 9314111968" },
      JFC: { name: "JAIN FREIGHT CARRIER", address: "K-13 GRAM ASARPUR, GOPALPURA BY PASS\nNARAYAN VIHAR, JAIPUR-302026", gst: "08AEOPJ8154L2ZT", pan: "AEOPJ8154L", email: "rohit_jain_2006@yahoo.com", phone: "9351925015, 9314111968" }
  };
  const currentComp = companyDetails[activeCompanyCode];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      
      <div className="print:hidden bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Finance & Billing</h2>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            className="border border-gray-300 p-3.5 rounded-xl flex-1 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-100 outline-none font-semibold text-slate-700 transition"
            list="all-trip-numbers"
            placeholder="Search Tracking Number (e.g., RJ14GQ2301...)"
            value={trackingNumber}
            onChange={e => setTrackingNumber(e.target.value)}
          />
          <datalist id="all-trip-numbers">
            {allTrips.map(t => <option key={t.trip_id} value={t.tracking_number} />)}
          </datalist>
          <button onClick={handleSearch} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap">
            {loading ? 'Loading...' : <><Search className="h-5 w-5"/> Load Trip</>}
          </button>
        </div>
      </div>

      {trip && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          <div className="print:hidden bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="bg-slate-50 px-4 py-2 rounded-lg border border-gray-200 w-full md:w-auto text-center md:text-left">
                <span className="text-xs text-gray-500 font-bold block uppercase tracking-wider">Loaded Entry</span>
                <span className="font-bold text-slate-800 break-all">{trip.tracking_number}</span>
             </div>
             
             <div className="flex items-center gap-2 w-full md:w-auto bg-gray-100 p-1 rounded-xl">
                 <button onClick={() => setViewType('receipt')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-bold transition cursor-pointer ${viewType === 'receipt' ? 'bg-white text-slate-900 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-slate-700'}`}>
                     <Receipt className="h-4 w-4"/> Internal Editable Receipt
                 </button>
                 <button onClick={() => setViewType('bill')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-bold transition cursor-pointer ${viewType === 'bill' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-slate-700'}`}>
                     <FileText className="h-4 w-4"/> View Client Bill
                 </button>
             </div>
          </div>

          {/* Action Row - DYNAMIC AUTO-ASSIGNED COMPANY HEADER */}
          <div className="print:hidden flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                  <label className="font-bold text-gray-600 text-sm hidden sm:block">Billing Company:</label>
                  <div className="bg-gray-100 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-800 border border-gray-200 flex items-center gap-1.5">
                      {currentComp.name}
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ml-1">Auto-Assigned</span>
                  </div>
              </div>

              <button onClick={handlePrint} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer ml-auto">
                <Printer className="h-5 w-5"/> Print Document
              </button>
          </div>

          <div className="bg-white shadow-lg border border-gray-200 rounded-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none print:overflow-visible">
            <div ref={printRef} className="p-8 print:p-0 bg-white">
              
              {/* ========================================= */}
              {/*    INTERNAL EDITABLE RECEIPT VIEW         */}
              {/* ========================================= */}
              {viewType === 'receipt' && (
                <div className="max-w-3xl mx-auto">
                  <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                      <div>
                        {/* 🌟 AUTO ASSIGNED HEADER */}
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">{currentComp.name}</h1>
                        <p className="text-gray-500 mt-1 font-medium text-sm">Logistics & Transportation Services</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2>
                        <p className="text-sm font-semibold text-gray-500 mt-1">TRK: {trip.tracking_number}</p>
                        {activeCharges.bill_no && finance.bill_no && (<p className="text-sm font-bold text-blue-700 mt-1 uppercase tracking-wide">BILL NO: {finance.bill_no}</p>)}
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

                  <div className="print:hidden mb-6 bg-blue-50 p-3 rounded-lg border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                     <label className="text-xs font-bold text-blue-900 uppercase whitespace-nowrap">Select Deposit Bank Account:</label>
                     <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                         <select className="border border-blue-200 bg-white p-2 rounded-lg text-sm font-bold text-blue-800 outline-none cursor-pointer flex-1" value={isCustomBank ? 'Other' : finance.bank_account} onChange={e => setFinance({...finance, bank_account: e.target.value === 'Other' ? '' : e.target.value})}>
                            {PRESET_BANKS.map(bank => <option key={bank} value={bank}>{bank}</option>)}
                            <option value="Other">Other (Custom)</option>
                         </select>
                         {isCustomBank && <input type="text" placeholder="Custom bank..." className="border border-blue-300 p-2 rounded-lg text-sm font-bold text-blue-900 w-full sm:w-48" value={finance.bank_account} onChange={e => setFinance({...finance, bank_account: e.target.value})} />}
                     </div>
                  </div>

                  <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                      
                      {/* Left Column: Additions */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Total Freight (₹)</span><input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.freight_amount || ''} onChange={e => handleFinanceChange('freight_amount', e.target.value)} /></div>
                        
                        <div className="border-b border-gray-100 pb-2 mb-2">
                          <div className="flex justify-between items-center"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.loading} onChange={() => toggleCharge('loading')} className="rounded print:hidden" /> Loading/Unloading</label>{activeCharges.loading ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.loading_charge} onChange={e => handleFinanceChange('loading_charge', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                          {activeCharges.loading && <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 print:hidden pl-5"><input type="checkbox" checked={finance.include_loading_in_gst} onChange={e => handleFinanceChange('include_loading_in_gst', e.target.checked)} className="rounded" /> Include in GST</label>}
                        </div>

                        <div className="border-b border-gray-100 pb-2 mb-2">
                          <div className="flex justify-between items-center"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.holding} onChange={() => toggleCharge('holding')} className="rounded print:hidden" /> Holding Charge</label>{activeCharges.holding ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.holding_charge} onChange={e => handleFinanceChange('holding_charge', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                          {activeCharges.holding && <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 print:hidden pl-5"><input type="checkbox" checked={finance.include_holding_in_gst} onChange={e => handleFinanceChange('include_holding_in_gst', e.target.checked)} className="rounded" /> Include in GST</label>}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2 bg-slate-50/50 print:bg-transparent px-1 rounded"><label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer"><input type="checkbox" checked={finance.gst_enabled} onChange={e => handleFinanceChange('gst_enabled', e.target.checked)} className="rounded text-emerald-600 print:hidden" /> GST (18%)</label>{finance.gst_enabled ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent text-emerald-600" type="number" value={finance.gst} onChange={e => handleFinanceChange('gst', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Unchecked</span>}</div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.bill_no} onChange={() => toggleCharge('bill_no')} className="rounded print:hidden" /> Bill Number</label>{activeCharges.bill_no ? <input className="border p-1.5 rounded w-32 font-bold text-blue-700 print:hidden" type="text" value={finance.bill_no} onChange={e => handleFinanceChange('bill_no', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                      </div>

                      {/* Right Column: Deductions */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions (-)</h4>
                        <div className="border-b border-gray-100 pb-2 mb-2">
                           <div className="flex justify-between items-center mb-2"><label className="text-sm font-semibold text-gray-700 flex items-center gap-2">Advance Received <button onClick={() => addArrayRow('advance_details', {date:'', amount:''})} className="flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs print:hidden font-bold"><PlusCircle className="h-3 w-3" /> Add</button></label></div>
                           {finance.advance_details.map((adv, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1 gap-2 text-sm">
                                 <input type="date" className="border p-1 rounded text-xs text-gray-500 w-[110px]" value={adv.date} onChange={e => handleArrayChange('advance_details', idx, 'date', e.target.value)} />
                                 <div className="flex items-center gap-1"><input type="number" className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600" value={adv.amount || ''} onChange={e => handleArrayChange('advance_details', idx, 'amount', e.target.value)} placeholder="₹" />{idx > 0 && <button onClick={() => removeArrayRow('advance_details', idx)} className="text-rose-400 print:hidden p-1"><X className="h-4 w-4"/></button>}</div>
                              </div>
                           ))}
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><label className="text-sm font-semibold text-gray-700">TDS (₹)</label><input className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600" type="number" value={finance.tds || ''} onChange={e => handleFinanceChange('tds', e.target.value)} /></div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2"><input className="text-sm font-semibold text-gray-700 border-b border-dashed w-32 bg-transparent outline-none" placeholder="Extra Deduction..." /><input className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600" type="number" value={finance.extra_deduction || ''} onChange={e => handleFinanceChange('extra_deduction', e.target.value)} /></div>
                      </div>
                      
                      {/* Total Bar */}
                      <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30"><span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span><span className="font-extrabold text-2xl text-emerald-600">₹{calculatePending()}</span></div>
                  </div>

                  {/* Operational Tracking */}
                  <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Operational Tracking (Internal)</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 print:p-0 print:border-none">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Diesel & Fastag (Estimates)</h4>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2"><label className="text-sm font-semibold text-gray-700">Total KM Traveled</label><input className="border p-1.5 rounded w-24 text-right font-bold text-slate-700 print:border-none" type="number" value={finance.total_km || ''} onChange={handleKmChange} /></div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Diesel Required (Est)</span><span className="font-bold text-slate-900">{finance.diesel_liters_needed || 0} Liters</span></div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="text-sm font-semibold text-gray-700">Fastag (Est @ ₹5.75/km)</span><span className="font-bold text-slate-900">₹{(finance.fastag_estimate || 0).toFixed(2)}</span></div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 print:p-0 print:border-none">
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Actual Fastag Logs</h4>
                              <button onClick={() => addArrayRow('fastag_details', {date:'', place:'', amount:''})} className="flex items-center gap-1 text-amber-700 bg-amber-200/50 px-2 py-0.5 rounded text-xs print:hidden font-bold"><PlusCircle className="h-3 w-3" /> Add Toll</button>
                          </div>
                          {finance.fastag_details.map((f, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1.5 gap-2 text-sm">
                                 <input type="date" className="border border-amber-200 p-1 rounded text-[10px] text-gray-700 w-[95px] print:border-none" value={f.date || ''} onChange={e => handleArrayChange('fastag_details', idx, 'date', e.target.value)} />
                                 <input type="text" placeholder="Location (Opt)..." className="border border-amber-200 p-1 rounded text-xs w-[100px] print:border-none" value={f.place || ''} onChange={e => handleArrayChange('fastag_details', idx, 'place', e.target.value)} />
                                 <div className="flex items-center gap-1"><input type="number" className="border border-amber-200 p-1.5 rounded w-[70px] text-right font-bold text-rose-600 print:border-none print:p-0" value={f.amount || ''} onChange={e => handleArrayChange('fastag_details', idx, 'amount', e.target.value)} placeholder="₹" /><button onClick={() => removeArrayRow('fastag_details', idx)} className="text-rose-400 print:hidden p-0.5"><X className="h-4 w-4"/></button></div>
                              </div>
                          ))}
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-300">
                             <span className="text-sm font-extrabold text-amber-900">Total Actual Fastag</span>
                             <span className="font-extrabold text-rose-600">₹{totalFastagActual}</span>
                          </div>
                      </div>
                  </div>

                  <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Driver Settlement (Hisaab)</h3>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0 text-sm">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Driver Advance (₹3.5/km)</span><span className="font-bold text-slate-900">₹{finance.driver_advance || 0}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span><span className="font-bold text-slate-900">₹{finance.driver_remaining || 0}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2 col-span-2 bg-blue-100 p-2 rounded"><span className="font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span><span className="font-extrabold text-slate-700">₹{finance.driver_total || 0}</span></div>
                  </div>
                  
                  <div className="hidden print:flex justify-between mt-20 pt-8">
                      <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Receiver's Signature</div>
                      <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
                  </div>

                  {/* SAVE BUTTON FOR EDITS */}
                  <div className="print:hidden p-5 mt-6 border-t border-gray-200 flex justify-end gap-4">
                     <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-bold transition cursor-pointer"><Printer className="h-5 w-5"/> Print Receipt</button>
                     <button onClick={handleSaveFinance} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-sm transition cursor-pointer"><Save className="h-5 w-5"/> Save Financial Ledger</button>
                  </div>
                </div>
              )}

              {/* ========================================= */}
              {/*         EXACT MATCH BILL VIEW             */}
              {/* ========================================= */}
              {viewType === 'bill' && (
                  <div className="max-w-[800px] mx-auto text-black font-sans leading-snug">
                      
                      {/* HEADER SECTION */}
                      <div className="text-center mb-2">
                          <h1 className="text-3xl font-extrabold text-black tracking-widest leading-none mb-1">
                              {currentComp.name}
                          </h1>
                          <p className="text-[13px] font-bold whitespace-pre-line leading-tight">
                              {currentComp.address}
                          </p>
                          <div className="flex justify-center gap-6 mt-1 text-[12px] font-bold">
                              <span>GST NO.: {currentComp.gst}</span>
                              <span>PAN No.: {currentComp.pan}</span>
                          </div>
                          <p className="text-[11px] font-bold mt-1">
                              Email: {currentComp.email}, Mob. {currentComp.phone}
                          </p>
                      </div>

                      {/* BILL INFO BOX */}
                      <div className="border border-black flex justify-between">
                          <div className="w-[60%] border-r border-black p-2 text-[12px]">
                              <p className="font-bold">TO,</p>
                              <p className="font-bold mt-1">{trip.party_name?.toUpperCase() || 'VELINK INDIA PVT. LTD.'}</p>
                              <p className="font-bold">{(trip.destination_city || 'RAIPUR').toUpperCase()}, RAJ.</p>
                              <p className="font-bold mt-2">GST:- {trip.party_gst || '08AAGCV0492E1ZB'}</p>
                              <p className="font-bold">STATE: RAJASTHAN / STATE CODE: 08</p>
                          </div>
                          <div className="w-[40%] text-[13px] font-bold">
                              <div className="border-b border-black p-2 flex justify-between">
                                  <span>Invoice No.:</span>
                                  <span>{finance.bill_no || 'JTA/26-27/---'}</span>
                              </div>
                              <div className="p-2 flex justify-between">
                                  <span>Date:</span>
                                  <span>{trip.trip_start_date || '05/08/2026'}</span>
                              </div>
                          </div>
                      </div>
                      
                      {/* REVERSE CHARGE BANNER */}
                      <div className="border-x border-b border-black p-1 text-center text-[12px] font-bold">
                          GST PAYABLE UNDER REVERSE CHARGES - YES/NO
                      </div>

                      {/* MAIN TABLE */}
                      <table className="w-full table-fixed border-collapse border border-black text-[11px] font-bold text-center mt-[-1px]">
                          <thead>
                              <tr>
                                  <th className="border border-black p-1 w-[9%]">LOADING<br/>DATE</th>
                                  <th className="border border-black p-1 w-[8%]">LR.NO.</th>
                                  <th className="border border-black p-1 w-[12%]">VEHICLE<br/>NO.</th>
                                  <th className="border border-black p-1 w-[15%]">FROM</th>
                                  <th className="border border-black p-1 w-[20%]">TO</th>
                                  <th className="border border-black p-1 w-[6%]">WEIGHT</th>
                                  <th className="border border-black p-1 w-[6%]">RATE</th>
                                  <th className="border border-black p-1 w-[10%]">FREIGHT</th>
                                  <th className="border border-black p-1 w-[11%]">UNLOADING<br/>CHARGES</th>
                                  <th className="border border-black p-1 w-[12%]">TOTAL<br/>FREIGHT</th>
                              </tr>
                          </thead>
                          <tbody>
                              {/* Row 1: Main Data */}
                              <tr>
                                  <td className="border-r border-black p-1 align-top pt-2 h-16">{trip.trip_start_date || '05/08/2026'}</td>
                                  <td className="border-r border-black p-1 align-top pt-2">{trip.lr_no || '---'}</td>
                                  <td className="border-r border-black p-1 align-top pt-2">{trip.vehicle_number}</td>
                                  <td className="border-r border-black p-1 align-top pt-2 uppercase break-words">{trip.source_city}</td>
                                  <td className="border-r border-black p-1 align-top pt-2 uppercase break-words">{trip.destination_city}</td>
                                  <td className="border-r border-black p-1 align-top pt-2"></td>
                                  <td className="border-r border-black p-1 align-top pt-2"></td>
                                  <td className="border-r border-black p-1 align-top pt-2 text-right pr-2">{freight.toFixed(2)}</td>
                                  <td className="border-r border-black p-1 align-top pt-2 text-right pr-2">{unloading > 0 ? unloading.toFixed(2) : ''}</td>
                                  <td className="p-1 align-top pt-2 text-right pr-2">{exactBillTotalFreight.toFixed(2)}</td>
                              </tr>
                              
                              {/* Row 2: Totals / Tax Layout */}
                              <tr className="border-t border-black">
                                  <td colSpan="7" rowSpan="7" className="border-r border-black p-2 align-bottom text-left uppercase text-[12px]">
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
                              {/* Final Balance Row */}
                              <tr className="border-t border-black">
                                  <td colSpan="7" className="border-r border-black p-0 text-left align-top">
                                      <div className="bg-black text-white text-center py-0.5 text-[11px]">BANK DETAILS</div>
                                      <div className="flex text-[10px]">
                                          <div className="w-1/2 p-1 border-r border-black">
                                              A/C NO. <br/>510605010060611<br/>
                                              IFSC CODE: UBIN0551066<br/>
                                              BRANCH: SSI, JAIPUR<br/>
                                              UNION BANK OF INDIA
                                          </div>
                                          <div className="w-1/2 p-1">
                                              A/C NO. <br/>756001010050706<br/>
                                              IFSC CODE: UBIN0575607<br/>
                                              BRANCH: NEW SANGANER ROAD<br/>
                                              UNION BANK OF INDIA
                                          </div>
                                      </div>
                                  </td>
                                  <td colSpan="2" className="border-r border-black p-1 text-left pl-2 text-[12px]">BALANCE</td>
                                  <td className="p-1 text-right pr-2 text-[12px]">{finalBalancePayable.toFixed(2)}</td>
                              </tr>
                          </tbody>
                      </table>

                      {/* SIGNATURE SECTION */}
                      <div className="flex justify-end mt-12 pr-4 text-[12px] font-bold">
                          <div className="text-center">
                              <p className="mb-8">For {currentComp.name}</p>
                              <p>Auth. Signatory</p>
                          </div>
                      </div>

                  </div>
              )}

            </div>
          </div>
        </div>
      )}
      
      {/* 🌟 GLOBAL ACTIVITY LOG RENDERED AT THE BOTTOM */}
      <div className="print:hidden">
          <ActivityLog />
      </div>

    </div>
  );
}

export default Finance;