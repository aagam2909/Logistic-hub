import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, Printer, CheckCircle2, X, Edit, AlertCircle, CheckCircle, FileSignature, Lock } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

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

  const [statusModal, setStatusModal] = useState({ 
    isOpen: false, trip: null, originalTrip: null, trip_unloaded: false, 
    cleared_amount: '', cleared_date: '',
    pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '', pod_received_client_date: ''
  });

  const [editLogisticsModal, setEditLogisticsModal] = useState({ isOpen: false, tripData: null });

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/trips/history`);
      setTrips(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching trip history:', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const openStatusModal = (trip) => {
    setStatusModal({
      isOpen: true,
      trip: trip,
      originalTrip: trip,
      trip_unloaded: trip.trip_unloaded || false,
      cleared_amount: '', 
      cleared_date: new Date().toISOString().split('T')[0], 
      pod_status: trip.pod_status || 'Pending',
      pod_arrived_office_date: trip.pod_arrived_office_date || '',
      pod_forwarded_client_date: trip.pod_forwarded_client_date || '',
      pod_received_client_date: trip.pod_received_client_date || ''
    });
  };

  const handleUpdateStatus = async () => {
    try {
      await axios.put(`${API_BASE}/finances/${statusModal.trip.trip_id}/checklist`, {
        trip_unloaded: statusModal.trip_unloaded,
        amount_cleared: false, 
        cleared_amount: parseFloat(statusModal.cleared_amount) || 0,
        cleared_date: statusModal.cleared_date || null,
        pod_status: statusModal.pod_status,
        pod_arrived_office_date: statusModal.pod_arrived_office_date || null,
        pod_forwarded_client_date: statusModal.pod_forwarded_client_date || null,
        pod_received_client_date: statusModal.pod_received_client_date || null
      });
      alert("Status Updated Successfully!");
      setStatusModal({ isOpen: false, trip: null, originalTrip: null, trip_unloaded: false, cleared_amount: '', cleared_date: '', pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '', pod_received_client_date: '' });
      fetchHistory();
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  const handleUpdateLockedEdit = async () => {
    if (!window.confirm("⚠️ WARNING: This is a ONE-TIME edit. Once saved, this trip will be permanently locked. Are you absolutely sure?")) return;
    try {
      await axios.put(`${API_BASE}/trips/${editLogisticsModal.tripData.trip_id}/locked-edit`, editLogisticsModal.tripData);
      alert("Trip Info Updated and Permanently Locked! 🔒");
      setEditLogisticsModal({ isOpen: false, tripData: null });
      fetchHistory();
    } catch (err) { 
      alert(err.response?.data?.detail || "Failed to update trip info."); 
    }
  };

  let processedTrips = trips.filter(trip => 
    (trip.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.party_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.source_city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.destination_city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (statusFilter === 'pending_amount') {
    processedTrips = processedTrips.filter(t => parseFloat(t.balance_payment || 0) > 0);
  } else if (statusFilter === 'pending_pod') {
    processedTrips = processedTrips.filter(t => t.pod_status !== 'Client Received');
  } else if (statusFilter === 'not_unloaded') {
    processedTrips = processedTrips.filter(t => !t.trip_unloaded);
  } else if (statusFilter === 'fully_complete') {
    processedTrips = processedTrips.filter(t => t.trip_unloaded && parseFloat(t.balance_payment || 0) <= 0 && t.pod_status === 'Client Received');
  }

  if (sortBy === 'newest') {
    processedTrips.sort((a, b) => new Date(b.actual_delivery_date || b.trip_start_date) - new Date(a.actual_delivery_date || a.trip_start_date));
  } else if (sortBy === 'oldest') {
    processedTrips.sort((a, b) => new Date(a.actual_delivery_date || a.trip_start_date) - new Date(b.actual_delivery_date || b.trip_start_date));
  }

  const pendingBalance = parseFloat(statusModal.trip?.balance_payment ?? statusModal.trip?.freight_amount ?? 0);

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
                {processedTrips.map((trip) => {
                  
                  const balance = parseFloat(trip.balance_payment ?? trip.freight_amount ?? 0);
                  const isFullyPaid = balance <= 0;
                  const isPartiallyPaid = !isFullyPaid && parseFloat(trip.adv_amt || 0) > 0;
                  const isFullyComplete = trip.trip_unloaded && isFullyPaid && trip.pod_status === 'Client Received';

                  return (
                    <tr key={trip.trip_id} className={`transition-colors ${isFullyComplete ? 'bg-emerald-50/20 hover:bg-emerald-50/50' : 'hover:bg-gray-50'}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                           <Link to={`/trip-details/${trip.trip_id}`} className="text-blue-600 font-bold hover:text-blue-800 hover:underline transition">
                             {trip.tracking_number}
                           </Link>
                           
                           {/* DYNAMIC LOCK ICON */}
                           {trip.is_locked ? (
                               <button disabled className="text-gray-300 cursor-not-allowed" title="Trip is Permanently Locked">
                                 <Lock className="h-3.5 w-3.5" />
                               </button>
                           ) : (
                               <button onClick={() => setEditLogisticsModal({isOpen: true, tripData: trip})} className="text-amber-500 hover:text-amber-700 transition" title="One-Time Final Edit">
                                 <FileSignature className="h-3.5 w-3.5" />
                               </button>
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
                            <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-black w-max shadow-sm">
                               <CheckCircle className="h-4 w-4" />
                               FULLY COMPLETE
                            </div>
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
                            <Link to={`/trip-details/${trip.trip_id}`} className="w-28 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition cursor-pointer">
                              <Printer className="h-3.5 w-3.5" /> View Bill
                            </Link>
                            <button onClick={() => openStatusModal(trip)} className="w-28 flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition cursor-pointer">
                              <Edit className="h-3.5 w-3.5" /> Update Status
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

      {/* UPDATE STATUS MODAL (Unchanged) */}
      {statusModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-5 animate-in fade-in zoom-in-95">
             <div className="flex justify-between items-center border-b pb-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><AlertCircle className="h-5 w-5 text-blue-600"/> Update Status</h3>
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
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 p-2 rounded-lg text-center block w-full mt-1 border border-emerald-200">
                                ✓ Balance is fully paid.
                            </span>
                        ) : (
                            <>
                              <div className="flex gap-2">
                                  <input type="number" placeholder="Amount Received (₹)" className="w-full border border-gray-300 rounded p-2 text-sm text-gray-700 outline-none focus:border-blue-400 font-bold" value={statusModal.cleared_amount} onChange={e => setStatusModal({...statusModal, cleared_amount: e.target.value})} />
                                  <input type="date" className="w-full border border-gray-300 rounded p-2 text-sm text-gray-700 outline-none focus:border-blue-400" value={statusModal.cleared_date} onChange={e => setStatusModal({...statusModal, cleared_date: e.target.value})} />
                              </div>
                            </>
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
                               {statusModal.originalTrip?.pod_arrived_office_date ? (
                                   <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✓ {statusModal.originalTrip.pod_arrived_office_date}</span>
                               ) : <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_arrived_office_date} onChange={e => setStatusModal({...statusModal, pod_arrived_office_date: e.target.value})} />}
                            </div>
                        )}
                        {['Forwarded', 'Client Received'].includes(statusModal.pod_status) && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Forwarded:</span>
                               {statusModal.originalTrip?.pod_forwarded_client_date ? (
                                   <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✓ {statusModal.originalTrip.pod_forwarded_client_date}</span>
                               ) : <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_forwarded_client_date} onChange={e => setStatusModal({...statusModal, pod_forwarded_client_date: e.target.value})} />}
                            </div>
                        )}
                        {statusModal.pod_status === 'Client Received' && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Client Received:</span>
                               {statusModal.originalTrip?.pod_received_client_date ? (
                                   <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">✓ {statusModal.originalTrip.pod_received_client_date}</span>
                               ) : <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_received_client_date} onChange={e => setStatusModal({...statusModal, pod_received_client_date: e.target.value})} />}
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

      {/* ONE-TIME FINAL EDIT MODAL */}
      {editLogisticsModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-5 border-b bg-rose-50">
               <div>
                   <h3 className="font-bold text-lg text-rose-900 flex items-center gap-2"><AlertCircle className="h-5 w-5"/> Final One-Time Edit</h3>
                   <p className="text-xs text-rose-700 font-semibold mt-0.5">You can only edit this completed trip ONCE. Review all details carefully.</p>
               </div>
               <button onClick={() => setEditLogisticsModal({isOpen: false, tripData: null})} className="p-2 hover:bg-rose-100 rounded-lg text-rose-500 transition cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 h-[60vh] overflow-y-auto bg-gray-50">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Vehicle Number</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.vehicle_number} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, vehicle_number: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Launch Date</label>
                    <input type="date" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.trip_start_date || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, trip_start_date: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Source City</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.source_city} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, source_city: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Destination City</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.destination_city} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, destination_city: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Party Name</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.party_name || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, party_name: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Owner Name</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.owner_name || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, owner_name: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">GTA Name</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.gta_name || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, gta_name: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">LR / Bilty No</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.lr_no || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, lr_no: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">E-Way Bill</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.eway_bill || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, eway_bill: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">E-Way Bill Expiry</label>
                    <input type="date" className="w-full border border-gray-300 p-2.5 rounded-lg text-sm text-gray-500 bg-white" value={editLogisticsModal.tripData.eway_bill_expiry || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, eway_bill_expiry: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Estimated Route KM</label>
                    <input type="number" className="w-full border border-blue-300 p-2.5 rounded-lg text-sm bg-blue-50 font-bold" value={editLogisticsModal.tripData.total_km || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, total_km: e.target.value}})} />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Rough Freight (₹)</label>
                    <input type="number" className="w-full border border-emerald-300 p-2.5 rounded-lg text-sm bg-emerald-50 font-bold" value={editLogisticsModal.tripData.freight_amount || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, freight_amount: e.target.value}})} />
                </div>
                <div className="space-y-1 md:col-span-3">
                    <label className="text-xs font-semibold text-gray-600">L/W Details</label>
                    <input className="w-full border border-gray-300 p-2.5 rounded-lg text-sm bg-white" value={editLogisticsModal.tripData.lw || ''} onChange={e => setEditLogisticsModal({isOpen: true, tripData: {...editLogisticsModal.tripData, lw: e.target.value}})} />
                </div>
            </div>
            
            <div className="p-5 border-t bg-white flex justify-end gap-3">
               <button onClick={() => setEditLogisticsModal({isOpen: false, tripData: null})} className="px-5 py-2.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer">Cancel</button>
               <button onClick={handleUpdateLockedEdit} className="bg-rose-600 hover:bg-rose-700 text-white px-8 py-2.5 rounded-lg font-bold shadow-sm transition cursor-pointer flex items-center gap-2">
                 <AlertCircle className="h-4 w-4"/> Permanently Save & Lock
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TripHistory;