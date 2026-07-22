-- Rebuild existing tracking numbers as LAST4_DDMMYY_MONTHLY_SEQUENCE.
-- This project stores the vehicle value in trips.vehicle_number.
-- If your database calls that column vehicle_no, replace vehicle_number below.
WITH numbered_trips AS (
    SELECT
        trip_id,
        RIGHT(vehicle_number, 4)
            || '_' || TO_CHAR(created_at, 'DDMMYY')
            || '_' || ROW_NUMBER() OVER (
                PARTITION BY DATE_TRUNC('month', created_at)
                ORDER BY created_at, trip_id
            ) AS new_tracking_number
    FROM trips
)
UPDATE trips AS trip
SET tracking_number = numbered_trips.new_tracking_number
FROM numbered_trips
WHERE trip.trip_id = numbered_trips.trip_id;
