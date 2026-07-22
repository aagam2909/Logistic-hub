import React, { useEffect, useState } from 'react';
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
    <div className="p-6">
      <h2 className="mb-6 text-3xl font-bold">Completed Trip History</h2>
      <div className="overflow-x-auto rounded-lg bg-white shadow-md">
        {loading ? (
          <p className="p-6 text-center">Loading completed trips...</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="p-4">Tracking No.</th>
                <th className="p-4">Vehicle</th>
                <th className="p-4">Route</th>
                <th className="p-4">Party</th>
                <th className="p-4">Start Date</th>
                <th className="p-4">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {trips?.map?.((trip) => (
                <tr key={trip.trip_id} className="border-b">
                  <td className="p-4 font-medium">{trip.tracking_number}</td>
                  <td className="p-4">{trip.vehicle_number}</td>
                  <td className="p-4">{trip.source_city} → {trip.destination_city}</td>
                  <td className="p-4">{trip.party_name}</td>
                  <td className="p-4">{trip.trip_start_date || '-'}</td>
                  <td className="p-4">{trip.actual_delivery_date || '-'}</td>
                </tr>
              ))}
              {!trips.length && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan="6">
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
