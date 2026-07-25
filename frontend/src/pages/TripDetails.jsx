import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useReactToPrint } from 'react-to-print';
import { Printer, ArrowLeft } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;

function TripDetails() {
  const { trip_id } = useParams();
  const navigate = useNavigate();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  const receiptRef = useRef(null);
  const handlePrint = useReactToPrint({ contentRef: receiptRef });

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`${API_BASE}/trips/details/${trip_id}`);
        setTrip(res.data);
      } catch (err) { 
        console.error("Error fetching details:", err); 
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [trip_id]);

  if (loading) return <div className="p-10 text-center text-gray-500 font-medium">Loading Receipt...</div>;
  if (!trip) return <div className="p-10 text-center text-rose-500 font-bold">Trip not found.</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      
      {/* Top Action Bar (Hidden when printing) */}
      <div className="print:hidden flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition">
          <ArrowLeft className="h-5 w-5" /> Back to History
        </button>
        <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition">
          <Printer className="h-5 w-5"/> Print Receipt
        </button>
      </div>

      {/* --- START OF PRINTABLE AREA --- */}
      <div className="bg-white shadow-lg border border-gray-200 rounded-xl overflow-hidden">
        <div ref={receiptRef} className="p-10 bg-white print:p-0">
          
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">JAIN FREIGHT CARRIERS</h1>
                <p className="text-gray-500 mt-1 font-medium text-sm">Logistics & Transportation Services</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-gray-800">FREIGHT RECEIPT</h2>
                <p className="text-sm font-semibold text-gray-500 mt-1">TRK: {trip.tracking_number}</p>
              </div>
          </div>
          
          {/* Grid Info */}
          <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Date of Dispatch:</span> <span className="font-bold">{trip.trip_start_date || '-'}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Vehicle No:</span> <span className="font-bold text-base">{trip.vehicle_number}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Route:</span> <span className="font-bold">{trip.source_city} → {trip.destination_city}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Delivery Date:</span> <span className="font-bold">{trip.actual_delivery_date || 'Pending'}</span></div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">Billed To (Party):</span> <span className="font-bold">{trip.party_name || 'N/A'}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">GTA Name:</span> <span className="font-bold">{trip.gta_name || 'N/A'}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">LR / Bilty No:</span> <span className="font-bold">{trip.lr_no || 'N/A'}</span></div>
                <div className="flex justify-between border-b pb-2"><span className="text-gray-500 font-medium">E-Way Bill:</span> <span className="font-bold">{trip.eway_bill || 'N/A'}</span></div>
              </div>
          </div>

          {/* Financial Breakdown (Read-Only Version) */}
          <h3 className="font-bold text-base mb-4 text-slate-800 uppercase tracking-wide border-b pb-2">Financial Settlement</h3>
          <div className="grid grid-cols-2 gap-x-12 gap-y-4">
              
              {/* Additions */}
              <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Additions (+)</h4>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">Total Freight</span>
                    <span className="font-bold">₹{trip.freight_amount || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">Loading/Unloading</span>
                    <span className="font-bold">₹{trip.loading_charge || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">GST (18%)</span>
                    <span className="font-bold text-emerald-600">₹{trip.gst || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-sm font-semibold text-gray-700">Holding Charge</span>
                    <span className="font-bold">₹{trip.holding_charge || 0}</span>
                  </div>
              </div>

              {/* Deductions */}
              <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Deductions (-)</h4>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">Advance Received</span>
                    <span className="font-bold text-rose-600">₹{trip.adv_amt || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                    <span className="text-sm font-semibold text-gray-700">TDS Deduction</span>
                    <span className="font-bold text-rose-600">₹{trip.tds || 0}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <span className="text-sm font-semibold text-gray-700">Extra Deduction</span>
                    <span className="font-bold text-rose-600">₹{trip.extra_deduction || 0}</span>
                  </div>
              </div>
              
              {/* Final Balance Box */}
              <div className="col-span-2 mt-4 p-4 border-2 border-slate-900 rounded-lg flex justify-between items-center bg-emerald-50/30 print:border-2 print:bg-transparent">
                  <span className="font-extrabold text-lg text-slate-900">NET BALANCE PAYABLE</span>
                  <span className="font-extrabold text-2xl text-emerald-600 print:text-slate-900">₹{trip.balance_payment || 0}</span>
              </div>
          </div>

          {/* Driver Hisaab Section */}
          <h3 className="font-bold text-base mb-4 mt-8 text-slate-800 uppercase tracking-wide border-b pb-2">Driver Settlement (Hisaab)</h3>
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6 grid grid-cols-2 gap-x-8 gap-y-4 print:bg-transparent print:border-none print:p-0">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-sm font-semibold text-gray-700">Total KM Traveled</span>
                <span className="font-bold text-blue-700">{trip.total_km || 0} KM</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-sm font-semibold text-gray-700">Driver Advance (₹3.5/km)</span>
                <span className="font-bold text-slate-900">₹{trip.driver_advance || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-sm font-semibold text-gray-700">Remaining Balance (₹1.0/km)</span>
                <span className="font-bold text-slate-900">₹{trip.driver_remaining || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-sm font-extrabold text-gray-900">Total Driver Pay (₹4.5/km)</span>
                <span className="font-extrabold text-blue-700">₹{trip.driver_total || 0}</span>
              </div>
          </div>
          
          {/* Signature Area */}
          <div className="hidden print:flex justify-between mt-20 pt-8">
              <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Receiver's Signature</div>
              <div className="border-t border-gray-400 w-48 text-center pt-2 font-semibold text-sm">Authorized Signatory</div>
          </div>

        </div>
      </div>
      {/* --- END OF PRINTABLE AREA --- */}
      
    </div>
  );
}

export default TripDetails;