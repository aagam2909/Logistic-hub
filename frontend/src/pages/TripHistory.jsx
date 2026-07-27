import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, Printer, CheckCircle2, X, Edit, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

const Badge = ({ active, label }) => (
  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
    {active ? '✓' : '✗'} {label}
  </span>
);

function TripHistory() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [statusFilter, setStatusFilter] = useState('all');

  const [statusModal, setStatusModal] = useState({ 
    isOpen: false, trip: null, originalTrip: null, trip_unloaded: false, amount_cleared: false, 
    pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '', pod_received_client_date: ''
  });

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
      originalTrip: trip, // Stores original saved data to lock past dates
      trip_unloaded: trip.trip_unloaded || false,
      amount_cleared: trip.amount_cleared || false,
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
        amount_cleared: statusModal.amount_cleared,
        pod_status: statusModal.pod_status,
        pod_arrived_office_date: statusModal.pod_arrived_office_date || null,
        pod_forwarded_client_date: statusModal.pod_forwarded_client_date || null,
        pod_received_client_date: statusModal.pod_received_client_date || null
      });
      alert("Status Updated Successfully!");
      setStatusModal({ isOpen: false, trip: null, originalTrip: null, trip_unloaded: false, amount_cleared: false, pod_status: 'Pending', pod_arrived_office_date: '', pod_forwarded_client_date: '', pod_received_client_date: '' });
      fetchHistory();
    } catch (err) {
      alert("Failed to update status.");
    }
  };

  // --- FILTER & SORT LOGIC ---
  let processedTrips = trips.filter(trip => 
    (trip.tracking_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.vehicle_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.party_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.source_city || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (trip.destination_city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Apply Status Filters
  if (statusFilter === 'pending_amount') {
    processedTrips = processedTrips.filter(t => !t.amount_cleared);
  } else if (statusFilter === 'pending_pod') {
    processedTrips = processedTrips.filter(t => t.pod_status !== 'Client Received');
  } else if (statusFilter === 'not_unloaded') {
    processedTrips = processedTrips.filter(t => !t.trip_unloaded);
  }

  // Apply Sort
  if (sortBy === 'newest') {
    processedTrips.sort((a, b) => new Date(b.actual_delivery_date || b.trip_start_date) - new Date(a.actual_delivery_date || a.trip_start_date));
  } else if (sortBy === 'oldest') {
    processedTrips.sort((a, b) => new Date(a.actual_delivery_date || a.trip_start_date) - new Date(b.actual_delivery_date || b.trip_start_date));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER & ANALYTICS SUMMARY */}
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

      {/* SEARCH, FILTER, & SORT TOOLBAR */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
         <div className="relative w-full md:flex-1 md:max-w-md">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
           <input 
             type="text" 
             placeholder="Search tracking, vehicle, party, or city..." 
             value={searchTerm} 
             onChange={e => setSearchTerm(e.target.value)} 
             className="w-full border border-gray-200 rounded-lg p-2.5 pl-9 text-sm focus:ring-2 focus:ring-slate-100 outline-none" 
           />
         </div>

         <div className="flex flex-wrap items-center gap-3">
           <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
               <Filter className="h-4 w-4 text-gray-500" />
               <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-sm focus:outline-none text-slate-700 font-semibold cursor-pointer"
               >
                  <option value="all">All Statuses</option>
                  <option value="pending_amount">⚠️ Pending Amount</option>
                  <option value="pending_pod">⚠️ Pending POD (Client)</option>
                  <option value="not_unloaded">⚠️ Not Unloaded</option>
               </select>
           </div>

           <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-slate-100 outline-none text-slate-700 font-medium cursor-pointer bg-white"
           >
              <option value="newest">Sort by: Latest Delivery</option>
              <option value="oldest">Sort by: Oldest Delivery</option>
           </select>
         </div>
      </div>
      
      {/* COMPLETED TRIPS TABLE */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm border border-gray-200">
        {loading ? (
          <p className="p-10 text-center text-gray-500 font-medium">Loading completed trips...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="p-4">Tracking No. / LR</th>
                <th className="p-4">Vehicle & Party</th>
                <th className="p-4">Route & Date</th>
                <th className="p-4">Checklist Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedTrips.map((trip) => (
                <tr key={trip.trip_id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <Link to={`/trip-details/${trip.trip_id}`} className="text-blue-600 font-bold hover:text-blue-800 hover:underline transition">
                      {trip.tracking_number}
                    </Link>
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
                    <div className="flex flex-col gap-1.5 items-start">
                        <Badge active={trip.trip_unloaded} label="Unloaded" />
                        <Badge active={trip.amount_cleared} label="Amount Cleared" />
                        <Badge active={trip.pod_status === 'Client Received'} label={trip.pod_status || 'POD Pending'} />
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <Link 
                          to={`/trip-details/${trip.trip_id}`}
                          className="w-28 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" /> View Bill
                        </Link>
                        <button 
                          onClick={() => openStatusModal(trip)}
                          className="w-28 flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-bold text-xs shadow-sm transition cursor-pointer"
                        >
                          <Edit className="h-3.5 w-3.5" /> Update Status
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!processedTrips.length && (
                <tr>
                  <td className="p-12 text-center text-gray-500" colSpan="6">
                    No completed trips found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* UPDATE STATUS MODAL */}
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
                   <input 
                      type="checkbox" 
                      className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" 
                      checked={statusModal.trip_unloaded} 
                      onChange={e => setStatusModal({...statusModal, trip_unloaded: e.target.checked})} 
                   />
                   <span className="font-bold text-slate-800 text-sm">Trip Unloaded</span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:border-blue-300 transition">
                   <input 
                      type="checkbox" 
                      className="h-5 w-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer" 
                      checked={statusModal.amount_cleared} 
                      onChange={e => setStatusModal({...statusModal, amount_cleared: e.target.checked})} 
                   />
                   <span className="font-bold text-slate-800 text-sm">Amount Cleared</span>
                </label>

                {/* ADVANCED POD TRACKING WITHIN CHECKLIST */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex flex-col gap-3 mt-2">
                    <label className="font-bold text-blue-900 text-sm">POD Tracking Stage</label>
                    <select 
                       className="border border-blue-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-400 outline-none w-full bg-white font-semibold text-slate-700 cursor-pointer"
                       value={statusModal.pod_status}
                       onChange={e => setStatusModal({...statusModal, pod_status: e.target.value})}
                    >
                       <option value="Pending">Pending (Not received yet)</option>
                       <option value="Received">Received at Office</option>
                       <option value="Forwarded">Forwarded to Party</option>
                       <option value="Client Received">Received by Party</option>
                    </select>

                    <div className="space-y-2 mt-1">
                        {/* Office Arrival Date */}
                        {['Received', 'Forwarded', 'Client Received'].includes(statusModal.pod_status) && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Office Arrival:</span>
                               {statusModal.originalTrip?.pod_arrived_office_date ? (
                                   <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                       ✓ {statusModal.originalTrip.pod_arrived_office_date}
                                   </span>
                               ) : (
                                   <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_arrived_office_date} onChange={e => setStatusModal({...statusModal, pod_arrived_office_date: e.target.value})} />
                               )}
                            </div>
                        )}
                        
                        {/* Forwarded to Party Date */}
                        {['Forwarded', 'Client Received'].includes(statusModal.pod_status) && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Forwarded:</span>
                               {statusModal.originalTrip?.pod_forwarded_client_date ? (
                                   <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                       ✓ {statusModal.originalTrip.pod_forwarded_client_date}
                                   </span>
                               ) : (
                                   <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_forwarded_client_date} onChange={e => setStatusModal({...statusModal, pod_forwarded_client_date: e.target.value})} />
                               )}
                            </div>
                        )}
                        
                        {/* Received by Party Date */}
                        {statusModal.pod_status === 'Client Received' && (
                            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                               <span className="text-xs font-semibold text-gray-600">Client Received:</span>
                               {statusModal.originalTrip?.pod_received_client_date ? (
                                   <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                                       ✓ {statusModal.originalTrip.pod_received_client_date}
                                   </span>
                               ) : (
                                   <input type="date" className="border border-gray-300 rounded p-1 text-xs text-gray-700 outline-none focus:border-blue-400" value={statusModal.pod_received_client_date} onChange={e => setStatusModal({...statusModal, pod_received_client_date: e.target.value})} />
                               )}
                            </div>
                        )}
                    </div>
                </div>

             </div>

             <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setStatusModal({isOpen: false, trip: null})} className="px-4 py-2 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 text-sm cursor-pointer">Cancel</button>
                <button onClick={handleUpdateStatus} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold text-sm shadow-sm transition cursor-pointer">Save Status</button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default TripHistory;