import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, FileUp, PlusCircle, X, Printer, Save } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

const API_BASE = import.meta.env.VITE_API_URL;

const StatusTag = ({ status, deliveryDate }) => {
  if (deliveryDate) return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Completed</span>;
  if (status === 'Received') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">POD Received</span>;
  if (status === 'Forwarded') return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Forwarded</span>;
  return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Pending / In-Transit</span>;
};

function Trips() {
  const [activeTrips, setActiveTrips] = useState([]);
  const [availableTrucks, setAvailableTrucks] = useState([]);
  const [parties, setParties] = useState([]);
  const [podFiles, setPodFiles] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  
  const [tripData, setTripData] = useState({
    vehicle_number: '', source_city: '', destination_city: '', party_name: '', 
    gta_name: '', lr_no: '', eway_bill: '', eway_bill_expiry: '', trip_start_date: '', lw: ''
  });
  
  const [podUpdate, setPodUpdate] = useState({ 
    trip_id: '', pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '' 
  });

  // --- NEW: FINANCE RECEIPT MODAL STATE ---
  const [receiptModal, setReceiptModal] = useState({ isOpen: false, trip: null });
  const [finance, setFinance] = useState({ freight_amount: 0, adv_amt: 0, expenses: 0, tds: 0, finance_remarks: '' });
  
  // FIX APPLIED HERE FOR REACT-TO-PRINT V3
  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  useEffect(() => { fetchTrips(); fetchAvailableTrucks(); fetchParties(); }, []);

  const fetchTrips = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trips/active`);
      setActiveTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) { setActiveTrips([]); }
  };

  const fetchAvailableTrucks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/assets`);
      setAvailableTrucks(Array.isArray(res.data) ? res.data.filter(t => t.current_status !== 'In-Transit' && t.current_status !== 'Archived') : []);
    } catch (err) { setAvailableTrucks([]); }
  };

  const fetchParties = async () => {
    try { 
        const res = await axios.get(`${API_BASE}/parties`);
        setParties(Array.isArray(res.data) ? res.data.filter(Boolean) : []);
    } catch (err) { setParties([]); }
  };

  const handleAddTrip = async () => {
    if (!tripData.vehicle_number.trim() || !tripData.source_city.trim() || !tripData.destination_city.trim()) {
      return alert("Please fill in the mandatory fields: Truck Number, Source, and Destination!");
    }
    const tripPayload = {
      ...tripData,
      trip_start_date: tripData.trip_start_date || new Date().toISOString().slice(0, 10),
    };
    try {
      await axios.post(`${API_BASE}/trips`, tripPayload);
      alert("Trip Launched Successfully! 🚀");
      setTripData({ vehicle_number: '', source_city: '', destination_city: '', party_name: '', gta_name: '', lr_no: '', eway_bill: '', eway_bill_expiry: '', trip_start_date: '', lw: ''});
      fetchTrips(); fetchParties(); fetchAvailableTrucks();
    } catch (err) { 
      const errorData = err.response?.data?.detail;
      const errorMsg = Array.isArray(errorData) ? errorData[0].msg : errorData;
      alert(`Error: ${errorMsg || "Failed to launch trip."}`); 
    }
  };

  const handleUpdatePOD = async () => {
    if (!podUpdate.trip_id) return alert("Please select a trip first!");
    try {
      await axios.put(`${API_BASE}/finances/${podUpdate.trip_id}/pod`, podUpdate);
      alert("POD Details Updated!");
      fetchTrips();
    } catch (err) { alert("Update failed."); }
  };

  const handleCompleteTrip = async (trip_id) => {
    if (!podFiles[trip_id]) return alert("Select a POD file first!");
    try {
        const formData = new FormData(); formData.append("file", podFiles[trip_id]);
        await axios.post(`${API_BASE}/upload-pod`, formData);
        await axios.put(`${API_BASE}/trips/${trip_id}/complete`, { actual_delivery_date: new Date().toISOString().split('T')[0] });
        alert("POD Uploaded & Trip Completed!");
        fetchTrips(); fetchAvailableTrucks();
    } catch (err) { alert("Failed."); }
  };

  // --- NEW: FINANCE RECEIPT LOGIC ---
  const openReceiptModal = async (trip) => {
    try {
      const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trip.tracking_number)}`);
      const tripData = res.data.trip || res.data;
      
      setFinance({
        freight_amount: tripData.freight_amount || 0,
        adv_amt: tripData.adv_amt || 0,
        expenses: tripData.expenses || 0,
        tds: tripData.tds || 0,
        finance_remarks: tripData.finance_remarks || ''
      });
      setReceiptModal({ isOpen: true, trip: tripData });
    } catch (err) { alert("Error loading trip finance details"); }
  };

  const calculatePending = () => {
    const total = parseFloat(finance.freight_amount || 0);
    const deductions = parseFloat(finance.adv_amt || 0) + parseFloat(finance.expenses || 0) + parseFloat(finance.tds || 0);
    return (total - deductions).toFixed(2);
  };

  const handleSaveFinance = async () => {
    try {
      await axios.post(`${API_BASE}/finances/calculate`, { ...finance, trip_id: receiptModal.trip.trip_id });
      alert("Finance Record Saved Successfully!");
    } catch (err) { alert("Error saving record."); }
  };

  const filteredTrips = activeTrips.filter(t => 
    (t.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.party_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 relative">
      
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><PlusCircle className="text-blue-500"/> Launch New Trip</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input className="border p-2.5 rounded-lg text-sm" list="available-trucks" placeholder="Search truck number *" value={tripData.vehicle_number} onChange={e => setTripData({...tripData, vehicle_number: e.target.value})} />
          <datalist id="available-trucks">{availableTrucks.map(t => <option key={t.vehicle_number} value={t.vehicle_number} />)}</datalist>
          <input className="border p-2.5 rounded-lg text-sm" placeholder="Source *" value={tripData.source_city} onChange={e => setTripData({...tripData, source_city: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" placeholder="Destination *" value={tripData.destination_city} onChange={e => setTripData({...tripData, destination_city: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" list="party-names" placeholder="Party name (Optional)" value={tripData.party_name} onChange={e => setTripData({...tripData, party_name: e.target.value})} />
          <datalist id="party-names">{parties.map(p => <option key={p} value={p} />)}</datalist>
          
          <input className="border p-2.5 rounded-lg text-sm" placeholder="GTA Name (Optional)" value={tripData.gta_name} onChange={e => setTripData({...tripData, gta_name: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" placeholder="LR No (Optional)" value={tripData.lr_no} onChange={e => setTripData({...tripData, lr_no: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm text-gray-500" type="date" placeholder="E-Way Bill Expiry Date" value={tripData.eway_bill_expiry} onChange={e => setTripData({...tripData, eway_bill_expiry: e.target.value})} title="E-Way Bill Expiry Date" />
          <input className="border p-2.5 rounded-lg text-sm text-gray-500" type="date" placeholder="Launch Date" value={tripData.trip_start_date} onChange={e => setTripData({...tripData, trip_start_date: e.target.value})} title="Launch Date" />
          
          <input className="border p-2.5 rounded-lg text-sm lg:col-span-3" placeholder="L/W Details (Optional)" value={tripData.lw} onChange={e => setTripData({...tripData, lw: e.target.value})} />
          <button onClick={handleAddTrip} className="bg-blue-600 text-white p-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm">Launch Route 🚀</button>
        </div>
      </section>

      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileUp className="text-blue-500"/> POD Tracking & Management</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <input className="w-full border p-2.5 rounded-lg text-sm" list="pod-trip-numbers" placeholder="Search trip ID for POD update..." value={podUpdate.trip_id} onChange={(e) => setPodUpdate({...podUpdate, trip_id: e.target.value})} />
            <datalist id="pod-trip-numbers">{activeTrips.map(t => <option key={t.trip_id} value={t.trip_id} label={t.tracking_number || t.trip_id} />)}</datalist>
          </div>
          <input className="border p-2.5 rounded-lg text-sm w-40" list="pod-statuses" placeholder="Status" value={podUpdate.pod_status} onChange={(e) => setPodUpdate({...podUpdate, pod_status: e.target.value})} />
          <datalist id="pod-statuses"><option value="Pending" /><option value="Received" /><option value="Forwarded" /></datalist>
          <input type="date" className="border p-2.5 rounded-lg text-sm text-gray-500" title="Office Arrival Date" onChange={(e) => setPodUpdate({...podUpdate, pod_arrived_office_date: e.target.value})} />
          <input type="date" className="border p-2.5 rounded-lg text-sm text-gray-500" title="Forwarded to Client Date" onChange={(e) => setPodUpdate({...podUpdate, pod_forwarded_client_date: e.target.value})} />
          <button onClick={handleUpdatePOD} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm">Update POD</button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-2xl border shadow-sm">
           <h2 className="text-xl font-bold">Active Trips List</h2>
           <div className="relative w-72">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
             <input type="text" placeholder="Search trips..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-lg p-2 pl-9 text-sm focus:ring-2 focus:ring-blue-100 outline-none" />
           </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b text-gray-600 font-semibold">
              <tr>
                <th className="p-4">Trip / Tracking No.</th>
                <th className="p-4">Route</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4">POD Status</th>
                <th className="p-4">Upload File</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTrips.map(trip => (
                <tr key={trip.trip_id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <a href={`/trip-details/${trip.trip_id}`} className="text-blue-600 font-semibold hover:underline transition">{trip.tracking_number || `Trip #${trip.trip_id}`}</a>
                    <div className="text-xs text-gray-500 mt-1">{trip.party_name || '-'}</div>
                  </td>
                  <td className="p-4 font-medium text-gray-700">{trip.source_city} → {trip.destination_city}</td>
                  <td className="p-4 font-bold text-slate-800">{trip.vehicle_number}</td>
                  <td className="p-4"><StatusTag status={trip.pod_status} deliveryDate={trip.actual_delivery_date} /></td>
                  <td className="p-4">
                    <input type="file" className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition cursor-pointer" onChange={(e) => setPodFiles({...podFiles, [trip.trip_id]: e.target.files[0]})} />
                  </td>
                  
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                        <button onClick={() => openReceiptModal(trip)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-800 shadow-sm text-xs transition flex items-center justify-center gap-1">
                            <Printer className="h-3 w-3"/> Receipt
                        </button>
                        <button onClick={() => handleCompleteTrip(trip.trip_id)} className="bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-50 shadow-sm text-xs transition">
                            Complete
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredTrips.length && <tr><td colSpan="6" className="p-8 text-center text-gray-500">No active trips found matching your search.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
               <div>
                  <h3 className="font-bold text-lg text-slate-800">Financial Settlement & Receipt</h3>
                  <p className="text-xs text-gray-500">Update ledger details or print professional receipt</p>
               </div>
               <button onClick={() => setReceiptModal({isOpen: false, trip: null})} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition">
                  <X className="h-5 w-5" />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
               <div ref={receiptRef} className="bg-white p-10 mx-auto shadow-sm border border-gray-200 rounded-xl max-w-3xl">
                  
                  <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
                      <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">JAIN FREIGHT CARRIERS</h1>
                        <p className="text-gray-500 mt-1 font-medium text-sm">Logistics & Transportation Services</p>
                      </div>
                      <div className="text-right">
                        <h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2>
                        <p className="text-sm font-semibold text-gray-500 mt-1">TRK: {receiptModal.trip.tracking_number}</p>
                      </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{receiptModal.trip.trip_start_date || '-'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-base">{receiptModal.trip.vehicle_number}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{receiptModal.trip.source_city} → {receiptModal.trip.destination_city}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Delivery Date:</span> <span className="font-bold">{receiptModal.trip.actual_delivery_date || 'Pending'}</span></div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{receiptModal.trip.party_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{receiptModal.trip.gta_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{receiptModal.trip.lr_no || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">E-Way Bill:</span> <span className="font-bold">{receiptModal.trip.eway_bill || 'N/A'}</span></div>
                      </div>
                  </div>

                  <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      
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
                      
                      <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30 print:border-2 print:bg-transparent">
                          <span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span>
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
            </div>

            <div className="p-5 border-t bg-white flex justify-end gap-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
               <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-lg font-bold transition">
                 <Printer className="h-5 w-5"/> Print Receipt
               </button>
               <button onClick={handleSaveFinance} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-sm transition">
                 <Save className="h-5 w-5"/> Save Financial Ledger
               </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

export default Trips;