import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, FileUp, PlusCircle, X, Printer, Save, Edit, Filter, Trash2 } from 'lucide-react';
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
  const [owners, setOwners] = useState([]);
  const [podFiles, setPodFiles] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest'); 
  
  const [tripData, setTripData] = useState({
    vehicle_number: '', source_city: '', destination_city: '', party_name: '', owner_name: '',
    gta_name: '', lr_no: '', eway_bill: '', eway_bill_expiry: '', trip_start_date: '', lw: '', freight_amount: '', total_km: ''
  });
  
  const [podUpdate, setPodUpdate] = useState({ 
    trip_id: '', pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '' 
  });

  const [receiptModal, setReceiptModal] = useState({ isOpen: false, trip: null });
  const [editModal, setEditModal] = useState({ isOpen: false, tripData: null });

  const [activeCharges, setActiveCharges] = useState({ loading: false, holding: false, gst: false, bill_no: false });

  const [finance, setFinance] = useState({ 
    freight_amount: 0, tds: 0, finance_remarks: '',
    loading_charge: 0, gst: 0, holding_charge: 0, extra_deduction: 0,
    total_km: 0, driver_advance: 0, driver_remaining: 0, driver_total: 0,
    advance_details: [{ date: '', amount: '' }], bill_no: ''
  });
  
  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  useEffect(() => { fetchTrips(); fetchAvailableTrucks(); fetchParties(); fetchOwners(); }, []);

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

  const fetchOwners = async () => {
    try { 
        const res = await axios.get(`${API_BASE}/owners`);
        setOwners(Array.isArray(res.data) ? res.data.filter(Boolean) : []);
    } catch (err) { setOwners([]); }
  };

  const uniqueSources = [...new Set(activeTrips.map(t => t.source_city).filter(Boolean))];
  const uniqueDestinations = [...new Set(activeTrips.map(t => t.destination_city).filter(Boolean))];
  const uniqueGtas = [...new Set(activeTrips.map(t => t.gta_name).filter(Boolean))];

  const handleAddTrip = async () => {
    if (!tripData.vehicle_number.trim() || !tripData.source_city.trim() || !tripData.destination_city.trim()) {
      return alert("Please fill in the mandatory fields: Truck Number, Source, and Destination!");
    }
    const tripPayload = {
      ...tripData,
      trip_start_date: tripData.trip_start_date || new Date().toISOString().slice(0, 10),
      freight_amount: parseFloat(tripData.freight_amount) || 0,
      total_km: parseFloat(tripData.total_km) || 0
    };
    try {
      await axios.post(`${API_BASE}/trips`, tripPayload);
      alert("Trip Launched Successfully! 🚀");
      setTripData({ vehicle_number: '', source_city: '', destination_city: '', party_name: '', owner_name: '', gta_name: '', lr_no: '', eway_bill: '', eway_bill_expiry: '', trip_start_date: '', lw: '', freight_amount: '', total_km: ''});
      fetchTrips(); fetchParties(); fetchAvailableTrucks(); fetchOwners();
    } catch (err) { alert("Failed to launch trip."); }
  };

  const handleUpdateTrip = async () => {
    try {
      await axios.put(`${API_BASE}/trips/${editModal.tripData.trip_id}`, editModal.tripData);
      alert("Trip Updated Successfully!");
      setEditModal({ isOpen: false, tripData: null });
      fetchTrips();
    } catch (err) { alert("Failed to update trip."); }
  };

  const handleUpdatePOD = async () => {
    if (!podUpdate.trip_id) return alert("Please select a trip first!");
    try {
      await axios.put(`${API_BASE}/finances/${podUpdate.trip_id}/pod`, podUpdate);
      alert("POD Details Updated!");
      fetchTrips();
    } catch (err) { alert("Update failed."); }
  };

  const handleCompleteTrip = async (trip) => {
    const currentBalance = parseFloat(trip.balance_payment || 0);
    if (currentBalance !== 0) {
        return alert(`⚠️ CANNOT COMPLETE TRIP.\n\nThe Net Balance Payable is currently ₹${currentBalance}.\nYou must settle the ledger to exactly ₹0 before completing the trip.`);
    }

    try {
        let podPath = null;
        if (podFiles[trip.trip_id]) {
            const formData = new FormData(); 
            formData.append("file", podFiles[trip.trip_id]);
            const uploadRes = await axios.post(`${API_BASE}/upload-pod`, formData);
            podPath = uploadRes.data.path;
        }

        await axios.put(`${API_BASE}/trips/${trip.trip_id}/complete`, { 
            actual_delivery_date: new Date().toISOString().split('T')[0],
            pod_image_path: podPath
        });
        
        alert("Trip Completed Successfully!");
        fetchTrips(); fetchAvailableTrucks();
    } catch (err) { alert("Failed to complete trip."); }
  };

  const handleForceDelete = async (trip_id, tracking_number) => {
    if (window.confirm(`🚨 DANGER: Are you sure you want to FORCE DELETE trip ${tracking_number}?\n\nThis will completely erase the route and its financial ledger. This action CANNOT be undone.`)) {
        try {
            await axios.delete(`${API_BASE}/trips/${trip_id}`);
            alert("Trip has been permanently deleted.");
            fetchTrips(); fetchAvailableTrucks();
        } catch (err) { alert("Failed to delete trip."); }
    }
  };

  const openReceiptModal = async (trip) => {
    try {
      const res = await axios.get(`${API_BASE}/track/${encodeURIComponent(trip.tracking_number)}`);
      const tripData = res.data.trip || res.data;
      
      const parsedAdvances = tripData.advance_details 
          ? (typeof tripData.advance_details === 'string' ? JSON.parse(tripData.advance_details) : tripData.advance_details)
          : [];

      setFinance({
        freight_amount: tripData.freight_amount || 0,
        loading_charge: tripData.loading_charge || 0,
        gst: tripData.gst || 0,
        holding_charge: tripData.holding_charge || 0,
        tds: tripData.tds || 0,
        extra_deduction: tripData.extra_deduction || 0,
        finance_remarks: tripData.finance_remarks || '',
        total_km: tripData.total_km || 0,
        driver_advance: tripData.driver_advance || 0,
        driver_remaining: tripData.driver_remaining || 0,
        driver_total: tripData.driver_total || 0,
        advance_details: parsedAdvances.length > 0 ? parsedAdvances : [{ date: '', amount: '' }],
        bill_no: tripData.bill_no || ''
      });

      setActiveCharges({
        loading: parseFloat(tripData.loading_charge || 0) > 0,
        holding: parseFloat(tripData.holding_charge || 0) > 0,
        gst: parseFloat(tripData.gst || 0) > 0,
        bill_no: !!tripData.bill_no
      });
      
      setReceiptModal({ isOpen: true, trip: tripData });
    } catch (err) { alert("Error loading trip finance details."); }
  };

  const handleFinanceChange = (field, value, customActiveCharges = activeCharges) => {
    let newFinance = { ...finance };
    if (field !== 'TOGGLE_ACTIVE') newFinance[field] = value;

    if (['freight_amount', 'loading_charge', 'holding_charge', 'TOGGLE_ACTIVE'].includes(field)) {
        const freight = parseFloat(newFinance.freight_amount || 0);
        const loading = customActiveCharges.loading ? parseFloat(newFinance.loading_charge || 0) : 0;
        const holding = customActiveCharges.holding ? parseFloat(newFinance.holding_charge || 0) : 0;
        newFinance.gst = ((freight + loading + holding) * 0.18).toFixed(2);
    }
    setFinance(newFinance);
  };

  const toggleCharge = (chargeName) => {
    const newActive = { ...activeCharges, [chargeName]: !activeCharges[chargeName] };
    setActiveCharges(newActive);
    handleFinanceChange('TOGGLE_ACTIVE', null, newActive);
  };

  const handleAdvanceChange = (index, field, value) => {
    const newAdvances = [...finance.advance_details];
    newAdvances[index][field] = value;
    setFinance({ ...finance, advance_details: newAdvances });
  };
  const addAdvanceRow = () => {
    setFinance({ ...finance, advance_details: [...finance.advance_details, { date: '', amount: '' }] });
  };
  const removeAdvanceRow = (index) => {
    const newAdvances = finance.advance_details.filter((_, i) => i !== index);
    setFinance({ ...finance, advance_details: newAdvances });
  };

  const calculatePending = () => {
    const loading = activeCharges.loading ? parseFloat(finance.loading_charge || 0) : 0;
    const holding = activeCharges.holding ? parseFloat(finance.holding_charge || 0) : 0;
    const gst = activeCharges.gst ? parseFloat(finance.gst || 0) : 0;
    const totalAdv = finance.advance_details.reduce((sum, adv) => sum + parseFloat(adv.amount || 0), 0);
    
    const additions = parseFloat(finance.freight_amount || 0) + loading + gst + holding;
    const deductions = totalAdv + parseFloat(finance.tds || 0) + parseFloat(finance.extra_deduction || 0);
    return (additions - deductions).toFixed(2);
  };

  const handleKmChange = (e) => {
    const km = parseFloat(e.target.value) || 0;
    setFinance({
      ...finance,
      total_km: km,
      driver_advance: km * 3.5,
      driver_remaining: km * 1.0,
      driver_total: km * 4.5
    });
  };

  const handleSaveFinance = async () => {
    try {
      const payload = {
        ...finance,
        loading_charge: activeCharges.loading ? finance.loading_charge : 0,
        holding_charge: activeCharges.holding ? finance.holding_charge : 0,
        gst: activeCharges.gst ? finance.gst : 0,
        bill_no: activeCharges.bill_no ? finance.bill_no : '',
        trip_id: receiptModal.trip.trip_id
      };
      await axios.post(`${API_BASE}/finances/calculate`, payload);
      alert("Finance Record Saved Successfully!");
      fetchTrips(); 
    } catch (err) { alert("Error saving record."); }
  };

  let processedTrips = activeTrips.filter(t => 
    (t.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.party_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (sortBy === 'newest') {
      processedTrips.sort((a, b) => new Date(b.trip_start_date) - new Date(a.trip_start_date));
  } else if (sortBy === 'oldest') {
      processedTrips.sort((a, b) => new Date(a.trip_start_date) - new Date(b.trip_start_date));
  } else if (sortBy === 'advance-pending') {
      processedTrips = processedTrips.filter(t => parseFloat(t.freight_amount) > 0 && parseFloat(t.adv_amt || 0) === 0);
  }

  return (
    <div className="space-y-8 relative">
      
      {/* LAUNCH NEW TRIP SECTION */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><PlusCircle className="text-slate-700"/> Launch New Trip</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <input className="border p-2.5 rounded-lg text-sm" list="available-trucks" placeholder="Search truck number *" value={tripData.vehicle_number} onChange={e => setTripData({...tripData, vehicle_number: e.target.value})} />
          <datalist id="available-trucks">{availableTrucks.map(t => <option key={t.vehicle_number} value={t.vehicle_number} />)}</datalist>
          
          <input className="border p-2.5 rounded-lg text-sm" list="source-cities" placeholder="Source *" value={tripData.source_city} onChange={e => setTripData({...tripData, source_city: e.target.value})} />
          <datalist id="source-cities">{uniqueSources.map(c => <option key={c} value={c} />)}</datalist>
          
          <input className="border p-2.5 rounded-lg text-sm" list="dest-cities" placeholder="Destination *" value={tripData.destination_city} onChange={e => setTripData({...tripData, destination_city: e.target.value})} />
          <datalist id="dest-cities">{uniqueDestinations.map(c => <option key={c} value={c} />)}</datalist>

          <input className="border p-2.5 rounded-lg text-sm" list="party-names" placeholder="Party name (Optional)" value={tripData.party_name} onChange={e => setTripData({...tripData, party_name: e.target.value})} />
          <datalist id="party-names">{parties.map(p => <option key={p} value={p} />)}</datalist>
          
          {/* OWNER NAME INPUT WITH DROPDOWN */}
          <input className="border p-2.5 rounded-lg text-sm" list="owner-names" placeholder="Owner Name (Optional)" value={tripData.owner_name} onChange={e => setTripData({...tripData, owner_name: e.target.value})} />
          <datalist id="owner-names">{owners.map(o => <option key={o} value={o} />)}</datalist>
          
          <input className="border p-2.5 rounded-lg text-sm" list="gta-names" placeholder="GTA Name (Optional)" value={tripData.gta_name} onChange={e => setTripData({...tripData, gta_name: e.target.value})} />
          <datalist id="gta-names">{uniqueGtas.map(g => <option key={g} value={g} />)}</datalist>
          
          <input className="border p-2.5 rounded-lg text-sm" placeholder="LR No (Optional)" value={tripData.lr_no} onChange={e => setTripData({...tripData, lr_no: e.target.value})} />
          
          <input className="border p-2.5 rounded-lg text-sm" type="number" placeholder="Estimated Route KM" value={tripData.total_km} onChange={e => setTripData({...tripData, total_km: e.target.value})} />
          <input className="border p-2.5 rounded-lg text-sm" type="number" placeholder="Rough Freight (₹)" value={tripData.freight_amount} onChange={e => setTripData({...tripData, freight_amount: e.target.value})} />
          
          <input className="border p-2.5 rounded-lg text-sm text-gray-500" type="date" placeholder="Launch Date" value={tripData.trip_start_date} onChange={e => setTripData({...tripData, trip_start_date: e.target.value})} title="Launch Date" />
          <input className="border p-2.5 rounded-lg text-sm text-gray-500" type="date" placeholder="E-Way Bill Expiry Date" value={tripData.eway_bill_expiry} onChange={e => setTripData({...tripData, eway_bill_expiry: e.target.value})} title="E-Way Bill Expiry Date" />
          
          <input className="border p-2.5 rounded-lg text-sm lg:col-span-3" placeholder="L/W Details (Optional)" value={tripData.lw} onChange={e => setTripData({...tripData, lw: e.target.value})} />
          
          <button onClick={handleAddTrip} className="bg-slate-900 text-white p-2.5 rounded-lg font-bold hover:bg-slate-800 transition shadow-sm">Launch Route 🚀</button>
        </div>
      </section>

      {/* POD TRACKING SECTION */}
      <section className="bg-white p-6 rounded-2xl shadow-sm border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FileUp className="text-slate-700"/> POD Tracking & Management</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <input className="w-full border p-2.5 rounded-lg text-sm" list="pod-trip-numbers" placeholder="Search trip ID for POD update..." value={podUpdate.trip_id} onChange={(e) => setPodUpdate({...podUpdate, trip_id: e.target.value})} />
            <datalist id="pod-trip-numbers">{activeTrips.map(t => <option key={t.trip_id} value={t.trip_id} label={t.tracking_number || t.trip_id} />)}</datalist>
          </div>
          <input className="border p-2.5 rounded-lg text-sm w-40" list="pod-statuses" placeholder="Status" value={podUpdate.pod_status} onChange={(e) => setPodUpdate({...podUpdate, pod_status: e.target.value})} />
          <datalist id="pod-statuses"><option value="Pending" /><option value="Received" /><option value="Forwarded" /></datalist>
          <input type="date" className="border p-2.5 rounded-lg text-sm text-gray-500" title="Office Arrival Date" onChange={(e) => setPodUpdate({...podUpdate, pod_arrived_office_date: e.target.value})} />
          <input type="date" className="border p-2.5 rounded-lg text-sm text-gray-500" title="Forwarded to Client Date" onChange={(e) => setPodUpdate({...podUpdate, pod_forwarded_client_date: e.target.value})} />
          
          <button onClick={handleUpdatePOD} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-slate-800 transition shadow-sm">Update POD</button>
        </div>
      </section>

      {/* ACTIVE TRIPS LIST */}
      <section className="space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-2xl border shadow-sm">
           <h2 className="text-xl font-bold text-slate-800">Active Trips List</h2>
           <div className="flex items-center gap-3">
             <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <select 
                   value={sortBy} 
                   onChange={(e) => setSortBy(e.target.value)}
                   className="border rounded-lg p-2 pl-9 pr-8 text-sm focus:ring-2 focus:ring-slate-100 outline-none text-slate-700 font-medium cursor-pointer appearance-none bg-white"
                >
                   <option value="newest">Latest Launch Date</option>
                   <option value="oldest">Oldest Launch Date</option>
                   <option value="advance-pending">Advance Pending ⚠️</option>
                </select>
             </div>
             
             <div className="relative w-72">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
               <input type="text" placeholder="Search tracking, truck, or party..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border rounded-lg p-2 pl-9 text-sm focus:ring-2 focus:ring-slate-100 outline-none" />
             </div>
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
              {processedTrips.map(trip => (
                <tr key={trip.trip_id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <a href={`/trip-details/${trip.trip_id}`} className="text-slate-800 font-semibold hover:underline transition">{trip.tracking_number || `Trip #${trip.trip_id}`}</a>
                    <div className="text-xs text-gray-500 mt-1">{trip.party_name || '-'} {trip.owner_name ? `(Owner: ${trip.owner_name})` : ''}</div>
                  </td>
                  <td className="p-4 font-medium text-gray-700">{trip.source_city} → {trip.destination_city}</td>
                  <td className="p-4 font-bold text-slate-800">{trip.vehicle_number}</td>
                  <td className="p-4"><StatusTag status={trip.pod_status} deliveryDate={trip.actual_delivery_date} /></td>
                  <td className="p-4">
                    <input type="file" className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 transition cursor-pointer" onChange={(e) => setPodFiles({...podFiles, [trip.trip_id]: e.target.files[0]})} />
                  </td>
                  
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button onClick={() => setEditModal({isOpen: true, tripData: trip})} className="flex-1 bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-100 shadow-sm text-xs transition flex items-center justify-center gap-1 border border-slate-200">
                                <Edit className="h-3 w-3"/> Edit
                            </button>
                            <button onClick={() => handleForceDelete(trip.trip_id, trip.tracking_number)} className="bg-rose-50 text-rose-600 px-3 py-1.5 rounded-lg font-semibold hover:bg-rose-100 shadow-sm text-xs transition flex items-center justify-center border border-rose-200" title="Force Delete Trip">
                                <Trash2 className="h-3 w-3"/>
                            </button>
                        </div>
                        <button onClick={() => openReceiptModal(trip)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-slate-800 shadow-sm text-xs transition flex items-center justify-center gap-1">
                            <Printer className="h-3 w-3"/> Receipt
                        </button>
                        <button onClick={() => handleCompleteTrip(trip)} className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold hover:bg-emerald-100 shadow-sm text-xs transition">
                            Complete Trip
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!processedTrips.length && <tr><td colSpan="6" className="p-8 text-center text-gray-500">No active trips found matching your search or filter.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* EXPANDED EDIT TRIP MODAL */}
      {editModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
               <h3 className="font-bold text-lg text-slate-800">Edit Trip: {editModal.tripData.tracking_number}</h3>
               <button onClick={() => setEditModal({isOpen: false, tripData: null})} className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 h-96 overflow-y-auto">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Vehicle</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm bg-gray-100" value={editModal.tripData.vehicle_number} disabled />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Launch Date</label>
                    <input type="date" className="w-full border p-2.5 rounded-lg text-sm" value={editModal.tripData.trip_start_date || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, trip_start_date: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Source</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" list="source-cities" value={editModal.tripData.source_city} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, source_city: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Destination</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" list="dest-cities" value={editModal.tripData.destination_city} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, destination_city: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Party Name</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" list="party-names" value={editModal.tripData.party_name || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, party_name: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Owner Name</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" list="owner-names" value={editModal.tripData.owner_name || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, owner_name: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">GTA Name</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" list="gta-names" value={editModal.tripData.gta_name || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, gta_name: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">LR / Bilty No</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" value={editModal.tripData.lr_no || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, lr_no: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">E-Way Bill</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" value={editModal.tripData.eway_bill || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, eway_bill: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Estimated Route KM</label>
                    <input type="number" className="w-full border p-2.5 rounded-lg text-sm" value={editModal.tripData.total_km || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, total_km: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Rough Freight (₹)</label>
                    <input type="number" className="w-full border p-2.5 rounded-lg text-sm" value={editModal.tripData.freight_amount || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, freight_amount: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">E-Way Bill Expiry</label>
                    <input type="date" className="w-full border p-2.5 rounded-lg text-sm text-gray-500" value={editModal.tripData.eway_bill_expiry || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, eway_bill_expiry: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">L/W Details</label>
                    <input className="w-full border p-2.5 rounded-lg text-sm" value={editModal.tripData.lw || ''} onChange={e => setEditModal({isOpen: true, tripData: {...editModal.tripData, lw: e.target.value}})} />
                </div>
            </div>
            <div className="p-5 border-t bg-white flex justify-end gap-3">
               <button onClick={() => setEditModal({isOpen: false, tripData: null})} className="px-5 py-2.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 transition">Cancel</button>
               <button onClick={handleUpdateTrip} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE RECEIPT MODAL */}
      {receiptModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
               <div>
                  <h3 className="font-bold text-lg text-slate-800">Financial Settlement & Receipt</h3>
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
                        {activeCharges.bill_no && finance.bill_no && (
                             <p className="text-sm font-bold text-blue-700 mt-1 uppercase tracking-wide">BILL NO: {finance.bill_no}</p>
                        )}
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
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Owner Name:</span> <span className="font-bold">{receiptModal.trip.owner_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{receiptModal.trip.gta_name || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{receiptModal.trip.lr_no || 'N/A'}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">E-Way Bill:</span> <span className="font-bold">{receiptModal.trip.eway_bill || 'N/A'}</span></div>
                      </div>
                  </div>

                  <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
                  
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                        
                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <label className="text-sm font-semibold text-gray-700">Total Freight (₹)</label>
                          <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.freight_amount} onChange={e => handleFinanceChange('freight_amount', e.target.value)} />
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer hover:text-slate-900">
                            <input type="checkbox" checked={activeCharges.loading} onChange={() => toggleCharge('loading')} className="rounded text-slate-900 focus:ring-slate-900 cursor-pointer print:hidden" />
                            Loading/Unloading (₹)
                          </label>
                          {activeCharges.loading ? (
                              <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.loading_charge} onChange={e => handleFinanceChange('loading_charge', e.target.value)} />
                          ) : (
                              <span className="w-32 text-right text-gray-400 font-medium print:hidden">Excluded</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer hover:text-slate-900">
                            <input type="checkbox" checked={activeCharges.holding} onChange={() => toggleCharge('holding')} className="rounded text-slate-900 focus:ring-slate-900 cursor-pointer print:hidden" />
                            Holding Charge (₹)
                          </label>
                          {activeCharges.holding ? (
                              <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent" type="number" value={finance.holding_charge} onChange={e => handleFinanceChange('holding_charge', e.target.value)} />
                          ) : (
                              <span className="w-32 text-right text-gray-400 font-medium print:hidden">Excluded</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2 bg-slate-50/50 print:bg-transparent px-1 rounded">
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-900 cursor-pointer hover:text-emerald-700">
                            <input type="checkbox" checked={activeCharges.gst} onChange={() => toggleCharge('gst')} className="rounded text-emerald-600 focus:ring-emerald-600 cursor-pointer print:hidden" />
                            GST (18%) (₹)
                          </label>
                          {activeCharges.gst ? (
                              <input className="border p-1.5 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent text-emerald-600" type="number" value={finance.gst} onChange={e => handleFinanceChange('gst', e.target.value)} />
                          ) : (
                              <span className="w-32 text-right text-gray-400 font-medium print:hidden">Excluded</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer hover:text-slate-900">
                            <input type="checkbox" checked={activeCharges.bill_no} onChange={() => toggleCharge('bill_no')} className="rounded text-slate-900 focus:ring-slate-900 cursor-pointer print:hidden" />
                            Bill Number
                          </label>
                          {activeCharges.bill_no ? (
                              <input className="border p-1.5 rounded w-32 font-bold text-blue-700 print:hidden" type="text" placeholder="Enter Bill No" value={finance.bill_no} onChange={e => handleFinanceChange('bill_no', e.target.value)} />
                          ) : (
                              <span className="w-32 text-right text-gray-400 font-medium print:hidden">Excluded</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            Deductions (-)
                        </h4>
                        
                        <div className="border-b border-gray-100 pb-2 mb-2">
                           <div className="flex justify-between items-center mb-2">
                              <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                Advance Received 
                                <button onClick={addAdvanceRow} className="text-blue-600 hover:text-blue-800 print:hidden flex items-center bg-blue-50 px-2 py-0.5 rounded text-xs">
                                   <PlusCircle className="h-3 w-3 mr-1"/> Add
                                </button>
                              </label>
                           </div>
                           
                           {finance.advance_details.map((adv, idx) => (
                              <div key={idx} className="flex justify-between items-center mb-1 gap-2">
                                 <input 
                                    type="date" 
                                    className="border p-1 rounded text-xs text-gray-500 w-[110px] print:border-0 print:p-0 print:text-black font-semibold" 
                                    value={adv.date} 
                                    onChange={e => handleAdvanceChange(idx, 'date', e.target.value)} 
                                 />
                                 <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600 print:border-0 print:p-0 print:bg-transparent" 
                                        value={adv.amount} 
                                        onChange={e => handleAdvanceChange(idx, 'amount', e.target.value)} 
                                        placeholder="₹ Amount" 
                                    />
                                    {idx > 0 && (
                                        <button onClick={() => removeAdvanceRow(idx)} className="text-rose-400 hover:text-rose-600 print:hidden p-1">
                                            <X className="h-4 w-4"/>
                                        </button>
                                    )}
                                 </div>
                              </div>
                           ))}
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                          <label className="text-sm font-semibold text-gray-700">TDS Deduction (₹)</label>
                          <input className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600 print:border-0 print:p-0 print:bg-transparent mr-5 print:mr-0" type="number" value={finance.tds} onChange={e => handleFinanceChange('tds', e.target.value)} />
                        </div>

                        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                          <input className="text-sm font-semibold text-gray-700 border-b border-dashed border-gray-300 w-32 focus:outline-none print:border-none bg-transparent" placeholder="Extra Deduction..." />
                          <input className="border p-1.5 rounded w-[100px] text-right font-bold text-rose-600 print:border-0 print:p-0 print:bg-transparent mr-5 print:mr-0" type="number" value={finance.extra_deduction} onChange={e => handleFinanceChange('extra_deduction', e.target.value)} />
                        </div>
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
                          onChange={e => handleFinanceChange('finance_remarks', e.target.value)} 
                        />
                      </div>
                  </div>

                  <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Driver Settlement (Hisaab)</h3>
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0">
                      
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <label className="text-sm font-semibold text-gray-700">Total KM Traveled</label>
                        <input className="border p-2 rounded w-32 text-right font-bold print:border-0 print:p-0 print:bg-transparent text-slate-700" type="number" value={finance.total_km || ''} onChange={handleKmChange} placeholder="Enter KM" />
                      </div>
                      
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-sm font-semibold text-gray-700">Driver Advance (₹3.5/km)</span>
                        <span className="font-bold text-slate-900">₹{finance.driver_advance || 0}</span>
                      </div>
                      
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-sm font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span>
                        <span className="font-bold text-slate-900">₹{finance.driver_remaining || 0}</span>
                      </div>
                      
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-sm font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span>
                        <span className="font-extrabold text-slate-700">₹{finance.driver_total || 0}</span>
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