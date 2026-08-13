import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Search, Filter, Printer, CheckCircle2, X, Edit, AlertCircle, CheckCircle, FileSignature, Lock, Save, PlusCircle } from 'lucide-react';
import ActivityLog from '../utils/ActivityLog'; // Adjust path if necessary

const API_BASE = import.meta.env.VITE_API_URL;
const PRESET_BANKS = ['JTA 0706', 'JTA 0611', 'JFC 7734', 'JFC 1487'];

const Badge = ({ active, label, isWarning = false }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex w-max items-center gap-1 ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : (isWarning ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200')}`}>
    {active ? '✓' : (isWarning ? '⚠️' : '✗')} {label}
  </span>
);

function TripHistory() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');

  const [receiptModal, setReceiptModal] = useState({ isOpen: false, trip: null });
  const [editLogisticsModal, setEditLogisticsModal] = useState({ isOpen: false, tripData: null });
  const [statusModal, setStatusModal] = useState({ 
    isOpen: false, trip: null, originalTrip: null, trip_unloaded: false, 
    cleared_amount: '', cleared_date: '',
    pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '', pod_received_client_date: ''
  });

  // --- EDITABLE FINANCE STATE (Ported from Trips.jsx) ---
  const [activeCharges, setActiveCharges] = useState({ loading: false, holding: false, gst: false, bill_no: false });
  const [finance, setFinance] = useState({ 
    freight_amount: 0, tds: 0, finance_remarks: '', loading_charge: 0, gst: 0, holding_charge: 0, extra_deduction: 0,
    total_km: 0, driver_advance: 0, driver_remaining: 0, driver_total: 0, diesel_liters_needed: 0, fastag_estimate: 0,
    advance_details: [{ date: '', amount: '' }], fastag_details: [], bill_no: '', bank_account: 'JFC 7734', 
    gst_enabled: false, include_loading_in_gst: false, include_holding_in_gst: false
  });

  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trips/history`);
      setTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const openReceiptModal = async (trip) => {
    try {
      const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trip.tracking_number)}`);
      const tripData = res.data.trip || res.data;
      
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
      setReceiptModal({ isOpen: true, trip: tripData });
    } catch (err) {
      alert("Error loading trip finance details.");
    }
  };

  // --- FINANCE HELPERS ---
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
    const mileage = parseFloat(receiptModal.trip?.mileage) || 5.5; 
    setFinance({ ...finance, total_km: km, driver_advance: km * 3.5, driver_remaining: km * 1.0, driver_total: km * 4.5, fastag_estimate: km * 5.75, diesel_liters_needed: km > 0 ? (km / mileage).toFixed(2) : 0 });
  };

  const handleSaveFinance = async () => {
    try {
      await axios.post(`${API_BASE}/finances/calculate`, { ...finance, loading_charge: activeCharges.loading ? finance.loading_charge : 0, holding_charge: activeCharges.holding ? finance.holding_charge : 0, gst: finance.gst_enabled ? finance.gst : 0, bill_no: activeCharges.bill_no ? finance.bill_no : '', trip_id: receiptModal.trip.trip_id });
      alert("Ledger Saved & Logged!"); 
      fetchHistory(); 
    } catch (err) {
      alert("Error saving finance data.");
    }
  };

  const openStatusModal = (trip) => {
    setStatusModal({
      isOpen: true, trip: trip, originalTrip: trip,
      trip_unloaded: trip.trip_unloaded || false,
      cleared_amount: '', cleared_date: new Date().toISOString().split('T')[0], 
      pod_status: trip.pod_status || 'Pending',
      pod_arrived_office_date: trip.pod_arrived_office_date || '',
      pod_forwarded_client_date: trip.pod_forwarded_client_date || '',
      pod_received_client_date: trip.pod_received_client_date || ''
    });
  };

  const handleUpdateStatus = async () => {
    try {
      await axios.put(`${API_BASE}/finances/${statusModal.trip.trip_id}/checklist`, {
        trip_unloaded: statusModal.trip_unloaded, amount_cleared: false, 
        cleared_amount: parseFloat(statusModal.cleared_amount) || 0,
        cleared_date: statusModal.cleared_date || null, pod_status: statusModal.pod_status,
        pod_arrived_office_date: statusModal.pod_arrived_office_date || null,
        pod_forwarded_client_date: statusModal.pod_forwarded_client_date || null,
        pod_received_client_date: statusModal.pod_received_client_date || null
      });
      alert("Status Updated Successfully!");
      setStatusModal({ isOpen: false, trip: null, originalTrip: null, trip_unloaded: false, cleared_amount: '', cleared_date: '', pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '', pod_received_client_date: '' });
      fetchHistory();
    } catch (err) { alert("Failed to update status."); }
  };

  const handleUpdateLockedEdit = async () => {
    if (!window.confirm("⚠️ WARNING: This is a ONE-TIME edit. Once saved, this trip will be permanently locked. Are you absolutely sure?")) return;
    try {
      await axios.put(`${API_BASE}/trips/${editLogisticsModal.tripData.trip_id}/locked-edit`, editLogisticsModal.tripData);
      alert("Trip Info Updated and Permanently Locked! 🔒");
      setEditLogisticsModal({ isOpen: false, tripData: null });
      fetchHistory();
    } catch (err) { alert(err.response?.data?.detail || "Failed to update trip info."); }
  };

  let processedTrips = trips.filter(trip => 
    (trip.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.party_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.source_city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.destination_city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (statusFilter === 'pending_amount') processedTrips = processedTrips.filter(t => parseFloat(t.balance_payment || 0) > 0);
  else if (statusFilter === 'pending_pod') processedTrips = processedTrips.filter(t => t.pod_status !== 'Client Received');
  else if (statusFilter === 'not_unloaded') processedTrips = processedTrips.filter(t => !t.trip_unloaded);
  else if (statusFilter === 'fully_complete') processedTrips = processedTrips.filter(t => t.trip_unloaded && parseFloat(t.balance_payment || 0) <= 0 && t.pod_status === 'Client Received');

  if (sortBy === 'newest') processedTrips.sort((a, b) => new Date(b.actual_delivery_date || b.trip_start_date) - new Date(a.actual_delivery_date || a.trip_start_date));
  else if (sortBy === 'oldest') processedTrips.sort((a, b) => new Date(a.actual_delivery_date || a.trip_start_date) - new Date(b.actual_delivery_date || b.trip_start_date));

  const pendingBalance = parseFloat(statusModal.trip?.balance_payment ?? statusModal.trip?.freight_amount ?? 0);
  const isCustomBank = finance.bank_account === '' || !PRESET_BANKS.includes(finance.bank_account);
  const totalFastagActual = finance.fastag_details.reduce((s, f) => s + parseFloat(f.amount || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-600"/> Completed Trip History
          </h2>
          <p className="text-sm text-gray-500 mt-1">Archive of all successfully delivered shipments and final billing records.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-right">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Total Delivered</span>
            <span className="text-xl font-black text-emerald-800">{trips.length}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
         <div className="relative w-full md:flex-1 md:max-w-md">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
           <input type="text" placeholder="Search tracking, vehicle, party, or city..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 text-sm focus:ring-2 focus:ring-slate-100 outline-none" />
         </div>
         <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full md:w-auto">
           <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-full sm:w-auto">
               <Filter className="h-4 w-4 text-gray-500" />
               <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm focus:outline-none text-slate-700 font-semibold cursor-pointer w-full">
                  <option value="all">All Statuses</option>
                  <option value="pending_amount">⚠️ Pending Amount</option>
                  <option value="pending_pod">⚠️ Pending POD (Client)</option>
                  <option value="not_unloaded">⚠️ Not Unloaded</option>
                  <option value="fully_complete">✅ Fully Complete</option>
               </select>
           </div>
           <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-slate-100 outline-none text-slate-700 font-medium cursor-pointer bg-white w-full sm:w-auto">
              <option value="newest">Sort by: Latest Delivery</option>
              <option value="oldest">Sort by: Oldest Delivery</option>
           </select>
         </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-10 text-center text-gray-500 font-medium">Loading completed trips...</p>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap min-w-[1000px]">
              <thead className="border-b bg-gray-50 text-gray-600 font-semibold">
                <tr>
                  <th className="p-4 w-1/5">Tracking No. / LR</th>
                  <th className="p-4 w-1/6">Vehicle & Party</th>
                  <th className="p-4 w-1/5">Route & Date</th>
                  <th className="p-4 w-1/5">Checklist Status</th>
                  <th className="p-4 w-1/6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {processedTrips.map((trip, index) => {
                  
                  const balance = parseFloat(trip.balance_payment ?? trip.freight_amount ?? 0);
                  const isFullyPaid = balance <= 0;
                  const isPartiallyPaid = !isFullyPaid && parseFloat(trip.adv_amt || 0) > 0;
                  const isFullyComplete = trip.trip_unloaded && isFullyPaid && trip.pod_status === 'Client Received';

                  return (
                    <tr key={trip.trip_id || `hist-${index}`} className={`transition-colors ${isFullyComplete ? 'bg-emerald-50/20 hover:bg-emerald-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <button onClick={() => openReceiptModal(trip)} className="text-blue-600 font-bold hover:text-blue-800 hover:underline transition cursor-pointer text-left">
                             {trip.tracking_number}
                           </button>
                           
                           {trip.is_locked ? (
                               <button disabled className="text-gray-300 cursor-not-allowed" title="Trip is Permanently Locked"><Lock className="h-3.5 w-3.5" /></button>
                           ) : (
                               <button onClick={() => setEditLogisticsModal({isOpen: true, tripData: trip})} className="text-amber-500 hover:text-amber-700 transition" title="One-Time Final Edit"><FileSignature className="h-3.5 w-3.5" /></button>
                           )}
                           
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">LR: {trip.lr_no || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-800">{trip.vehicle_number}</div>
                        <div className="text-xs text-gray-600 font-medium">{trip.party_name || '-'}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-700">{trip.source_city} → {trip.destination_city}</div>
                        <div className="text-xs text-emerald-600 font-bold mt-0.5">Delivered: {trip.actual_delivery_date || '-'}</div>
                      </td>
                      <td className="p-4">
                        {isFullyComplete ? (
                            <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-black w-max shadow-sm"><CheckCircle className="h-4 w-4" /> FULLY COMPLETE</div>
                        ) : (
                            <div className="flex flex-col gap-1.5 items-start">
                                <Badge active={trip.trip_unloaded} label="Unloaded" />
                                <Badge active={isFullyPaid} isWarning={isPartiallyPaid} label={isFullyPaid ? "Fully Paid" : `Pending: ₹${balance.toFixed(2)}`} />
                                <Badge active={trip.pod_status === 'Client Received'} label={trip.pod_status || 'POD Pending'} />
                            </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <button onClick={() => openReceiptModal(trip)} className="w-32 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition cursor-pointer">
                              <Edit className="h-3.5 w-3.5" /> Edit Finances
                            </button>
                            <button onClick={() => openStatusModal(trip)} className="w-32 flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition cursor-pointer">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Update Status
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!processedTrips.length && (
                  <tr><td className="p-12 text-center text-gray-500" colSpan="6">No completed trips found matching your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🌟 EDITABLE RECEIPT MODAL FOR COMPLETED TRIPS */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
               <h3 className="font-bold text-lg text-slate-800">Financial Settlement & Receipt</h3>
               <button onClick={() => setReceiptModal({isOpen: false, trip: null})} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition cursor-pointer"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
               <div ref={receiptRef} className="bg-white p-10 mx-auto shadow-sm border border-gray-200 rounded-xl max-w-3xl">
                  
                  <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                      <div><h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">JAIN FREIGHT CARRIERS</h1><p className="text-gray-500 mt-1 font-medium text-sm">Logistics & Transportation Services</p></div>
                      <div className="text-right"><h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2><p className="text-sm font-semibold text-gray-500 mt-1">TRK: {receiptModal.trip.tracking_number}</p>{activeCharges.bill_no && finance.bill_no && (<p className="text-sm font-bold text-blue-700 mt-1 uppercase tracking-wide">BILL NO: {finance.bill_no}</p>)}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{receiptModal.trip.trip_start_date || '-'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-base">{receiptModal.trip.vehicle_number}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{receiptModal.trip.source_city} → {receiptModal.trip.destination_city}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Bank Account:</span> <span className="font-bold text-blue-700">{finance.bank_account || 'N/A'}</span></div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{receiptModal.trip.party_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Owner Name:</span> <span className="font-bold">{receiptModal.trip.owner_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{receiptModal.trip.gta_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{receiptModal.trip.lr_no || 'N/A'}</span></div>
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
                          <div className="flex justify-between items-center"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.holding} onChange={() => toggleCharge('holding')} className="rounded print:hidden" /> Holding Charge</label>{activeCharges.holding ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.holding_charge} onChange={e => handleFinanceChange('holding_charge', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                          {activeCharges.holding && <label className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-1 print:hidden pl-5"><input type="checkbox" checked={finance.include_holding_in_gst} onChange={e => handleFinanceChange('include_holding_in_gst', e.target.checked)} className="rounded" /> Include in GST</label>}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2 bg-slate-50/50 print:bg-transparent px-1 rounded"><label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer"><input type="checkbox" checked={finance.gst_enabled} onChange={e => handleFinanceChange('gst_enabled', e.target.checked)} className="rounded text-emerald-600 print:hidden" /> GST (18%)</label>{finance.gst_enabled ? <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent text-emerald-600" type="number" value={finance.gst} onChange={e => handleFinanceChange('gst', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Unchecked</span>}</div>
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2"><label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer"><input type="checkbox" checked={activeCharges.bill_no} onChange={() => toggleCharge('bill_no')} className="rounded print:hidden" /> Bill Number</label>{activeCharges.bill_no ? <input className="border p-1.5 rounded w-32 font-bold text-blue-700 print:hidden" type="text" value={finance.bill_no} onChange={e => handleFinanceChange('bill_no', e.target.value)} /> : <span className="w-32 text-right text-gray-400 print:hidden">Excluded</span>}</div>
                      </div>

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
                      
                      <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30"><span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span><span className="font-extrabold text-2xl text-emerald-600">₹{calculatePending()}</span></div>
                  </div>

                  {/* OPERATIONAL TRACKING */}
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
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent text-sm">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Driver Advance (₹3.5/km)</span><span className="font-bold text-slate-900">₹{finance.driver_advance || 0}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2"><span className="font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span><span className="font-bold text-slate-900">₹{finance.driver_remaining || 0}</span></div>
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2 col-span-2 bg-blue-100 p-2 rounded"><span className="font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span><span className="font-extrabold text-slate-700">₹{finance.driver_total || 0}</span></div>
                  </div>

               </div>
            </div>

            <div className="p-5 border-t bg-white flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
               <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-bold transition cursor-pointer"><Printer className="h-5 w-5"/> Print Receipt</button>
               <button onClick={handleSaveFinance} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-sm transition cursor-pointer"><Save className="h-5 w-5"/> Save Financial Ledger</button>
            </div>

          </div>
        </div>
      )}

      {/* UPDATE STATUS MODAL (No Changes Here) */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5 animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600"/> Update Status
                </h3>
                <button onClick={() => setStatusModal({isOpen: false, trip: null})} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 cursor-pointer"><X className="h-5 w-5"/></button>
             </div>
             <p className="text-sm text-gray-600">Update checklist for <strong>{statusModal.trip?.tracking_number}</strong>:</p>
             <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:border-blue-300 transition">
                   <input type="checkbox" className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" checked={statusModal.trip_unloaded} onChange={e => setStatusModal({...statusModal, trip_unloaded: e.target.checked})} />
                   <span className="font-bold text-slate-800 text-sm">Trip Unloaded</span>
                </label>
                
                <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 flex flex-col gap-2 transition hover:border-blue-300">
                    <span className="font-bold text-slate-800 text-sm">Log New Payment</span>
                    <div className="flex flex-col gap-2 mt-1">
                        <span className="text-xs text-slate-500 font-bold">Current Pending Balance: <span className="text-blue-600">₹{pendingBalance.toFixed(2)}</span></span>
                        {pendingBalance <= 0 ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 p-2 rounded-lg text-center block w-full mt-1 border border-emerald-200">✓ Balance is fully paid.</span>
                        ) : (
                            <div className="flex gap-2">
                                <input type="number" placeholder="Amount Received (₹)" className="w-full border border-gray-300 rounded p-2 text-sm text-gray-700 outline-none focus:border-blue-400 font-bold" value={statusModal.cleared_amount} onChange={e => setStatusModal({...statusModal, cleared_amount: e.target.value})} />
                                <input type="date" className="w-full border border-gray-300 rounded p-2 text-sm text-gray-700 outline-none focus:border-blue-400" value={statusModal.cleared_date} onChange={e => setStatusModal({...statusModal, cleared_date: e.target.value})} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col gap-3 mt-2">
                    <label className="font-bold text-blue-900 text-sm">POD Tracking Stage</label>
                    <select className="border border-blue-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none w-full bg-white font-semibold text-slate-700 cursor-pointer" value={statusModal.pod_status} onChange={e => setStatusModal({...statusModal, pod_status: e.target.value})}>
                       <option value="Pending">Pending (Not received yet)</option>
                       <option value="Received">Received at Office</option>
                       <option value="Forwarded">Forwarded to Party</option>
                       <option value="Client Received">Received by Party</option>
                    </select>
                    
                    <div className="space-y-2 mt-1">
                        {['Received', 'Forwarded', 'Client Received'].includes(statusModal.pod_status) && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Office Arrival:</span>
                               {statusModal.originalTrip?.pod_arrived_office_date ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✓ {statusModal.originalTrip.pod_arrived_office_date}</span> : <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_arrived_office_date} onChange={e => setStatusModal({...statusModal, pod_arrived_office_date: e.target.value})} />}
                            </div>
                        )}
                        {['Forwarded', 'Client Received'].includes(statusModal.pod_status) && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Forwarded:</span>
                               {statusModal.originalTrip?.pod_forwarded_client_date ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✓ {statusModal.originalTrip.pod_forwarded_client_date}</span> : <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_forwarded_client_date} onChange={e => setStatusModal({...statusModal, pod_forwarded_client_date: e.target.value})} />}
                            </div>
                        )}
                        {statusModal.pod_status === 'Client Received' && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Client Received:</span>
                               {statusModal.originalTrip?.pod_received_client_date ? <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✓ {statusModal.originalTrip.pod_received_client_date}</span> : <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_received_client_date} onChange={e => setStatusModal({...statusModal, pod_received_client_date: e.target.value})} />}
                            </div>
                        )}
                    </div>
                </div>
             </div>

             <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setStatusModal({isOpen: false, trip: null})} className="px-4 py-2 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 text-sm cursor-pointer">Cancel</button>
                <button onClick={handleUpdateStatus} className="text-white px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition bg-blue-600 hover:bg-blue-700 cursor-pointer">Save Status</button>
             </div>
          </div>
        </div>
      )}

      {/* ONE-TIME FINAL EDIT MODAL (No Changes Here) */}
      {editLogisticsModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b bg-rose-50">
               <div><h3 className="font-bold text-lg text-rose-900 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Final One-Time Edit</h3><p className="text-xs text-rose-700 font-semibold mt-0.5">You can only edit this completed trip ONCE. Review all details carefully.</p></div>
               <button onClick={() => setEditLogisticsModal({isOpen: false, tripData: null})} className="p-2 hover:bg-rose-100 rounded-lg text-rose-500 transition cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 h-[60vh] overflow-y-auto bg-gray-50">
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Vehicle Number</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.vehicle_number} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, vehicle_number: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Launch Date</label><input type="date" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.trip_start_date || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, trip_start_date: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Source City</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.source_city} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, source_city: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Destination City</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.destination_city} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, destination_city: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Party Name</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.party_name || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, party_name: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Owner Name</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.owner_name || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, owner_name: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">GTA Name</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.gta_name || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, gta_name: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">LR / Bilty No</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.lr_no || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, lr_no: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">E-Way Bill</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.eway_bill || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, eway_bill: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Estimated Route KM</label><input type="number" className="w-full border border-blue-300 p-2.5 rounded-lg text-sm bg-blue-50 font-bold" value={editLogisticsModal.tripData.total_km || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, total_km: e.target.value}})} /></div>
                <div className="space-y-1"><label className="text-xs font-semibold text-gray-600">Rough Freight (₹)</label><input type="number" className="w-full border border-emerald-300 p-2.5 rounded-lg text-sm bg-emerald-50 font-bold" value={editLogisticsModal.tripData.freight_amount || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, freight_amount: e.target.value}})} /></div>
                <div className="space-y-1 md:col-span-3"><label className="text-xs font-semibold text-gray-600">L/W Details</label><input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.lw || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, lw: e.target.value}})} /></div>
            </div>
            <div className="p-5 border-t bg-white flex justify-end gap-3"><button onClick={() => setEditLogisticsModal({isOpen: false, tripData: null})} className="px-5 py-2.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer">Cancel</button><button onClick={handleUpdateLockedEdit} className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-sm transition cursor-pointer flex items-center gap-2"><AlertCircle className="h-4 w-4"/> Permanently Save & Lock</button></div>
          </div>
        </div>
      )}

      {/* 🌟 GLOBAL ACTIVITY LOG AT THE BOTTOM OF THE PAGE */}
      <ActivityLog />

    </div>
  );
}

export default TripHistory;