import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Truck, Users, MapPin, Receipt, ArrowRight, Loader2, AlertCircle, 
  X, Download, FileSpreadsheet, FileText, BriefcaseBusiness, Settings2, 
  Table, Navigation, CheckCircle2, Compass, ArrowLeft, Printer, Eye, Calculator,
  Scale, Wallet, Banknote, Calendar
} from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const API_BASE = import.meta.env.VITE_API_URL;

// Helper: Format date to DD-MM-YYYY
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const s = String(dateStr).slice(0, 10);
  const parts = s.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return s;
}

// --- 🌟 4-OPTION STATEMENT RECONCILER MODAL ---
function MultiOptionReconcileModal({ isOpen, onClose, onSyncComplete }) {
  const [statementType, setStatementType] = useState('DIESEL');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen) return null;

  const handleUpload = async () => {
    if (files.length === 0) return alert("Please select an Excel or CSV file to upload.");
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("statement_type", statementType);
    Array.from(files).forEach((f) => formData.append("files", f));

    try {
      const res = await axios.post(`${API_BASE}/reconcile/upload-statements`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data.summary);
      if (onSyncComplete) onSyncComplete();
    } catch (err) {
      alert(err.response?.data?.detail || "Upload failed. Check backend console.");
    } finally {
      setUploading(false);
    }
  };

  const getStatementInfo = () => {
    switch (statementType) {
      case 'DIESEL':
        return {
          title: "Diesel Fuel Statements",
          desc: "Upload HPCL DriveTrack Plus or BPCL Sales Transaction Excel. Auto-extracts fuel pump name, liters, and transaction amount.",
          hint: "Accepts: .xlsx, .xls"
        };
      case 'FASTAG':
        return {
          title: "FASTag Toll Statements",
          desc: "Upload NETC Toll Plaza Summary CSV or ICICI / IDBI Online Statement XLS. Auto-maps transaction time, accounting time, toll plazas, and balances.",
          hint: "Accepts: .csv, .xls, .xlsx"
        };
      case 'OMNI':
        return {
          title: "Omni Card Statements",
          desc: "Upload OMNI CARD ADV. Excel. Auto-detects 4-digit truck numbers, expense categories (fooding, repairs, driver salary), and employee cards.",
          hint: "Accepts: .xlsx (TrxnNotes, MakerName, Amount)"
        };
      case 'IFLEET':
        return {
          title: "I-Fleet Prepaid Wallet",
          desc: "Upload I FLEET P Excel. Tracks wallet loads added by Rohit Jain onto employee cards and refund/return withdrawals.",
          hint: "Accepts: .xlsx (Add Money, Withdraw Balance)"
        };
      default:
        return { title: "", desc: "", hint: "" };
    }
  };

  const currentInfo = getStatementInfo();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center border-b pb-3 mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-600" /> Upload Statement & Reconcile
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 4 Selection Options */}
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-2">
            Select Statement Type
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <label className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition ${statementType === 'DIESEL' ? 'border-amber-600 bg-amber-50/50 text-amber-900 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <input type="radio" name="stmtType" value="DIESEL" checked={statementType === 'DIESEL'} onChange={() => setStatementType('DIESEL')} className="text-amber-600" />
                <span className="font-bold text-xs">⛽ Diesel</span>
              </div>
              <span className="text-[10px] text-gray-500 pl-4">HPCL / BPCL</span>
            </label>

            <label className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition ${statementType === 'FASTAG' ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <input type="radio" name="stmtType" value="FASTAG" checked={statementType === 'FASTAG'} onChange={() => setStatementType('FASTAG')} className="text-emerald-600" />
                <span className="font-bold text-xs">🚗 FASTag</span>
              </div>
              <span className="text-[10px] text-gray-500 pl-4">Tolls CSV/XLS</span>
            </label>

            <label className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition ${statementType === 'OMNI' ? 'border-purple-600 bg-purple-50/50 text-purple-900 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <input type="radio" name="stmtType" value="OMNI" checked={statementType === 'OMNI'} onChange={() => setStatementType('OMNI')} className="text-purple-600" />
                <span className="font-bold text-xs">💳 Omni Card</span>
              </div>
              <span className="text-[10px] text-gray-500 pl-4">Field Expenses</span>
            </label>

            <label className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition ${statementType === 'IFLEET' ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <input type="radio" name="stmtType" value="IFLEET" checked={statementType === 'IFLEET'} onChange={() => setStatementType('IFLEET')} className="text-blue-600" />
                <span className="font-bold text-xs">🏦 I-Fleet</span>
              </div>
              <span className="text-[10px] text-gray-500 pl-4">Float Loads</span>
            </label>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 text-xs">
          <span className="font-bold text-slate-800 block mb-0.5">{currentInfo.title}</span>
          <p className="text-gray-500 leading-relaxed text-[11px]">{currentInfo.desc}</p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center bg-gray-50 mb-4 hover:border-indigo-400 transition">
          <input 
            type="file" 
            multiple 
            accept=".csv,.xls,.xlsx"
            onChange={(e) => setFiles(e.target.files)}
            className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white cursor-pointer"
          />
          <p className="text-[11px] text-gray-400 mt-2">
            {files.length > 0 ? `${files.length} file(s) selected` : currentInfo.hint}
          </p>
        </div>

        {result && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 mb-4">
            <p className="font-bold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Imported {result.entries_added} entries successfully into receipts & ledgers.
            </p>
            {result.unmatched_records > 0 && (
              <p className="text-amber-700 mt-0.5">• {result.unmatched_records} entries had no matching running trip for that vehicle.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">
            Close
          </button>
          <button 
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition ${uploading || files.length === 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 cursor-pointer'}`}
          >
            {uploading ? "Sorting & Importing..." : "Sort by Vehicle & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 🌟 RUNNING SHEET & DRIVER HISAAB RECEIPT (WITH TXN TIME & ACCT TIME) ---
function ReadOnlyReceiptModal({ isOpen, onClose, tripSummary }) {
  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  const [loading, setLoading] = useState(false);
  const [fullTrip, setFullTrip] = useState(null);
  const [showAllTolls, setShowAllTolls] = useState(false);

  useEffect(() => {
    if (isOpen && tripSummary?.trip_id) {
      setLoading(true);
      setShowAllTolls(false);
      axios.get(`${API_BASE}/trips/details/${tripSummary.trip_id}`)
        .then(res => setFullTrip(res.data))
        .catch(() => setFullTrip(tripSummary))
        .finally(() => setLoading(false));
    }
  }, [isOpen, tripSummary]);

  if (!isOpen || !tripSummary) return null;

  const trip = fullTrip || tripSummary;
  const vehicleNo = (trip.vehicle_number || '').toUpperCase().trim();
  const currentOwner = (trip.owner_name || '').toUpperCase();
  const companyName = currentOwner === 'JFC' ? "JAIN FREIGHT CARRIER" : "JAIPUR TRANSPORT AGENCY";

  const fastagDetails = typeof trip.fastag_details === 'string' ? JSON.parse(trip.fastag_details || '[]') : (trip.fastag_details || []);
  const hisaabEntries = typeof trip.driver_hisaab_entries === 'string' ? JSON.parse(trip.driver_hisaab_entries || '[]') : (trip.driver_hisaab_entries || []);
  const advanceDetails = typeof trip.advance_details === 'string' ? JSON.parse(trip.advance_details || '[]') : (trip.advance_details || []);

  const km = parseFloat(trip.total_km || 0);

  // 1. Diesel Calculations (HSD)
  const dieselEntries = hisaabEntries.filter(x => x.category === 'Diesel');
  const totalHsdFilledLiters = dieselEntries.reduce((s, d) => s + parseFloat(d.liters || 0), 0);
  const totalHsdFilledCost = dieselEntries.reduce((s, d) => s + parseFloat(d.amount || 0), 0);
  const hsdOpeningTank = parseFloat(trip.diesel_opening_tank || 0);
  const hsdClosingTank = parseFloat(trip.diesel_closing_tank || 0);
  const netHsdConsumedLiters = Math.max(0, (hsdOpeningTank + totalHsdFilledLiters) - hsdClosingTank);
  const avgDieselRate = totalHsdFilledLiters > 0 ? (totalHsdFilledCost / totalHsdFilledLiters) : 90.0;
  const netHsdConsumedCost = parseFloat((netHsdConsumedLiters * avgDieselRate).toFixed(2));

  // 2. FASTag Tolls Chronologically Sorted
  const sortedFastagDetails = [...fastagDetails].sort((a, b) => {
    const tA = a.txn_time || a.date || '';
    const tB = b.txn_time || b.date || '';
    return tA.localeCompare(tB);
  });
  const totalActualFastag = sortedFastagDetails.reduce((s, f) => s + parseFloat(f.amount || 0), 0);
  const latestWalletBalance = sortedFastagDetails.length > 0 && sortedFastagDetails[sortedFastagDetails.length - 1].balance !== undefined ? parseFloat(sortedFastagDetails[sortedFastagDetails.length - 1].balance) : null;

  // 3. Road Cash Advances Given to Driver
  const roadCashList = advanceDetails.filter(a => parseFloat(a.amount || 0) > 0);
  const totalRoadCashGiven = roadCashList.reduce((s, a) => s + parseFloat(a.amount || 0), 0) || parseFloat(trip.adv_amt || 0);

  // 4. Other Road Expenses (Fooding, Tirpal, Repairs, Salary)
  const otherExpenses = hisaabEntries.filter(x => x.category !== 'Diesel');
  const totalOtherExpenses = otherExpenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  // 5. Driver Wages & Calculation Rates (₹3.5 Advance, ₹4.5 Total, ₹1.0 Remaining, ₹5.75 Toll Est)
  const driverWageRate = 3.5;
  const driverTotalRate = 4.5;
  const driverRemainingRate = 1.0;

  const driverWageAdvance = parseFloat(trip.driver_advance || (km * driverWageRate).toFixed(2));
  const driverTotalPay = parseFloat(trip.driver_total || (km * driverTotalRate).toFixed(2));
  const driverRemainingPay = parseFloat(trip.driver_remaining || (km * driverRemainingRate).toFixed(2));
  const estFastag = parseFloat(trip.fastag_estimate || (km * 5.75).toFixed(2));

  const totalDriverOutflow = netHsdConsumedCost + totalActualFastag + totalOtherExpenses;
  const netDriverBalance = totalRoadCashGiven - (totalOtherExpenses + driverWageAdvance);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95">
        
        {/* Header Bar */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 text-sm md:text-base">Trip Running Sheet & Driver Settlement</h3>
            <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">REGISTER FORMAT</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-lg text-gray-500 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
          {loading ? (
            <div className="flex justify-center items-center py-20 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mr-2" /> Loading Running Sheet...
            </div>
          ) : (
            <div ref={receiptRef} className="bg-white p-8 mx-auto shadow-sm border border-gray-200 rounded-xl max-w-4xl text-xs md:text-sm print:p-0 print:border-none print:shadow-none font-sans">
              
              {/* Register Header */}
              <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-end">
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{companyName}</h1>
                  <p className="text-gray-500 font-medium text-xs">Vehicle Trip Running Sheet</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-900">{vehicleNo}</span>
                  <p className="text-xs font-bold text-gray-600">Driver: {trip.driver_name || 'N/A'}</p>
                </div>
              </div>

              {/* Trip Meta Details */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Trip Dates</span>
                  <span className="font-bold text-slate-800">{formatDate(trip.trip_start_date)} → {formatDate(trip.actual_delivery_date || trip.unloading_date)}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">Route</span>
                  <span className="font-bold text-slate-800">{trip.source_city} → {trip.destination_city} ({km} KM)</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-bold">FASTag Wallet Balance</span>
                  <span className="font-bold text-emerald-700">{latestWalletBalance !== null ? `₹${latestWalletBalance.toFixed(2)}` : 'Recorded'}</span>
                </div>
              </div>

              {/* 2-COLUMN LAYOUT: DIESEL (HSD) ON LEFT, CASH ADVANCES ON RIGHT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                
                {/* LEFT: HSD (DIESEL) */}
                <div className="border border-amber-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-amber-50 px-3 py-2 border-b border-amber-200 flex justify-between items-center">
                    <span className="font-bold text-xs text-amber-900">⛽ HSD (Diesel) Entries</span>
                    <span className="text-[10px] font-bold text-amber-700">{dieselEntries.length} Refuels</span>
                  </div>
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-amber-50/50 text-amber-800 font-bold border-b text-[10px]">
                      <tr><th className="p-2">Date / Time</th><th className="p-2">Liters</th><th className="p-2 text-right">Amount (₹)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hsdOpeningTank > 0 && (
                        <tr className="bg-amber-50/20">
                          <td className="p-2 text-gray-500 italic">Opening Tank</td>
                          <td className="p-2 font-bold">{hsdOpeningTank} L</td>
                          <td className="p-2 text-right text-gray-500">-</td>
                        </tr>
                      )}
                      {dieselEntries.map((d, i) => (
                        <tr key={i}>
                          <td className="p-2 text-gray-600">{d.txn_time || formatDate(d.date)}</td>
                          <td className="p-2 font-bold text-slate-800">{parseFloat(d.liters || 0).toFixed(1)} L</td>
                          <td className="p-2 text-right font-bold text-amber-800">₹{parseFloat(d.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {dieselEntries.length === 0 && (
                        <tr><td colSpan="3" className="p-3 text-center text-gray-400 italic">No fuel entries logged</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-amber-50 font-bold border-t border-amber-200 text-xs">
                      <tr>
                        <td className="p-2 text-amber-900">Total Filled</td>
                        <td className="p-2">{totalHsdFilledLiters.toFixed(1)} L</td>
                        <td className="p-2 text-right text-amber-900">₹{totalHsdFilledCost.toFixed(2)}</td>
                      </tr>
                      {hsdClosingTank > 0 && (
                        <tr className="text-emerald-800 bg-emerald-50/50">
                          <td className="p-2">Less Closing Tank</td>
                          <td className="p-2">-{hsdClosingTank} L</td>
                          <td className="p-2 text-right">-₹{(hsdClosingTank * avgDieselRate).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="bg-amber-100 text-amber-950 font-black">
                        <td className="p-2">Net HSD Used</td>
                        <td className="p-2">{netHsdConsumedLiters.toFixed(1)} L</td>
                        <td className="p-2 text-right">₹{netHsdConsumedCost.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* RIGHT: DRIVER CASH ADVANCES */}
                <div className="border border-indigo-200 rounded-xl overflow-hidden bg-white">
                  <div className="bg-indigo-50 px-3 py-2 border-b border-indigo-200 flex justify-between items-center">
                    <span className="font-bold text-xs text-indigo-900">💵 Road Cash Advances Given</span>
                    <span className="text-[10px] font-bold text-indigo-700">{roadCashList.length} Disbursed</span>
                  </div>
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-indigo-50/50 text-indigo-800 font-bold border-b text-[10px]">
                      <tr><th className="p-2">Date / Time</th><th className="p-2">Source / Notes</th><th className="p-2 text-right">Amount (₹)</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {roadCashList.map((a, i) => (
                        <tr key={i}>
                          <td className="p-2 text-gray-600">{a.txn_time || formatDate(a.date)}</td>
                          <td className="p-2 text-gray-700 truncate max-w-[120px]">{a.source || a.reason || 'Cash Float'}</td>
                          <td className="p-2 text-right font-bold text-indigo-800">₹{parseFloat(a.amount || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {roadCashList.length === 0 && (
                        <tr><td colSpan="3" className="p-3 text-center text-gray-400 italic">No cash advances logged</td></tr>
                      )}
                    </tbody>
                    <tfoot className="bg-indigo-50 font-bold border-t border-indigo-200 text-xs">
                      <tr>
                        <td colSpan="2" className="p-2 text-indigo-900">Total Cash Advances Given</td>
                        <td className="p-2 text-right text-indigo-900 font-black">₹{totalRoadCashGiven.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

              </div>

              {/* 🌟 EXPANDABLE & FULL PRINT VIEW FOR FASTAG TOLLS WITH TXN & ACCT TIMES */}
              <div className="border border-emerald-200 rounded-xl overflow-hidden mb-5 bg-white">
                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-200 flex justify-between items-center">
                  <span className="font-bold text-xs text-emerald-900 flex items-center gap-1.5">
                    🚗 FASTag Toll Deductions ({sortedFastagDetails.length} Tolls Recorded)
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-emerald-800">Total Toll: ₹{totalActualFastag.toFixed(2)}</span>
                    {sortedFastagDetails.length > 8 && (
                      <button 
                        type="button"
                        onClick={() => setShowAllTolls(!showAllTolls)} 
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white border border-emerald-300 px-2 py-0.5 rounded cursor-pointer print:hidden transition"
                      >
                        {showAllTolls ? "Collapse View" : `Expand All (${sortedFastagDetails.length})`}
                      </button>
                    )}
                  </div>
                </div>

                <div className={showAllTolls ? "max-h-96 overflow-y-auto print:max-h-none print:overflow-visible" : ""}>
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-emerald-50/50 text-emerald-900 font-bold border-b text-[10px] sticky top-0 print:static">
                      <tr>
                        <th className="p-2">Transaction Time</th>
                        <th className="p-2">Accounting Time</th>
                        <th className="p-2">Toll Plaza Name</th>
                        <th className="p-2 text-right">Amount (₹)</th>
                        <th className="p-2 text-right">Balance (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedFastagDetails.map((f, i) => {
                        const isHiddenOnScreen = !showAllTolls && i >= 8;
                        const amtNum = parseFloat(f.amount || 0);
                        return (
                          <tr 
                            key={i} 
                            className={`hover:bg-emerald-50/40 transition ${isHiddenOnScreen ? 'hidden print:table-row' : ''}`}
                          >
                            <td className="p-2 text-slate-800 font-semibold whitespace-nowrap">
                              {f.txn_time || formatDate(f.date)}
                            </td>
                            <td className="p-2 text-gray-500 whitespace-nowrap">
                              {f.acct_time || '-'}
                            </td>
                            <td className="p-2 text-slate-800 font-medium">
                              {f.place || 'Toll Plaza'}
                            </td>
                            <td className={`p-2 text-right font-bold whitespace-nowrap ${amtNum === 0 ? 'text-gray-400' : 'text-emerald-700'}`}>
                              ₹{amtNum.toFixed(2)}
                            </td>
                            <td className="p-2 text-right font-medium text-gray-600 whitespace-nowrap">
                              {f.balance !== undefined && f.balance !== null ? `₹${parseFloat(f.balance).toFixed(2)}` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {sortedFastagDetails.length === 0 && (
                        <tr><td colSpan="5" className="p-3 text-center text-gray-400 italic">No FASTag tolls recorded for this trip</td></tr>
                      )}
                    </tbody>

                    {!showAllTolls && sortedFastagDetails.length > 8 && (
                      <tbody className="bg-emerald-50/30 border-t text-[10px] text-emerald-800 print:hidden">
                        <tr>
                          <td colSpan="5" className="p-2 text-center font-bold">
                            Showing 8 of {sortedFastagDetails.length} tolls on screen.{" "}
                            <button 
                              type="button" 
                              onClick={() => setShowAllTolls(true)} 
                              className="text-emerald-700 underline font-black hover:text-emerald-900 cursor-pointer"
                            >
                              Click to expand all {sortedFastagDetails.length} tolls
                            </button>
                            <span className="text-gray-400 font-normal ml-1">(All tolls print automatically)</span>
                          </td>
                        </tr>
                      </tbody>
                    )}

                    <tfoot className="bg-emerald-50 font-bold border-t border-emerald-200 text-xs">
                      <tr>
                        <td colSpan="3" className="p-2 text-emerald-950 uppercase">Total Actual FASTag Tolls</td>
                        <td className="p-2 text-right text-emerald-950 font-black">₹{totalActualFastag.toFixed(2)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* OTHER TRIP EXPENSES (TIRPAL, FOODING, REPAIRS, AIR & GLASS) */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mb-5 bg-white">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-800">📝 Other Trip Expenses (With Reason)</span>
                  <span className="text-[10px] font-bold text-slate-700">Total: ₹{totalOtherExpenses.toFixed(2)}</span>
                </div>
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b text-[10px]">
                    <tr><th className="p-2">Date / Time</th><th className="p-2">Category</th><th className="p-2">Reason / Place</th><th className="p-2 text-right">Amount (₹)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {otherExpenses.map((e, i) => (
                      <tr key={i}>
                        <td className="p-2 text-gray-600">{e.txn_time || formatDate(e.date)}</td>
                        <td className="p-2 font-bold text-slate-800">{e.category}</td>
                        <td className="p-2 text-gray-600">{e.reason || e.place || '-'}</td>
                        <td className="p-2 text-right font-bold text-rose-600">₹{parseFloat(e.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                    {otherExpenses.length === 0 && (
                      <tr><td colSpan="4" className="p-3 text-center text-gray-400 italic">No miscellaneous expenses recorded</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 🌟 ESTIMATED OPERATIONAL BUDGET & DEDICATED RATE COLUMNS (3.5, 4.5, 1.0, 5.75) */}
              <div className="mb-5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calculator className="h-4 w-4 text-indigo-600" />
                    Operational Estimates & Driver Rate Columns
                  </h4>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">PER KM RATES</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Estimated Fastag (@ ₹5.75/km)</span>
                    <span className="font-bold text-emerald-700">₹{estFastag}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Driver Wage Adv (@ ₹3.5/km)</span>
                    <span className="font-bold text-blue-700">₹{driverWageAdvance.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Driver Remaining (@ ₹1.0/km)</span>
                    <span className="font-bold text-amber-700">₹{driverRemainingPay.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase font-semibold">Driver Total Pay (@ ₹4.5/km)</span>
                    <span className="font-bold text-indigo-700">₹{driverTotalPay.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between text-[11px]">
                  <span className="text-gray-600">Total Route Distance: <strong className="text-slate-800">{km} KM</strong></span>
                  <span className="text-gray-600">Wage Formula: <strong className="text-slate-800">₹3.5 (Adv) + ₹1.0 (Rem) = ₹4.5 / KM</strong></span>
                </div>
              </div>

              {/* FINAL HISAAB & DRIVER SETTLEMENT */}
              <div className="border-2 border-slate-900 rounded-xl p-4 bg-slate-50">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-2 mb-3">
                  Trip Outflow & Driver Hisaab Settlement
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">1. Net HSD Used:</span>
                    <span className="font-bold">₹{netHsdConsumedCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">2. Actual FASTag Tolls:</span>
                    <span className="font-bold">₹{totalActualFastag.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">3. Other Road Expenses (Bills, Fooding, Repairs):</span>
                    <span className="font-bold">₹{totalOtherExpenses.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t font-bold text-slate-800">
                    <span>Total Operational Outflow:</span>
                    <span>₹{totalDriverOutflow.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t text-indigo-900 font-bold">
                    <span>Cash Advances Given to Driver:</span>
                    <span>₹{totalRoadCashGiven.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-blue-900 font-bold">
                    <span>Driver Wage Earned ({km} KM @ ₹{driverWageRate}/km):</span>
                    <span>₹{driverWageAdvance.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between pt-2 border-t-2 border-slate-900 font-black text-sm bg-white p-2 rounded-lg mt-2">
                    <span className="text-slate-900">Net Driver Settlement:</span>
                    <span className={netDriverBalance >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      ₹{Math.abs(netDriverBalance).toFixed(2)} {netDriverBalance >= 0 ? "Refund Due from Driver" : "Payable to Driver"}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t bg-white flex justify-end gap-3">
          <button onClick={handlePrint} className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer">
            <Printer className="h-4 w-4" /> Print Running Sheet
          </button>
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

// --- CONSOLIDATED TRUCK-WISE RUNNING TRAVEL SHEET ---
function TravelSheetModal({ isOpen, onClose, trips }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [selectedTripForReceipt, setSelectedTripForReceipt] = useState(null);

  if (!isOpen) return null;

  const parsedTrips = (trips || []).map((t) => {
    const km = parseFloat(t.total_km || 0);
    const driverWageAdvance = parseFloat(t.driver_advance || (km * 3.5).toFixed(2));

    let tripRoadCashFloat = 0;
    try {
      const advList = typeof t.advance_details === 'string' ? JSON.parse(t.advance_details || '[]') : (t.advance_details || []);
      if (Array.isArray(advList) && advList.length > 0) {
        tripRoadCashFloat = advList.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      }
    } catch (e) {}
    if (!tripRoadCashFloat) {
      tripRoadCashFloat = parseFloat(t.adv_amt || 0);
    }

    let actualDieselCost = 0;
    let actualDieselLiters = 0;
    try {
      const hisaab = typeof t.driver_hisaab_entries === 'string' ? JSON.parse(t.driver_hisaab_entries || '[]') : (t.driver_hisaab_entries || []);
      const dieselEntries = hisaab.filter(x => x.category === 'Diesel');
      if (dieselEntries.length > 0) {
        actualDieselCost = dieselEntries.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
        actualDieselLiters = dieselEntries.reduce((sum, d) => sum + parseFloat(d.liters || 0), 0);
      }
    } catch (e) {
      actualDieselCost = 0;
      actualDieselLiters = 0;
    }

    let actualFastagCost = 0;
    try {
      const ftList = typeof t.fastag_details === 'string' ? JSON.parse(t.fastag_details || '[]') : (t.fastag_details || []);
      if (Array.isArray(ftList) && ftList.length > 0) {
        actualFastagCost = ftList.reduce((sum, f) => sum + parseFloat(f.amount || 0), 0);
      }
    } catch (e) {
      actualFastagCost = 0;
    }

    const actualOperatingOutflow = tripRoadCashFloat + actualDieselCost + actualFastagCost;

    return {
      rawTrip: t,
      trip_id: t.trip_id,
      tracking_number: t.tracking_number,
      vehicle_number: (t.vehicle_number || 'UNKNOWN').toUpperCase().trim(),
      route: `${t.source_city || '-'} → ${t.destination_city || '-'}`,
      date: formatDate(t.trip_start_date),
      driver_wage_advance: driverWageAdvance,
      trip_road_cash_float: tripRoadCashFloat,
      actual_diesel_cost: actualDieselCost,
      actual_diesel_liters: actualDieselLiters,
      actual_fastag_cost: actualFastagCost,
      actual_operating_outflow: actualOperatingOutflow
    };
  });

  const truckMap = {};
  parsedTrips.forEach((pt) => {
    const v = pt.vehicle_number;
    if (!truckMap[v]) {
      truckMap[v] = {
        vehicle_number: v,
        trips: [],
        total_driver_wage_advance: 0,
        total_road_cash_float: 0,
        total_diesel: 0,
        total_fastag: 0,
        total_operating_outflow: 0
      };
    }
    truckMap[v].trips.push(pt);
    truckMap[v].total_driver_wage_advance += pt.driver_wage_advance;
    truckMap[v].total_road_cash_float += pt.trip_road_cash_float;
    truckMap[v].total_diesel += pt.actual_diesel_cost;
    truckMap[v].total_fastag += pt.actual_fastag_cost;
    truckMap[v].total_operating_outflow += pt.actual_operating_outflow;
  });

  const truckList = Object.values(truckMap).sort((a, b) => b.total_operating_outflow - a.total_operating_outflow);

  const filteredTrucks = truckList.filter(trk => 
    trk.vehicle_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeTruckData = selectedTruck ? truckMap[selectedTruck] : null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-6xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
          
          <div className="flex justify-between items-start border-b pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                {selectedTruck && (
                  <button 
                    onClick={() => setSelectedTruck(null)} 
                    className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer" 
                    title="Back to all trucks"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Compass className="h-6 w-6 text-indigo-600" />
                  {selectedTruck ? `Vehicle Running Sheet: ${selectedTruck}` : "Consolidated Vehicle Running Sheet"}
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedTruck ? "Driver Wage Advance (₹3.5/KM) and Trip Road Expense Float are kept strictly separate." : "Truck-wise actual money disbursements."}
              </p>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-4">
            <input 
              type="text" 
              placeholder={selectedTruck ? "Search trips inside this truck..." : "Search by Truck Number (e.g. RJ14...)"} 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* VIEW 1: TRUCK SUMMARY DIRECTORY */}
          {!selectedTruck ? (
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-gray-200 rounded-xl mb-4">
              <table className="w-full text-xs text-left whitespace-nowrap min-w-[850px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-gray-200 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="p-3">Vehicle Number</th>
                    <th className="p-3 text-center">Trips Made</th>
                    <th className="p-3 text-right text-blue-700">Driver Wage Adv (₹3.5/km)</th>
                    <th className="p-3 text-right text-indigo-700">Trip Road Cash Float (₹)</th>
                    <th className="p-3 text-right text-amber-700">Actual Diesel Spent (₹)</th>
                    <th className="p-3 text-right text-emerald-700">Actual FASTag Spent (₹)</th>
                    <th className="p-3 text-right text-slate-900 bg-slate-200/50">Operating Outflow (₹)</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTrucks.map((trk) => (
                    <tr key={trk.vehicle_number} onClick={() => { setSelectedTruck(trk.vehicle_number); setSearchTerm(''); }} className="hover:bg-indigo-50/50 cursor-pointer transition group">
                      <td className="p-3 font-black text-slate-900 text-sm group-hover:text-indigo-600 transition">{trk.vehicle_number}</td>
                      <td className="p-3 text-center font-bold text-gray-600">
                        <span className="bg-slate-100 group-hover:bg-indigo-100 text-slate-700 group-hover:text-indigo-800 px-2.5 py-1 rounded-full text-[11px]">
                          {trk.trips.length} {trk.trips.length === 1 ? 'Trip' : 'Trips'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-blue-700">₹{trk.total_driver_wage_advance.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-indigo-700">₹{trk.total_road_cash_float.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-amber-700">₹{trk.total_diesel.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{trk.total_fastag.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-slate-900 bg-slate-50/60">₹{trk.total_operating_outflow.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-bold text-indigo-600 group-hover:underline flex items-center justify-center gap-1">
                          View Trips <ArrowRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            // VIEW 2: TRIPS FOR SELECTED TRUCK
            <div className="flex-1 overflow-x-auto overflow-y-auto border border-gray-200 rounded-xl mb-4 flex flex-col">
              <table className="w-full text-xs text-left whitespace-nowrap min-w-[900px]">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-gray-200 uppercase tracking-wider sticky top-0">
                  <tr>
                    <th className="p-3">Tracking / Route</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right text-blue-700">Driver Wage Adv (₹3.5/km)</th>
                    <th className="p-3 text-right text-indigo-700">Trip Road Float (₹)</th>
                    <th className="p-3 text-right text-amber-700">Actual Diesel (₹)</th>
                    <th className="p-3 text-right text-emerald-700">Actual FASTag (₹)</th>
                    <th className="p-3 text-right text-slate-900 bg-slate-200/50">Operating Outflow (₹)</th>
                    <th className="p-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeTruckData?.trips.map((t) => (
                    <tr key={t.trip_id} className="hover:bg-slate-50 transition">
                      <td className="p-3">
                        <button onClick={() => setSelectedTripForReceipt(t.rawTrip)} className="font-bold text-blue-600 hover:underline">
                          {t.tracking_number}
                        </button>
                        <span className="text-[11px] text-gray-500 block">{t.route}</span>
                      </td>
                      <td className="p-3 text-gray-600">{t.date}</td>
                      <td className="p-3 text-right font-bold text-blue-700">₹{t.driver_wage_advance.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-indigo-700">₹{t.trip_road_cash_float.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-amber-700">₹{t.actual_diesel_cost.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">₹{t.actual_fastag_cost.toFixed(2)}</td>
                      <td className="p-3 text-right font-black text-slate-900 bg-slate-50/60">₹{t.actual_operating_outflow.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setSelectedTripForReceipt(t.rawTrip)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-[11px] font-bold">
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between items-center border-t pt-3">
            {selectedTruck ? (
              <button onClick={() => setSelectedTruck(null)} className="text-xs font-bold text-indigo-600 flex items-center gap-1.5 cursor-pointer">
                <ArrowLeft className="h-4 w-4" /> Back to Truck Directory
              </button>
            ) : <span />}
            <button onClick={onClose} className="px-5 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer">Close</button>
          </div>
        </div>
      </div>

      <ReadOnlyReceiptModal 
        isOpen={Boolean(selectedTripForReceipt)} 
        onClose={() => setSelectedTripForReceipt(null)}
        tripSummary={selectedTripForReceipt}
      />
    </>
  );
}

// --- MAIN DASHBOARD PAGE ---
function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showTravelSheetModal, setShowTravelSheetModal] = useState(false);

  const [stats, setStats] = useState({ 
    activeTrucks: 0, 
    availableTrucks: 0, 
    totalDrivers: 0, 
    activeTrips: 0, 
    pendingPods: 0 
  });
  const [allTripsList, setAllTripsList] = useState([]);
  const [recentTrips, setRecentTrips] = useState([]);
  const [expiringDrivers, setExpiringDrivers] = useState([]);

  // Date Filtering States
  const [exportType, setExportType] = useState('finance_ledger'); 
  const [customStatus, setCustomStatus] = useState('All');
  const [dateFilterMode, setDateFilterMode] = useState('range');
  const [filterStartDate, setFilterStartDate] = useState('2026-08-01');
  const [filterEndDate, setFilterEndDate] = useState('2026-08-10');
  const [filterSingleDate, setFilterSingleDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('2026-08');

  const [exportCols, setExportCols] = useState({
    tracking_number: true, 
    trip_start_date: true, 
    vehicle_number: true, 
    route: true, 
    party_name: true, 
    freight_amount: true, 
    balance_payment: true, 
    diesel_needed: true, 
    diesel_left: true, 
    fastag_est: true, 
    fastag_act: true, 
    actual_fuel_consumed: true, 
    refuels: true, 
    thefts: true
  });

  const colLabels = {
    tracking_number: "Tracking No", 
    trip_start_date: "Launch Date", 
    vehicle_number: "Vehicle",
    route: "Route (Src -> Dest)", 
    party_name: "Party Name", 
    freight_amount: "Total Freight",
    balance_payment: "Pending Balance", 
    diesel_needed: "Diesel Needed (Est)", 
    diesel_left: "Diesel Left (Taabi)", 
    fastag_est: "Fastag Est (Rs)", 
    fastag_act: "Fastag Actual (Rs)", 
    actual_fuel_consumed: "Actual Consumed (L)", 
    refuels: "Total Refuel Vol (L)", 
    thefts: "Total Stolen Vol (L)"
  };

  useEffect(() => { 
    fetchDashboardData(); 
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [assetsRes, driversRes, activeTripsRes, allTripsRes, expiringRes] = await Promise.all([
        axios.get(`${API_BASE}/assets`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/drivers`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/trips/active`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/trips/all`).catch(() => ({ data: [] })),
        axios.get(`${API_BASE}/drivers/expiring-licenses`).catch(() => ({ data: [] }))
      ]);

      const assets = Array.isArray(assetsRes.data) ? assetsRes.data : [];
      const drivers = Array.isArray(driversRes.data) ? driversRes.data : [];
      const activeTrips = Array.isArray(activeTripsRes.data) ? activeTripsRes.data : [];
      const allTrips = Array.isArray(allTripsRes.data) ? allTripsRes.data : [];

      setStats({ 
        activeTrucks: assets.filter(a => a.current_status === 'In-Transit').length, 
        availableTrucks: assets.filter(a => a.current_status === 'Available').length, 
        totalDrivers: drivers.length, 
        activeTrips: activeTrips.length, 
        pendingPods: activeTrips.filter(t => t.pod_status === 'Pending' || !t.pod_status).length 
      });
      setAllTripsList(allTrips);
      setRecentTrips([...activeTrips].reverse().slice(0, 5));
      if (Array.isArray(expiringRes.data)) setExpiringDrivers(expiringRes.data);
    } catch (e) { 
      console.error("Dashboard fetch error:", e); 
    } finally { 
      setLoading(false); 
    }
  };

  const applyDateAndStatusFilters = (trips, active, history) => {
    let target = trips;
    if (customStatus === 'Active') target = active;
    if (customStatus === 'Completed') target = history;

    if (dateFilterMode === 'range' && filterStartDate && filterEndDate) {
      target = target.filter(t => {
        const d = (t.trip_start_date || '').slice(0, 10);
        return d >= filterStartDate && d <= filterEndDate;
      });
    } else if (dateFilterMode === 'single' && filterSingleDate) {
      target = target.filter(t => (t.trip_start_date || '').slice(0, 10) === filterSingleDate);
    } else if (dateFilterMode === 'month' && filterMonth) {
      target = target.filter(t => (t.trip_start_date || '').slice(0, 7) === filterMonth);
    }
    return target;
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const [activeRes, historyRes, assetsRes] = await Promise.all([
        axios.get(`${API_BASE}/trips/active`),
        axios.get(`${API_BASE}/trips/history`),
        axios.get(`${API_BASE}/assets`)
      ]);
      const active = activeRes.data || [];
      const history = historyRes.data || [];
      const assets = assetsRes.data || [];
      const allTrips = [...active, ...history].map(trip => {
        const asset = assets.find(a => a.vehicle_number === trip.vehicle_number);
        return { ...trip, driver_name: asset?.driver_name || 'Unknown', mileage: asset?.mileage || 5.5 };
      });
      const targetTrips = applyDateAndStatusFilters(allTrips, active, history);
      if (targetTrips.length === 0) {
        alert("No trips found for the selected period!");
        setLoading(false);
        return;
      }
      const dateSuffix = dateFilterMode === 'range' ? `${filterStartDate}_to_${filterEndDate}` : 'all';
      let filename = `Report_${exportType}_${dateSuffix}.csv`;
      const csvData = targetTrips.map((trip, idx) => ({
        'SR': idx + 1, 'VEH': trip.vehicle_number || '-', 'LOADING DATE': formatDate(trip.trip_start_date),
        'PARTY': trip.party_name || '-', 'FROM': trip.source_city || '-', 'TO': trip.destination_city || '-',
        'TOTAL KMS': trip.total_km || 0, 'FREIGHT': trip.freight_amount || 0, 'BALANCE': trip.balance_payment || 0
      }));
      const headers = Object.keys(csvData[0]).join(',');
      const rows = csvData.map(r => Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      setShowExportModal(false);
    } catch (err) {
      alert("Export failed.");
    } finally {
      setLoading(false);
    }
  };

  const getPreviewData = () => {
    if (exportType === 'finance_ledger') {
      return {
        headers: ['SR', 'VEH', 'LOADING DATE', 'PARTY', 'FROM', 'TO', 'TOTAL KMS', 'M LOCATION', 'STATUS', 'YSD KMS', 'REASON', 'adv', 'ICICI'],
        rows: [['1', 'RJ14-8674', '20-08-2026', 'MAHAVEERA', 'BANGALORE', 'DURG', '1450', 'JAIPUR', 'RUNNING', '412.5', '', '5075', '']]
      };
    }
    if (exportType === 'detailed') {
      return {
        headers: ['DATE', 'FROM', 'TO', 'VEHICLE NO', 'PARTY', 'OWNER NAME', 'FREIGHT', 'UNLOADING', 'HOLDING', 'GST', 'TOTAL FREIGHT', 'ADVANCE', 'ADVANCE DATE', 'TDS', 'EXTRA DEDUCTION', 'BALANCE', 'POD RECEIVED DATE', 'GTA', 'L R NO.', 'EWAY BILL & DATE'],
        rows: [['02-04-2026', 'BHIWADI', 'JAIPUR', '8674', 'GODREJ', 'JFC (A)', '17000', '3060', '0', '0', '20060.00', '10000 + 9720', '21-05-2026, 25-05-2026', '340', '0', '0', '04-04-2026', 'JFC', '1520', '8483728193 (Exp: 05-04-2026)']]
      };
    }
    if (exportType === 'today') {
      return {
        headers: ['SR', 'VEHICLE', 'LAUNCH DATE', 'FROM', 'TO', 'PARTY', 'FREIGHT', 'STATUS', 'LOCATION'],
        rows: [['1', 'RJ14GQ2305', '01-08-2026', 'JAIPUR', 'DELHI', 'GODREJ', '25000', 'RUNNING', 'JAIPUR']]
      };
    }
    if (exportType === 'party') {
      return {
        headers: ['Client Name', 'Total Trips', 'Active', 'Completed', 'Business (Rs)', 'Pending (Rs)', 'Status'],
        rows: [['GODREJ INDUSTRIES', '45', '2', '43', '850,000.00', '45,000.00', 'Payment Pending']]
      };
    }
    if (exportType === 'driver') {
      return {
        headers: ['Driver Name', 'Total Trips', 'Total KM Driven', 'Total Pay Calculated (Rs)', 'Pending Settlement (Rs)', 'Status'],
        rows: [['Rajesh Singh', '12', '14500', '65250.00', '14500.00', 'Unpaid Dues']]
      };
    }
    if (exportType === 'custom') {
      const headers = Object.keys(exportCols).filter(k => exportCols[k]).map(k => colLabels[k]);
      const row = [];
      if (exportCols.tracking_number) row.push('RJ14-GODR-020426-1');
      if (exportCols.trip_start_date) row.push('02-04-2026');
      if (exportCols.vehicle_number) row.push('RJ14-8674');
      if (exportCols.route) row.push('BHIWADI to JAIPUR');
      if (exportCols.party_name) row.push('GODREJ');
      if (exportCols.freight_amount) row.push('17000');
      if (exportCols.balance_payment) row.push('0');
      if (exportCols.diesel_needed) row.push('150');
      if (exportCols.actual_fuel_consumed) row.push('145.2');
      if (exportCols.refuels) row.push('200');
      if (exportCols.thefts) row.push('0');
      if (exportCols.diesel_left) row.push('250.5');
      if (exportCols.fastag_est) row.push('1725');
      if (exportCols.fastag_act) row.push('1800');
      return { headers, rows: [row] };
    }
    return { headers: [], rows: [] };
  };

  const preview = getPreviewData();

  const kpiCards = [
    { title: "Active Trucks", value: stats.activeTrucks, subtext: `${stats.availableTrucks} Available`, icon: Truck, path: "/fleet", color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Total Drivers", value: stats.totalDrivers, subtext: "Registered Fleet", icon: Users, path: "/driver-history", color: "text-slate-600", bg: "bg-slate-100" },
    { title: "Active Trips", value: stats.activeTrips, subtext: "Currently En Route", icon: MapPin, path: "/trips", color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Pending PODs", value: stats.pendingPods, subtext: "Requires Action", icon: Receipt, path: "/trips", color: "text-rose-600", bg: "bg-rose-50", alert: stats.pendingPods > 0 },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Overview</h1>
          <p className="text-sm text-gray-500 mt-1">Live metrics from your database</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => setShowReconcileModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm">
            <FileSpreadsheet className="h-4 w-4" /> Upload Statement
          </button>
          <button onClick={() => setShowTravelSheetModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm">
            <Compass className="h-4 w-4" /> Vehicle Travel Sheet
          </button>
          <button onClick={() => setShowExportModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm">
            <FileSpreadsheet className="h-4 w-4" /> Reports & Excel Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <div key={idx} onClick={() => navigate(kpi.path)} className="bg-white p-5 rounded-xl border border-gray-200 cursor-pointer transition hover:shadow-sm flex flex-col justify-between h-32">
            <div className="flex items-start justify-between">
              <div className="text-sm font-medium text-gray-500">{kpi.title}</div>
              <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}><kpi.icon className="h-4 w-4" /></div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{kpi.value}</div>
              <div className="text-xs font-medium mt-1 text-gray-400">{kpi.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-semibold text-gray-800">Recent Active Trips</h3>
          <button onClick={() => navigate('/trips')} className="text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 cursor-pointer">
            View All <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {recentTrips.length > 0 ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-white text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-3">Tracking No.</th>
                <th className="px-6 py-3">Vehicle</th>
                <th className="px-6 py-3">Route</th>
                <th className="px-6 py-3">Client</th>
                <th className="px-6 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentTrips.map((trip) => (
                <tr key={trip.trip_id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-medium text-blue-600">{trip.tracking_number}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900">{trip.vehicle_number}</td>
                  <td className="px-6 py-4 text-gray-600">{trip.source_city} → {trip.destination_city}</td>
                  <td className="px-6 py-4 text-gray-600">{trip.party_name || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                      {trip.tracking_status || 'In-Transit'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-10 text-center text-gray-500">No active trips currently in the system.</div>
        )}
      </div>

      <MultiOptionReconcileModal isOpen={showReconcileModal} onClose={() => setShowReconcileModal(false)} onSyncComplete={fetchDashboardData} />
      <TravelSheetModal isOpen={showTravelSheetModal} onClose={() => setShowTravelSheetModal(false)} trips={allTripsList} />

      {/* 🌟 EXPORT REPORT MODAL WITH DEDICATED X TO Y DATE RANGE CONTROLS */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200 h-[88vh] md:h-[660px]">

            {/* Left Column: Layout Formats */}
            <div className="w-full md:w-1/3 bg-gray-50 border-r border-gray-200 p-5 flex flex-col gap-2 overflow-y-auto">
              <h3 className="font-bold text-gray-900 mb-2 uppercase text-xs tracking-wider">Select Layout Format</h3>
              {[
                { id: 'finance_ledger', icon: Navigation, title: "Finance Ledger (Blue)", desc: "Operational sheet with editable blank columns" },
                { id: 'detailed', icon: Table, title: "Detailed Ledger (Orange)", desc: "Complete financial ledger matching the orange sheet" },
                { id: 'today', icon: FileText, title: "Activity Summary", desc: "Trips launched/delivered in selected date range" },
                { id: 'party', icon: BriefcaseBusiness, title: "Client Master Ledger", desc: "Client-wise balances for the selected period" },
                { id: 'driver', icon: Users, title: "Driver Settlement", desc: "Driver remaining pay & KM logs" },
                { id: 'custom', icon: Settings2, title: "Custom Telemetry", desc: "Select specific columns to export" }
              ].map(opt => (
                <div 
                  key={opt.id} 
                  onClick={() => setExportType(opt.id)} 
                  className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start gap-3 ${exportType === opt.id ? 'border-emerald-500 bg-emerald-50/50 shadow-sm' : 'border-transparent hover:bg-gray-100 text-gray-600'}`}
                >
                  <opt.icon className={`h-5 w-5 mt-0.5 ${exportType === opt.id ? 'text-emerald-600' : 'text-gray-400'}`}/>
                  <div>
                    <div className={`font-bold text-sm ${exportType === opt.id ? 'text-emerald-900' : 'text-gray-700'}`}>{opt.title}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right Column: Configuration & Date Selection */}
            <div className="w-full md:w-2/3 p-6 flex flex-col justify-between bg-white overflow-y-auto">
              <div>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600"/> Report Configuration
                  </h2>
                  <button 
                    onClick={() => setShowExportModal(false)} 
                    className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Status Selection */}
                <div className="mb-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                    1. Filter Rows to Export
                  </label>
                  <select 
                    className="w-full border border-gray-300 rounded-lg p-2.5 text-xs font-bold outline-none cursor-pointer bg-white" 
                    value={customStatus} 
                    onChange={e => setCustomStatus(e.target.value)}
                  >
                    <option value="All">Export All Database Records</option>
                    <option value="Active">Export Only Active / Running Trips</option>
                    <option value="Completed">Export Only Completed / Delivered Trips</option>
                  </select>
                </div>

                {/* 🌟 2. DATE FILTERING CONTROLS (X TO Y RANGE) */}
                <div className="mb-5 bg-emerald-50/40 p-4 rounded-xl border border-emerald-200">
                  <label className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 block">
                    <Calendar className="h-4 w-4 text-emerald-700" />
                    2. Select Date Period (Print from X to Y)
                  </label>

                  {/* Mode Buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { id: 'range', label: 'From Date X to Y' },
                      { id: 'all', label: 'All Dates' },
                      { id: 'single', label: 'Single Date' },
                      { id: 'month', label: 'Specific Month' }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setDateFilterMode(m.id)}
                        className={`p-2 rounded-lg text-center font-bold text-xs border transition cursor-pointer ${dateFilterMode === m.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Range Picker (e.g. 1 August to 10 August) */}
                  {dateFilterMode === 'range' && (
                    <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in">
                      <div>
                        <label className="font-bold text-gray-700 block mb-1 text-[11px]">From Date (Start)</label>
                        <input 
                          type="date" 
                          value={filterStartDate} 
                          onChange={e => setFilterStartDate(e.target.value)} 
                          className="w-full border border-emerald-300 rounded-lg p-2 text-xs font-bold bg-white text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500" 
                        />
                      </div>
                      <div>
                        <label className="font-bold text-gray-700 block mb-1 text-[11px]">To Date (End)</label>
                        <input 
                          type="date" 
                          value={filterEndDate} 
                          onChange={e => setFilterEndDate(e.target.value)} 
                          className="w-full border border-emerald-300 rounded-lg p-2 text-xs font-bold bg-white text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500" 
                        />
                      </div>
                    </div>
                  )}

                  {/* Single Date Picker */}
                  {dateFilterMode === 'single' && (
                    <div className="pt-1 animate-in fade-in">
                      <label className="font-bold text-gray-700 block mb-1 text-[11px]">Select Date</label>
                      <input 
                        type="date" 
                        value={filterSingleDate} 
                        onChange={e => setFilterSingleDate(e.target.value)} 
                        className="w-full border border-emerald-300 rounded-lg p-2 text-xs font-bold bg-white text-slate-800 outline-none" 
                      />
                    </div>
                  )}

                  {/* Specific Month Picker */}
                  {dateFilterMode === 'month' && (
                    <div className="pt-1 animate-in fade-in">
                      <label className="font-bold text-gray-700 block mb-1 text-[11px]">Select Month (YYYY-MM)</label>
                      <input 
                        type="month" 
                        value={filterMonth} 
                        onChange={e => setFilterMonth(e.target.value)} 
                        className="w-full border border-emerald-300 rounded-lg p-2 text-xs font-bold bg-white text-slate-800 outline-none" 
                      />
                    </div>
                  )}

                  {dateFilterMode === 'all' && (
                    <p className="text-[11px] text-gray-500 italic mt-1">Exporting all historical records without date boundaries.</p>
                  )}
                </div>

                {/* Custom Columns selection if Custom layout is chosen */}
                {exportType === 'custom' && (
                  <div className="mb-4 animate-in fade-in">
                    <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 block">
                      3. Select Columns to Include
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Object.keys(exportCols).map(key => (
                        <label key={key} className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 bg-gray-50 hover:bg-emerald-50 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="h-4 w-4 rounded text-emerald-600 cursor-pointer" 
                            checked={exportCols[key]} 
                            onChange={(e) => setExportCols({...exportCols, [key]: e.target.checked})} 
                          />
                          <span className="text-[11px] font-semibold text-gray-700">{colLabels[key]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview */}
                <div className="border border-emerald-200 rounded-lg overflow-hidden shadow-sm bg-white animate-in fade-in mb-4">
                  <div className="bg-emerald-50/50 border-b border-emerald-100 px-3 py-2 flex items-center justify-between">
                    <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <Table className="h-4 w-4" /> Live Format Preview
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase bg-emerald-100 px-2 py-0.5 rounded">
                      Sample Headers
                    </span>
                  </div>
                  <div className="overflow-x-auto max-w-full">
                    <table className="w-full text-left whitespace-nowrap text-[11px] font-mono">
                      <thead className="bg-gray-100 border-b border-gray-200 text-gray-700">
                        <tr>
                          {preview.headers.map((h, i) => (
                            <th key={i} className="p-2 border-r border-gray-200 font-bold bg-slate-200/50">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-blue-50/50 transition">
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="p-2 border-r border-gray-100 border-b border-gray-100 text-gray-600">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Bottom Footer with Active Date Tag and Export Button */}
              <div className="pt-4 border-t flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl">
                  {dateFilterMode === 'range' && filterStartDate && filterEndDate ? (
                    `Range: ${formatDate(filterStartDate)} → ${formatDate(filterEndDate)}`
                  ) : dateFilterMode === 'single' && filterSingleDate ? (
                    `Date: ${formatDate(filterSingleDate)}`
                  ) : dateFilterMode === 'month' && filterMonth ? (
                    `Month: ${filterMonth}`
                  ) : (
                    "All Historical Dates"
                  )}
                </span>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowExportModal(false)} 
                    className="px-5 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={generateReport} 
                    className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>} 
                    Download Excel (CSV)
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;