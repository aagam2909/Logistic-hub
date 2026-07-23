import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

function TripHistory() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchHistory();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="mb-6 text-3xl font-bold text-gray-900">Completed Trip History</h2>
      
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm border border-gray-200">
        {loading ? (
          <p className="p-10 text-center text-gray-500 font-medium">Loading completed trips...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-600">
              <tr>
                <th className="p-4 font-semibold">Tracking No.</th>
                <th className="p-4 font-semibold">Vehicle</th>
                <th className="p-4 font-semibold">Route</th>
                <th className="p-4 font-semibold">Party</th>
                <th className="p-4 font-semibold">Start Date</th>
                <th className="p-4 font-semibold">Delivered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {trips?.map?.((trip) => (
                <tr key={trip.trip_id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    {/* The Tracking Number is now a clickable hyperlink! */}
                    <Link 
                      to={`/trip-details/${trip.trip_id}`} 
                      className="text-blue-600 font-bold hover:text-blue-800 hover:underline transition"
                    >
                      {trip.tracking_number}
                    </Link>
                  </td>
                  <td className="p-4 font-bold text-slate-800">{trip.vehicle_number}</td>
                  <td className="p-4 font-medium text-gray-600">{trip.source_city} → {trip.destination_city}</td>
                  <td className="p-4 text-gray-600">{trip.party_name || '-'}</td>
                  <td className="p-4 text-gray-500">{trip.trip_start_date || '-'}</td>
                  <td className="p-4 text-emerald-600 font-medium">{trip.actual_delivery_date || '-'}</td>
                </tr>
              ))}
              {!trips.length && (
                <tr>
                  <td className="p-10 text-center text-gray-500" colSpan="6">
                    No completed trips found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default TripHistory;