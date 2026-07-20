import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = `${import.meta.env.VITE_API_BASE}`;

function TripDetails() {
  const { trip_id } = useParams();
  const [trip, setTrip] = useState(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`${API_BASE}/trips/details/${trip_id}`);
        setTrip(res.data);
      } catch (err) { console.error("Error fetching details:", err); }
    };
    fetchDetails();
  }, [trip_id]);

  if (!trip) return <div className="p-10">Loading details...</div>;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6">Trip Receipt: {trip.tracking_number}</h2>
      <div className="bg-white p-6 rounded shadow grid grid-cols-2 gap-6">
        <div>
            <h3 className="font-bold text-lg border-b mb-2">Trip Info</h3>
            <p><strong>Party:</strong> {trip.party_name}</p>
            <p><strong>Vehicle:</strong> {trip.vehicle_number}</p>
            <p><strong>Route:</strong> {trip.source_city} ➔ {trip.destination_city}</p>
            <p><strong>LR No:</strong> {trip.lr_no}</p>
        </div>
        <div>
            <h3 className="font-bold text-lg border-b mb-2">Financials</h3>
            <p><strong>Freight:</strong> ₹{trip.freight_amount || 0}</p>
            <p><strong>Advance:</strong> ₹{trip.adv_amt || 0}</p>
            <p><strong>Expenses:</strong> ₹{trip.expenses || 0}</p>
            <p><strong>Balance:</strong> ₹{trip.balance_payment || 0}</p>
            <p><strong>Bill No:</strong> {trip.bill_no || 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}
export default TripDetails;