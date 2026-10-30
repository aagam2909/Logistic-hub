import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Printer, Search, FileText, Receipt, Loader2, Plus, Trash2, PlusCircle, X, Save } from 'lucide-react';
import ActivityLog from '../utils/ActivityLog'; 
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_URL;
const PRESET_BANKS = ['JTA 0706', 'JTA 0611', 'JFC 7734', 'JFC 1487'];

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const s = String(dateStr).slice(0, 10);
  const parts = s.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : s;
}

function numberToWords(num) {
    const rounded = Math.round(parseFloat(num || 0));
    if (!rounded || isNaN(rounded) || rounded === 0) return "ZERO ONLY";
    const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
    const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    const n = ('000000000' + rounded).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return "ZERO ONLY";
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
  const [localBillDate, setLocalBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billPartyName, setBillPartyName] = useState('');
  const [billPartyGst, setBillPartyGst] = useState('');
  const [billPartyCity, setBillPartyCity] = useState('');
  const [partyList, setPartyList] = useState([]);

  const [activeCharges, setActiveCharges] = useState({ loading: false, holding: false, gst: false, bill_no: false });
  const [finance, setFinance] = useState({ 
    freight_amount: 0, tds: 0, finance_remarks: '', loading_charge: 0, gst: 0, holding_charge: 0, extra_deduction: 0,
    total_km: 0, driver_advance: 0, driver_remaining: 0, driver_total: 0, diesel_liters_needed: 0, fastag_estimate: 0,
    advance_details: [{ date: '', amount: '' }], fastag_details: [], bill_no: '', bank_account: 'JFC 7734', 
    gst_enabled: false, include_loading_in_gst: false, include_holding_in_gst: false
  });

  const [hisaabEntries, setHisaabEntries] = useState([]);
  const [hAmount, setHAmount] = useState('');
  const [hDate, setHDate] = useState(new Date().toISOString().split('T')[0]);
  const [hCategory, setHCategory] = useState('Diesel');
  const [hLiters, setHLiters] = useState('');
  const [hPlace, setHPlace] = useState('');
  const [hReason, setHReason] = useState('');

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({ 
    contentRef: printRef,
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 12mm 10mm 12mm 14mm !important;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .bill-print-container {
          width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          padding: 0 !important;
          margin: 0 !important;
        }
      }
    `
  });

  useEffect(() => {
    axios.get(`${API_BASE}/trips/all`)
      .then(res => setAllTrips(Array.isArray(res.data) ? res.data : []))
      .catch(err => console.error("Error fetching trips:", err));

    axios.get(`${API_BASE}/parties`)
      .then(res => setPartyList(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!trackingNumber.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trackingNumber)}`);
      const tripData = res.data.trip || res.data;
      setTrip(tripData);
      setBillPartyName(tripData.party_name || '');
      setBillPartyGst(tripData.party_gst || '');
      setBillPartyCity(tripData.destination_city ? `${tripData.destination_city.toUpperCase()}, RAJ.` : 'JAIPUR, RAJ.');
      setLocalInvoiceNo(tripData.bill_no || '');
      if(tripData.trip_start_date) setLocalBillDate(tripData.trip_start_date);

      const parsedAdvances = tripData.advance_details ? (typeof tripData.advance_details === 'string' ? JSON.parse(tripData.advance_details) : tripData.advance_details) : [];
      const parsedFastag = tripData.fastag_details ? (typeof tripData.fastag_details === 'string' ? JSON.parse(tripData.fastag_details) : tripData.fastag_details) : [];

      const gstActive = Boolean(tripData.gst_enabled);
      const incLoadingGst = Boolean(tripData.include_loading_in_gst);
      const incHoldingGst = Boolean(tripData.include_holding_in_gst);

      const currentOwner = tripData.owner_name?.toUpperCase() || '';
      const defaultBank = ['JTA', 'JTA(A)'].includes(currentOwner) ? 'JTA 0706' : 'JFC 7734';

      const km = parseFloat(tripData.total_km) || 0;
      const mileage = parseFloat(tripData.mileage) || 5.5;
      const defaultDiesel = km > 0 ? (km / mileage).toFixed(2) : 0;
      const defaultFastag = km > 0 ? (km * 5.75) : 0;

      setFinance({
        freight_amount: tripData.freight_amount || 0, loading_charge: tripData.loading_charge || 0, gst: tripData.gst || 0, holding_charge: tripData.holding_charge || 0,
        tds: tripData.tds || 0, extra_deduction: tripData.extra_deduction || 0, finance_remarks: tripData.finance_remarks || '',
        total_km: km, driver_advance: tripData.driver_advance || 0, driver_remaining: tripData.driver_remaining || 0, driver_total: tripData.driver_total || 0,
        diesel_liters_needed: parseFloat(tripData.diesel_liters_needed) || defaultDiesel, fastag_estimate: parseFloat(tripData.fastag_estimate) || defaultFastag,
        advance_details: parsedAdvances.length > 0 ? parsedAdvances : [{ date: '', amount: '' }], fastag_details: parsedFastag,
        bill_no: tripData.bill_no || '', bank_account: tripData.bank_account || defaultBank, gst_enabled: gstActive, include_loading_in_gst: incLoadingGst, include_holding_in_gst: incHoldingGst
      });
      setActiveCharges({ loading: parseFloat(tripData.loading_charge || 0) > 0, holding: parseFloat(tripData.holding_charge || 0) > 0, gst: Boolean(tripData.gst_enabled), bill_no: !!tripData.bill_no });

      try {
        const hisaabRes = await axios.get(`${API_BASE}/trips/${tripData.trip_id}/driver-hisaab`);
        setHisaabEntries(Array.isArray(hisaabRes.data) ? hisaabRes.data : []);
      } catch (err) { setHisaabEntries([]); }

    } catch (err) {
      alert("Trip not found. Please check the tracking number.");
      setTrip(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddHisaab = async (e) => {
    e.preventDefault();
    if (!trip?.trip_id) return;
    try {
      const payload = { amount: parseFloat(hAmount || 0), date: hDate, category: hCategory, liters: hCategory === 'Diesel' ? parseFloat(hLiters || 0) : 0, place: hPlace, reason: hReason };
      const res = await axios.post(`${API_BASE}/trips/${trip.trip_id}/driver-hisaab`, payload);
      setHisaabEntries(res.data.entries || []);
      setHAmount(''); setHLiters(''); setHPlace(''); setHReason('');
    } catch (err) { alert("Failed to save driver hisaab entry."); }
  };

  const handleDeleteHisaab = async (index) => {
    if (!window.confirm("Remove this entry?")) return;
    try {
      const res = await axios.delete(`${API_BASE}/trips/${trip.trip_id}/driver-hisaab/${index}`);
      setHisaabEntries(res.data.entries || []);
    } catch (err) { alert("Failed to delete entry."); }
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
    if (trip?.amount_cleared) return "0.00";
    const loading = activeCharges.loading ? parseFloat(finance.loading_charge || 0) : 0; 
    const holding = activeCharges.holding ? parseFloat(finance.holding_charge || 0) : 0; 
    const gst = finance.gst_enabled ? parseFloat(finance.gst || 0) : 0;
    const totalAdv = finance.advance_details.reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);
    const tds = parseFloat(finance.tds || 0);
    const extra = parseFloat(finance.extra_deduction || 0);
    const balance = (parseFloat(finance.freight_amount || 0) + loading + gst + holding) - (totalAdv + tds + extra);
    return Math.max(0, balance).toFixed(2);
  };

  const handleKmChange = (e) => {
    const km = parseFloat(e.target.value) || 0;
    const mileage = parseFloat(trip?.mileage) || 5.5; 
    setFinance({ ...finance, total_km: km, driver_advance: km * 3.5, driver_remaining: km * 1.0, driver_total: km * 4.5, fastag_estimate: km * 5.75, diesel_liters_needed: km > 0 ? (km / mileage).toFixed(2) : 0 });
  };

  const handleSaveFinance = async () => {
    try {
      await axios.post(`${API_BASE}/finances/calculate`, { 
        ...finance, 
        loading_charge: activeCharges.loading ? finance.loading_charge : 0, 
        holding_charge: activeCharges.holding ? finance.holding_charge : 0, 
        gst: finance.gst_enabled ? finance.gst : 0, 
        bill_no: activeCharges.bill_no ? finance.bill_no : (finance.bill_no || ''), 
        trip_id: trip.trip_id 
      });
      alert("Ledger Saved!"); 
    } catch (err) { alert("Error saving finance."); }
  };

  // --- FINANCIAL CALCULATIONS & SYNC ---
  const km = parseFloat(finance.total_km) || 0;
  const mileage = parseFloat(trip?.mileage) || 5.5;
  const totalFastagActual = (finance.fastag_details || []).reduce((s, f) => s + parseFloat(f.amount || 0), 0);
  const isCustomBank = finance.bank_account === '' || !PRESET_BANKS.includes(finance.bank_account);

  const freight = parseFloat(finance.freight_amount || 0);
  const loadingCharge = activeCharges.loading ? parseFloat(finance.loading_charge || 0) : 0;
  const holdingCharge = activeCharges.holding ? parseFloat(finance.holding_charge || 0) : 0;
  const gstAmount = parseFloat(finance.gst || 0);
  const totalAdvances = (finance.advance_details || []).reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);
  const tdsAmount = parseFloat(finance.tds || 0);
  const extraDeduction = parseFloat(finance.extra_deduction || 0);

  const exactBillTotalFreight = freight + loadingCharge + holdingCharge; 
  const finalTotalAmount = exactBillTotalFreight + gstAmount;

  // 🌟 ACCURATE BALANCE PAYMENT SYNC
  const rawBalance = finalTotalAmount - (totalAdvances + tdsAmount + extraDeduction);
  const balancePayment = (trip?.amount_cleared || rawBalance <= 0) ? 0.00 : rawBalance;

  const gstHalf = (gstAmount / 2).toFixed(2);
  const isIGST = trip?.source_city?.toLowerCase() !== trip?.destination_city?.toLowerCase(); 
  const isGstEnabled = finance.gst_enabled;
  
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
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Finance & Billing Ledger</h2>
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
          
          <div className="print:hidden flex flex-col lg:flex-row justify-between items-stretch gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
             <div className="bg-slate-50 px-5 py-3 rounded-xl border border-gray-200 w-full lg:flex-1 flex flex-col justify-center">
                <span className="text-xs text-gray-500 font-bold block uppercase tracking-wider mb-1">Loaded Entry</span>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-800 break-all text-sm md:text-base leading-tight">
                        {trip.tracking_number}
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
                      <>
                          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                              <label className="font-bold text-blue-900 text-sm whitespace-nowrap">Invoice No:</label>
                              <input type="text" placeholder="Leave blank" className="bg-white border border-blue-200 rounded px-2 py-1 text-sm font-bold text-blue-900 outline-none focus:border-blue-500 w-28" value={finance.bill_no} onChange={(e) => handleFinanceChange('bill_no', e.target.value)} />
                          </div>
                          <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                              <label className="font-bold text-blue-900 text-sm whitespace-nowrap">Date:</label>
                              <input type="date" className="bg-white border border-blue-200 rounded px-2 py-1 text-sm font-bold text-blue-900 outline-none focus:border-blue-500" value={localBillDate} onChange={(e) => setLocalBillDate(e.target.value)} />
                          </div>
                      </>
                  )}
              </div>

              <div className="flex gap-2">
                  <button onClick={handlePrint} className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition cursor-pointer"><Printer className="h-5 w-5"/> Print</button>
                  <button onClick={handleSaveFinance} className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition cursor-pointer"><Save className="h-5 w-5" /> Save Ledger</button>
              </div>
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
                        {activeCharges.bill_no && finance.bill_no && (<p className="text-sm font-bold text-blue-700 mt-1 uppercase tracking-wide">BILL NO: {finance.bill_no}</p>)}
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{trip.trip_start_date || '-'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-base">{trip.vehicle_number}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{trip.source_city} → {trip.destination_city}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Bank Account:</span> <span className="font-bold text-blue-700">{finance.bank_account || 'N/A'}</span></div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{trip.party_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Owner Name:</span> <span className="font-bold">{trip.owner_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{trip.gta_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{trip.lr_no || 'N/A'}</span></div>
                      </div>
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
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><span className="text-sm font-semibold text-gray-700">Total Freight (₹)</span><input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.freight_amount || ''} onChange={e => handleFinanceChange('freight_amount', e.target.value)} /></div>
                        
                        <div className="border-b border-gray-100 pb-2 mb-2">
                          <div className="flex justify-between items-center"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.loading} onChange={() => toggleCharge('loading')} className="rounded print:hidden" /> Loading/Unloading</label>{activeCharges.loading ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.loading_charge} onChange={e => handleFinanceChange('loading_charge', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                          {activeCharges.loading && <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 print:hidden pl-5"><input type="checkbox" checked={finance.include_loading_in_gst} onChange={e => handleFinanceChange('include_loading_in_gst', e.target.checked)} className="rounded" /> Include in GST</label>}
                        </div>

                        <div className="border-b border-gray-100 pb-2 mb-2">
                          <div className="flex justify-between items-center"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.holding} onChange={() => toggleCharge('holding')} className="rounded print:hidden" /> Rate Difference</label>{activeCharges.holding ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.holding_charge} onChange={e => handleFinanceChange('holding_charge', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                          {activeCharges.holding && <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 print:hidden pl-5"><input type="checkbox" checked={finance.include_holding_in_gst} onChange={e => handleFinanceChange('include_holding_in_gst', e.target.checked)} className="rounded" /> Include in GST</label>}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2 bg-slate-50/50 print:bg-transparent px-1 rounded"><label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer"><input type="checkbox" checked={finance.gst_enabled} onChange={e => handleFinanceChange('gst_enabled', e.target.checked)} className="rounded text-emerald-600 print:hidden" /> GST (18%)</label>{finance.gst_enabled ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent text-emerald-600" type="number" value={finance.gst} onChange={e => handleFinanceChange('gst', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Unchecked</span>}</div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.bill_no} onChange={() => toggleCharge('bill_no')} className="rounded print:hidden" /> Bill Number</label>{activeCharges.bill_no ? <input className="border p-1.5 rounded w-32 font-bold text-blue-700 print:hidden" type="text" value={finance.bill_no} onChange={e => handleFinanceChange('bill_no', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions (-)</h4>
                        <div className="border-b border-gray-100 pb-2 mb-2">
                           <div className="flex justify-between items-center mb-2"><label className="text-sm font-semibold text-gray-700 flex items-center gap-2">Advance Received <button onClick={(e) => { e.preventDefault(); addArrayRow('advance_details', {date:'', amount:''}); }} className="flex items-center gap-1 text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-xs print:hidden font-bold"><PlusCircle className="h-3 w-3" /> Add</button></label></div>
                           {finance.advance_details.map((adv, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1 gap-2 text-sm">
                                 <input type="date" className="border p-1 rounded text-xs text-gray-500 w-[110px]" value={adv.date} onChange={e => handleArrayChange('advance_details', idx, 'date', e.target.value)} />
                                 <div className="flex items-center gap-1"><input type="number" className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600" value={adv.amount || ''} onChange={e => handleArrayChange('advance_details', idx, 'amount', e.target.value)} placeholder="₹" />{idx > 0 && <button onClick={(e) => { e.preventDefault(); removeArrayRow('advance_details', idx); }} className="text-rose-400 print:hidden p-1"><X className="h-4 w-4"/></button>}</div>
                              </div>
                           ))}
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2"><label className="text-sm font-semibold text-gray-700">TDS (₹)</label><input className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600" type="number" value={finance.tds || ''} onChange={e => handleFinanceChange('tds', e.target.value)} /></div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2"><input className="text-sm font-semibold text-gray-700 border-b border-dashed w-32 bg-transparent outline-none" placeholder="Extra Deduction..." /><input className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600" type="number" value={finance.extra_deduction || ''} onChange={e => handleFinanceChange('extra_deduction', e.target.value)} /></div>
                      </div>
                      
                      <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30"><span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span><span className="font-extrabold text-2xl text-emerald-600">₹{calculatePending()}</span></div>
                  </div>

                  <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Operational Tracking (Internal)</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 print:p-0 print:border-none">
                          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Diesel & Fastag (Estimates)</h4>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                              <label className="text-sm font-semibold text-gray-700">Total KM Traveled</label>
                              <input className="border border-gray-300 p-1.5 rounded w-28 text-right font-bold text-slate-700 print:border-none print:p-0 print:bg-transparent" type="number" value={finance.total_km || ''} onChange={handleKmChange} />
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-2">
                              <span className="text-sm font-semibold text-gray-700">Diesel Required (Est/Act)</span>
                              <div className="flex items-center gap-1">
                                  <input className="border border-gray-300 p-1.5 rounded w-28 text-right font-bold text-slate-900 print:border-none print:p-0 print:bg-transparent focus:ring-2 focus:ring-blue-100 outline-none" type="number" step="any" value={finance.diesel_liters_needed || ''} onChange={e => handleFinanceChange('diesel_liters_needed', e.target.value)} />
                                  <span className="font-bold text-slate-900 text-sm">Liters</span>
                              </div>
                          </div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                              <span className="text-sm font-semibold text-gray-700">Fastag (Est/Act)</span>
                              <div className="flex items-center gap-1">
                                  <span className="font-bold text-slate-900 text-sm">₹</span>
                                  <input className="border border-gray-300 p-1.5 rounded w-28 text-right font-bold text-slate-900 print:border-none print:p-0 print:bg-transparent focus:ring-2 focus:ring-blue-100 outline-none" type="number" step="any" value={finance.fastag_estimate || ''} onChange={e => handleFinanceChange('fastag_estimate', e.target.value)} />
                              </div>
                          </div>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 print:p-0 print:border-none">
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Actual Fastag Logs</h4>
                              <button onClick={(e) => { e.preventDefault(); addArrayRow('fastag_details', {date:'', place:'', amount:''}); }} className="flex items-center gap-1 text-amber-700 bg-amber-200/50 px-2 py-0.5 rounded text-xs print:hidden font-bold"><PlusCircle className="h-3 w-3" /> Add Toll</button>
                          </div>
                          {finance.fastag_details.map((f, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1.5 gap-2 text-sm">
                                 <input type="date" className="border border-amber-200 p-1 rounded text-[10px] text-gray-700 w-[95px] print:border-none" value={f.date || ''} onChange={e => handleArrayChange('fastag_details', idx, 'date', e.target.value)} />
                                 <input type="text" placeholder="Location (Opt)..." className="border border-amber-200 p-1 rounded text-xs w-[100px] print:border-none" value={f.place || ''} onChange={e => handleArrayChange('fastag_details', idx, 'place', e.target.value)} />
                                 <div className="flex items-center gap-1"><input type="number" className="border border-amber-200 p-1.5 rounded w-[70px] text-right font-bold text-rose-600 print:border-none print:p-0" value={f.amount || ''} onChange={e => handleArrayChange('fastag_details', idx, 'amount', e.target.value)} placeholder="₹" /><button onClick={(e) => { e.preventDefault(); removeArrayRow('fastag_details', idx); }} className="text-rose-400 print:hidden p-0.5"><X className="h-4 w-4"/></button></div>
                              </div>
                          ))}
                          <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-300">
                             <span className="text-sm font-extrabold text-amber-900">Total Actual Fastag</span>
                             <span className="font-extrabold text-rose-600">₹{totalFastagActual}</span>
                          </div>
                      </div>
                  </div>

                  <div className="mt-8 print:mt-4">
                      <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2 flex justify-between items-center">
                          <span>Driver Settlement (Hisaab) Ledger</span>
                      </h3>

                      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 grid grid-cols-2 gap-x-8 gap-y-4 mb-6 text-sm">
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Driver Advance (₹3.5/km)</span><span className="font-bold text-slate-900">₹{trip.driver_advance || 0}</span></div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span><span className="font-bold text-slate-900">₹{trip.driver_remaining || 0}</span></div>
                          <div className="flex justify-between items-center border-b border-gray-200 pb-2 col-span-2 bg-blue-100 p-2 rounded"><span className="font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span><span className="font-extrabold text-slate-700">₹{trip.driver_total || 0}</span></div>
                      </div>

                      <form onSubmit={handleAddHisaab} className="print:hidden bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
                          <div>
                              <label className="block text-[11px] font-bold text-gray-600 mb-1">Amount (₹)</label>
                              <input type="number" step="any" value={hAmount} onChange={(e) => setHAmount(e.target.value)} required placeholder="Amt" className="w-full p-2 bg-white border border-gray-200 rounded text-sm font-bold" />
                          </div>
                          <div>
                              <label className="block text-[11px] font-bold text-gray-600 mb-1">Date</label>
                              <input type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} required className="w-full p-2 bg-white border border-gray-200 rounded text-sm font-bold" />
                          </div>
                          <div>
                              <label className="block text-[11px] font-bold text-gray-600 mb-1">Reason / Category</label>
                              <select value={hCategory} onChange={(e) => setHCategory(e.target.value)} className="w-full p-2 bg-white border border-gray-200 rounded text-sm font-bold">
                                  <option value="Diesel">Diesel</option>
                                  <option value="Fastag">Fastag</option>
                                  <option value="Miscellaneous">Miscellaneous</option>
                              </select>
                          </div>

                          {hCategory === 'Diesel' ? (
                              <>
                                  <div>
                                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Liters</label>
                                      <input type="number" step="any" value={hLiters} onChange={(e) => setHLiters(e.target.value)} placeholder="Ltrs" className="w-full p-2 bg-white border border-gray-200 rounded text-sm font-bold" />
                                  </div>
                                  <div className="sm:col-span-2">
                                      <label className="block text-[11px] font-bold text-gray-600 mb-1">Pump / Place</label>
                                      <input type="text" value={hPlace} onChange={(e) => setHPlace(e.target.value)} placeholder="Location name" className="w-full p-2 bg-white border border-gray-200 rounded text-sm font-bold" />
                                  </div>
                              </>
                          ) : (
                              <div className="sm:col-span-3">
                                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Remarks / Note</label>
                                  <input type="text" value={hReason} onChange={(e) => setHReason(e.target.value)} placeholder="Optional details..." className="w-full p-2 bg-white border border-gray-200 rounded text-sm font-bold" />
                              </div>
                          )}

                          <div className="sm:col-span-2 md:col-span-6 flex justify-end">
                              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded text-sm flex items-center gap-1.5 transition cursor-pointer">
                                  <Plus className="h-4 w-4"/> Add Hisaab Entry
                              </button>
                          </div>
                      </form>

                      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                          <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 text-slate-700 uppercase font-bold border-b border-gray-200">
                                  <tr>
                                      <th className="p-2.5">Date</th>
                                      <th className="p-2.5">Category</th>
                                      <th className="p-2.5">Details (Liters / Place / Note)</th>
                                      <th className="p-2.5 text-right">Amount</th>
                                      <th className="p-2.5 w-10 text-center print:hidden">Action</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {hisaabEntries.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50 font-medium">
                                          <td className="p-2.5 text-gray-600">{formatDate(item.date)}</td>
                                          <td className="p-2.5 font-bold text-slate-800">{item.category}</td>
                                          <td className="p-2.5 text-gray-600">
                                              {item.category === 'Diesel' ? `${item.liters || 0} Ltrs at ${item.place || 'N/A'}` : (item.reason || item.place || '-')}
                                          </td>
                                          <td className="p-2.5 text-right font-bold text-rose-600">₹{item.amount || 0}</td>
                                          <td className="p-2.5 text-center print:hidden">
                                              <button onClick={(e) => { e.preventDefault(); handleDeleteHisaab(idx); }} className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition cursor-pointer">
                                                  <Trash2 className="h-4 w-4" />
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                                  {hisaabEntries.length === 0 && (
                                      <tr>
                                          <td colSpan="5" className="p-4 text-center text-gray-400 italic">No driver hisaab entries recorded yet.</td>
                                      </tr>
                                  )}
                              </tbody>
                          </table>
                      </div>
                  </div>

                  {trip?.telemetry?.lat && (
                    <div className="mt-8 border-2 border-slate-900 rounded-lg p-4 bg-white print:border-2 print:border-slate-900 print:break-inside-avoid">
                        <h3 className="font-bold text-base mb-3 text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Geospatial Tracking Record</h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="w-full sm:w-1/2 h-[200px] border border-gray-300 rounded overflow-hidden z-0 relative">
                                <MapContainer center={[trip.telemetry.lat, trip.telemetry.lng]} zoom={13} style={{ height: "100%", width: "100%", zIndex: 0 }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
                                   <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                   <Marker position={[trip.telemetry.lat, trip.telemetry.lng]} />
                                </MapContainer>
                            </div>
                            <div className="w-full sm:w-1/2 space-y-2 text-sm text-slate-700">
                                <div className="flex justify-between border-b pb-1"><strong>Status:</strong> <span className="font-bold text-emerald-600">{trip.telemetry.status}</span></div>
                                <div className="flex justify-between border-b pb-1"><strong>Speed:</strong> <span>{trip.telemetry.speed} km/h</span></div>
                                <div className="flex justify-between border-b pb-1"><strong>Fuel Level:</strong> <span className="font-bold">{trip.telemetry.fuel_level} L</span></div>
                                <div className="flex justify-between pb-1"><strong>Coordinates:</strong> <span>{trip.telemetry.lat.toFixed(4)}, {trip.telemetry.lng.toFixed(4)}</span></div>
                            </div>
                        </div>
                    </div>
                  )}

                  <div className="hidden print:flex justify-between mt-20 pt-8">
                      <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Receiver's Signature</div>
                      <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
                  </div>
                </div>
              )}

              {/* 🌟 CLIENT BILL VIEW: 100% SIZING & SAFE PADDING */}
              {viewType === 'bill' && (
                  <div className="bill-print-container w-full max-w-[850px] text-black font-sans leading-snug mx-auto p-4 print:p-0 animate-in fade-in">
                      <div className="text-center mb-2">
                          <h1 className="text-3xl font-extrabold text-black tracking-widest leading-none mb-1">{currentComp.name}</h1>
                          <p className="text-[13px] font-bold whitespace-pre-line leading-tight">{currentComp.address}</p>
                          <div className="flex justify-center gap-6 mt-1 text-[12px] font-bold"><span>GST NO.: {currentComp.gst}</span><span>PAN No.: {currentComp.pan}</span></div>
                          <p className="text-[11px] font-bold mt-1">Email: {currentComp.email}, Mob. {currentComp.phone}</p>
                      </div>

                      <div className="border border-black flex justify-between">
                          <div className="w-[60%] border-r border-black p-2.5 text-[12px]">
                              <p className="font-bold">TO,</p>
                              
                              {/* 🌟 1. MANUAL OR DROPDOWN PARTY NAME */}
                              <div className="mt-1">
                                  <input 
                                    type="text" 
                                    list="bill-parties-dropdown-fin"
                                    value={billPartyName} 
                                    onChange={(e) => setBillPartyName(e.target.value.toUpperCase())} 
                                    placeholder="ENTER CLIENT / PARTY NAME" 
                                    className="w-full font-bold uppercase outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 print:border-none print:appearance-none p-0 text-[12px] leading-tight" 
                                  />
                                  <datalist id="bill-parties-dropdown-fin">
                                      {partyList.map((p, idx) => (
                                          <option key={idx} value={p}>{p}</option>
                                      ))}
                                  </datalist>
                              </div>

                              {/* 🌟 2. MANUAL EDITABLE DESTINATION CITY & STATE LINE */}
                              <div className="mt-0.5">
                                  <input 
                                    type="text" 
                                    value={billPartyCity} 
                                    onChange={(e) => setBillPartyCity(e.target.value.toUpperCase())} 
                                    placeholder="CITY, STATE (e.g. BAHRAICH, RAJ.)" 
                                    className="w-full font-bold uppercase outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 print:border-none print:appearance-none p-0 text-[12px] leading-tight" 
                                  />
                              </div>

                              {/* 🌟 3. MANUAL EDITABLE GST NUMBER */}
                              <div className="flex items-center gap-1 mt-2">
                                  <span className="font-bold">GST:-</span>
                                  <input 
                                    type="text" 
                                    value={billPartyGst} 
                                    onChange={(e) => setBillPartyGst(e.target.value.toUpperCase())} 
                                    placeholder="ENTER PARTY GST NUMBER" 
                                    className="flex-1 font-bold uppercase outline-none bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 print:border-none print:appearance-none p-0 text-[12px]" 
                                  />
                              </div>

                              <p className="font-bold">STATE: RAJASTHAN / STATE CODE: 08</p>
                          </div>
                          <div className="w-[40%] text-[13px] font-bold">
                              <div className="border-b border-black p-2.5 flex justify-between">
                                  <span>Invoice No.:</span>
                                  <span>{finance.bill_no || localInvoiceNo}</span>
                              </div>
                              <div className="p-2.5 flex justify-between">
                                  <span>Date:</span>
                                  <span>{formatDate(localBillDate || trip.trip_start_date)}</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="border-x border-b border-black p-1 text-center text-[12px] font-bold">GST PAYABLE UNDER REVERSE CHARGES - YES/NO</div>

                      {/* 🌟 FIXED TABLE COLUMNS: BALANCED PROPORTIONS PREVENT TEXT COLLISION */}
                      <table className="w-full table-fixed border-collapse border border-black text-[10px] font-bold text-center mt-[-1px]">
                          <thead>
                              <tr>
                                  <th className="border border-black p-1 w-[11%] leading-tight">LOADING<br/>DATE</th>
                                  <th className="border border-black p-1 w-[10%] leading-tight">LR.NO.</th>
                                  <th className="border border-black p-1 w-[13%] leading-tight">VEHICLE<br/>NO.</th>
                                  <th className="border border-black p-1 w-[12%] leading-tight">FROM</th>
                                  <th className="border border-black p-1 w-[12%] leading-tight">TO</th>
                                  <th className="border border-black p-1 w-[5%] leading-tight">WT</th>
                                  <th className="border border-black p-1 w-[5%] leading-tight">RATE</th>
                                  <th className="border border-black p-1 w-[10%] leading-tight">FREIGHT</th>
                                  <th className="border border-black p-1 w-[7%] leading-tight">UNLOAD<br/>CHG</th>
                                  <th className="border border-black p-1 w-[7%] leading-tight">RATE<br/>DIFF</th>
                                  <th className="border border-black p-1 w-[8%] leading-tight">TOTAL<br/>FREIGHT</th>
                              </tr>
                          </thead>
                          <tbody>
                              <tr>
                                  <td className="border-r border-black p-1 align-top pt-2 h-16 truncate text-[9.5px]">
                                      {formatDate(trip.trip_start_date) || '-'}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2 break-all text-[9.5px]">
                                      {trip.lr_no || '-'}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2 break-all text-[10px]">
                                      {trip.vehicle_number}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2 uppercase break-words text-[9.5px]">
                                      {trip.source_city}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2 uppercase break-words text-[9.5px]">
                                      {trip.destination_city}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2"></td>
                                  <td className="border-r border-black p-1 align-top pt-2"></td>
                                  <td className="border-r border-black p-1 align-top pt-2 text-right pr-1">
                                      {freight.toFixed(2)}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2 text-right pr-1">
                                      {loadingCharge > 0 ? loadingCharge.toFixed(2) : ''}
                                  </td>
                                  <td className="border-r border-black p-1 align-top pt-2 text-right pr-1">
                                      {holdingCharge > 0 ? holdingCharge.toFixed(2) : ''}
                                  </td>
                                  <td className="p-1 align-top pt-2 text-right pr-1">
                                      {exactBillTotalFreight.toFixed(2)}
                                  </td>
                              </tr>
                              
                              <tr className="border-t border-black">
                                  <td colSpan="8" rowSpan="7" className="border-r border-black p-2.5 align-bottom text-left uppercase text-[12px] leading-snug">
                                      TOTAL INVOICE AMOUNT (IN WORDS):<br/>
                                      <span className="font-extrabold text-[12.5px] mt-1 block">
                                          {numberToWords(finalTotalAmount)}
                                      </span>
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
                                  <td colSpan="2" className="border-r border-t border-black p-1 text-left pl-2">
                                      ADVANCE {tdsAmount > 0 ? `+ TDS (₹${tdsAmount})` : ''}
                                  </td>
                                  <td className="border-t border-black p-1 text-right pr-2">
                                      {(totalAdvances + tdsAmount + extraDeduction) > 0 ? (totalAdvances + tdsAmount + extraDeduction).toFixed(2) : ''}
                                  </td>
                              </tr>
                              <tr className="border-t border-black">
                                  <td colSpan="8" className="border-r border-black p-0 text-left align-top">
                                      <div className="bg-black text-white text-center py-0.5 text-[11px]">BANK DETAILS</div>
                                      <div className="flex text-[10px]">
                                          <div className="w-1/2 p-1.5 border-r border-black">
                                              A/C NO. <br/>510605010060611<br/>IFSC CODE: UBIN0551066<br/>BRANCH: SSI, JAIPUR<br/>UNION BANK OF INDIA
                                          </div>
                                          <div className="w-1/2 p-1.5">
                                              A/C NO. <br/>756001010050706<br/>IFSC CODE: UBIN0575607<br/>BRANCH: NEW SANGANER ROAD<br/>UNION BANK OF INDIA
                                          </div>
                                      </div>
                                  </td>
                                  <td colSpan="2" className="border-r border-black p-1 text-left pl-2 text-[12px]">BALANCE</td>
                                  <td className="p-1 text-right pr-2 text-[12px] font-black">{balancePayment.toFixed(2)}</td>
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