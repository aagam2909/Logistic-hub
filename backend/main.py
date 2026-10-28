from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db_connection
from datetime import date, datetime, timedelta, timezone
import os
import io
import re
import psycopg2
from psycopg2 import errors
import requests
import shutil
import json
import time
import concurrent.futures
import pandas as pd
from dotenv import load_dotenv
from typing import Optional, List
from vendor_reconcile import parse_vendor_file

load_dotenv()
TAABI_API_KEY = os.getenv("TAABI_API_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

app = FastAPI(title="Jain Freight Carrier")

app.add_middleware(
    CORSMiddleware, 
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://logistic-hub-ten.vercel.app",
        "https://logistic-hub-grfb.onrender.com"
    ], 
    allow_credentials=True,
    allow_methods=["*"], 
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

def safe_float(val):
    try:
        if val is None or val == '': 
            return 0.0
        return float(val)
    except (ValueError, TypeError):
        return 0.0

def get_current_user(request: Request) -> str:
    return request.headers.get("X-Username") or request.headers.get("x-username") or "System"

def clean_vehicle(v):
    if not v or pd.isna(v):
        return None
    if isinstance(v, float):
        v = str(int(v))
    cleaned = re.sub(r'[^A-Za-z0-9]', '', str(v)).upper()
    return cleaned if len(cleaned) >= 4 else None

def is_vehicle_match(sheet_veh, db_veh):
    s = clean_vehicle(sheet_veh)
    d = clean_vehicle(db_veh)
    if not s or not d:
        return False
    return (s == d) or (len(s) >= 4 and d.endswith(s)) or (len(d) >= 4 and s.endswith(d))

class TripCreate(BaseModel):
    vehicle_number: str
    source_city: str
    destination_city: str
    party_name: Optional[str] = ""
    owner_name: Optional[str] = ""
    gta_name: Optional[str] = ""
    lr_no: Optional[str] = ""
    eway_bill: Optional[str] = "" 
    eway_bill_expiry: Optional[date] = None
    trip_start_date: Optional[date] = date.today()
    reported_date: Optional[date] = None
    unloading_date: Optional[date] = None
    lw: Optional[str] = ""
    freight_amount: Optional[float] = 0.0 
    total_km: Optional[float] = 0.0

class TripCompleteUpdate(BaseModel):
    actual_delivery_date: date
    reported_date: Optional[date] = None
    unloading_date: Optional[date] = None
    pod_image_path: Optional[str] = None
    trip_unloaded: Optional[bool] = False
    amount_cleared: Optional[bool] = False
    cleared_amount: Optional[float] = 0.0
    cleared_date: Optional[date] = None
    pod_status: Optional[str] = 'Pending'
    pod_arrived_office_date: Optional[date] = None
    pod_forwarded_client_date: Optional[date] = None
    pod_received_client_date: Optional[date] = None

class ChecklistUpdate(BaseModel):
    trip_unloaded: bool
    reported_date: Optional[date] = None
    unloading_date: Optional[date] = None
    amount_cleared: bool
    cleared_amount: Optional[float] = 0.0
    cleared_date: Optional[date] = None
    pod_status: Optional[str] = 'Pending'
    pod_arrived_office_date: Optional[date] = None
    pod_forwarded_client_date: Optional[date] = None
    pod_received_client_date: Optional[date] = None

class PODUpdate(BaseModel):
    pod_status: str
    pod_arrived_office_date: Optional[date] = None
    pod_forwarded_client_date: Optional[date] = None
    pod_received_client_date: Optional[date] = None

class DriverCreate(BaseModel):
    name: str
    dl_number: str
    aadhaar_number: Optional[str] = None
    mobile_number: Optional[str] = None
    dl_expiry_date: Optional[date] = None

class DriverUpdate(DriverCreate): pass

class AssetUpdate(BaseModel):
    driver_name: str
    per_km_rate: float
    current_status: str
    compensation_type: Optional[str] = 'KM Based'
    mileage: Optional[float] = 0.0
    fixed_salary: Optional[float] = 0.0

class DriverSettleUpdate(BaseModel):
    trip_id: int
    payment_date: date

class TrackingUpdate(BaseModel):
    tracking_location: str
    tracking_status: str

class DriverHisaabItem(BaseModel):
    amount: float
    date: str
    category: str
    liters: Optional[float] = 0.0
    place: Optional[str] = ""
    reason: Optional[str] = ""
    employee: Optional[str] = ""

def reverse_geocode(lat, lng):
    if not lat or not lng or not GOOGLE_MAPS_API_KEY:
        return f"Lat: {lat}, Lng: {lng}"
    try:
        url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lng}&key={GOOGLE_MAPS_API_KEY}"
        response = requests.get(url, timeout=5).json()
        if response.get('status') == 'OK':
            return response['results'][0]['formatted_address']
    except Exception as e:
        print(f"Geocoding Error: {e}")
    return f"Lat: {lat}, Lng: {lng}"

def get_taabi_live_data(vehicle_number):
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    query = "query getAllDeviceLocations($configs: Configs) { devices: getAllDeviceLocations(configs: $configs) { vehicleNumber, speed, haltStatus, latitude, longitude, fuelValueLtrs, adblue_level } }"
    payload = {"query": query, "variables": {"configs": {}}}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        devices = response.json().get("data", {}).get("devices", [])
        db_clean = str(vehicle_number).replace("-", "").replace(" ", "").upper()
        for dev in devices:
            api_clean = str(dev['vehicleNumber']).replace("-", "").replace(" ", "").upper()
            if db_clean in api_clean or api_clean in db_clean:
                lat = dev.get('latitude')
                lng = dev.get('longitude')
                loc_str = reverse_geocode(lat, lng) if lat and lng else ""
                return {
                    "internal_id": dev.get('vehicleNumber', vehicle_number),
                    "speed": dev['speed'], "lat": lat, "lng": lng,
                    "fuel_level": dev.get('fuelValueLtrs', 'N/A'), "urea_level": dev.get('adblue_level', 'N/A'),
                    "status": "Halted" if dev['haltStatus'] else "Moving",
                    "location": loc_str 
                }
        return {"internal_id": vehicle_number, "speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Not Found", "location": ""}
    except Exception:
        return {"internal_id": vehicle_number, "speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Offline", "location": ""}

def get_taabi_yesterday_distance(internal_device_id: str):
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    try:
        ist = timezone(timedelta(hours=5, minutes=30))
        now_ist = datetime.now(ist)
        today_midnight = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_midnight = today_midnight - timedelta(days=1)
        
        from_time = int(yesterday_midnight.timestamp() * 1000)
        to_time = int((today_midnight - timedelta(seconds=1)).timestamp() * 1000)

        query = """query GetFuelDataV3($uniqueid: String!, $fromTime: Long!, $toTime: Long!, $timezone: String, $isEstimatedLoss: Boolean) {
            getFuelData: getFuelDataV3(uniqueid: $uniqueid, fromTime: $fromTime, toTime: $toTime, timezone: $timezone, isEstimatedLoss: $isEstimatedLoss) {
                distance
            }
        }"""
        
        payload = {
            "query": query,
            "variables": { 
                "uniqueid": str(internal_device_id).strip(), 
                "fromTime": from_time, 
                "toTime": to_time, 
                "timezone": "Asia/Kolkata", 
                "isEstimatedLoss": False 
            }
        }
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        data = response.json().get("data", {})
        if data and data.get("getFuelData"):
            return data["getFuelData"].get("distance", 0)
        return 0
    except Exception as e:
        print(f"YSD Distance Error: {e}")
        return 0
        
def get_taabi_fuel_analytics(internal_device_id: str, start_date, end_date):
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    try:
        if isinstance(start_date, date):
            from_time = int(datetime.combine(start_date, datetime.min.time()).timestamp())
        elif isinstance(start_date, str):
            from_time = int(datetime.strptime(start_date, "%Y-%m-%d").timestamp())
        else:
            from_time = int(time.time()) - (86400 * 7)

        if end_date and isinstance(end_date, date):
            to_time = int(datetime.combine(end_date, datetime.max.time()).timestamp())
        elif end_date and isinstance(end_date, str):
            to_time = int(datetime.strptime(end_date, "%Y-%m-%d").timestamp())
        else:
            to_time = int(time.time())

        query = """query GetFuelDataV3($uniqueid: String!, $fromTime: Int!, $toTime: Int!, $timezone: String, $isEstimatedLoss: Boolean) {
            getFuelData: getFuelDataV3(uniqueid: $uniqueid, fromTime: $fromTime, toTime: $toTime, timezone: $timezone, isEstimatedLoss: $isEstimatedLoss) {
                fuelConsumed mileage distance refuelVolume pilfregeVolume noOfRefuels noOfPilfreges
                events { refuelEvents { alertvalue start_address eventstarttime } pilferageEvents { alertvalue start_address eventstarttime } }
            }
        }"""
        
        payload = {
            "query": query,
            "variables": { "uniqueid": str(internal_device_id).strip(), "fromTime": from_time, "toTime": to_time, "timezone": "Asia/Kolkata", "isEstimatedLoss": False }
        }
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        data = response.json().get("data", {})
        return data.get("getFuelData") if data else {}
    except Exception:
        return {}
    
@app.get("/taabi/bulk")
def get_bulk_taabi():
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    query = """
    query getAllDeviceLocations($configs: Configs) {
        devices: getAllDeviceLocations(configs: $configs) {
            vehicleNumber
            fuelValueLtrs
            speed
            haltStatus
            latitude
            longitude
        }
    }
    """
    payload = {"query": query, "variables": {"configs": {}}}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        devices = response.json().get("data", {}).get("devices", [])
        fuel_map = {}
        
        def process_device(dev):
            clean_vn = str(dev.get('vehicleNumber', '')).replace("-", "").replace(" ", "").upper()
            lat = dev.get('latitude')
            lng = dev.get('longitude')
            loc_str = reverse_geocode(lat, lng) if lat and lng else "Location Unavailable"
            return clean_vn, {
                "internal_id": dev.get('vehicleNumber', clean_vn),
                "fuel": dev.get('fuelValueLtrs', 'N/A'),
                "speed": dev.get('speed', 0),
                "status": "Halted" if dev.get('haltStatus') else "Moving",
                "lat": lat,
                "lng": lng,
                "location": loc_str 
            }

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = executor.map(process_device, devices)
            for clean_vn, data in results:
                fuel_map[clean_vn] = data
                
        return fuel_map
    except Exception as e:
        print(f"Taabi API Error: {e}")
        return {}
    
@app.get("/taabi/bulk-fuel-active")
def get_bulk_fuel_active():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT vehicle_number, trip_start_date FROM trips WHERE actual_delivery_date IS NULL;")
    active_trips = cursor.fetchall()
    cursor.close()
    conn.close()

    bulk_live = get_bulk_taabi()
    results = {}
    
    def fetch_for_vehicle(vn, s_date):
        clean_vn = vn.replace("-", "").replace(" ", "").upper()
        internal_id = bulk_live.get(clean_vn, {}).get("internal_id", vn)
        data = get_taabi_fuel_analytics(internal_id, s_date, None)
        if not isinstance(data, dict):
            data = {}
        data['yesterday_distance'] = get_taabi_yesterday_distance(internal_id)
        return vn, data

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fetch_for_vehicle, row[0], row[1]) for row in active_trips]
        for future in concurrent.futures.as_completed(futures):
            vn, data = future.result()
            clean_vn = vn.replace("-", "").replace(" ", "").upper()
            results[clean_vn] = data
    return results

# --- ASSETS (FLEET) ---
@app.get("/assets")
def get_all_assets():
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets;")
    assets = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return assets

@app.post("/assets")
async def create_asset(
    request: Request,
    vehicle_number: str = Form(...), 
    driver_name: str = Form(...), 
    per_km_rate: float = Form(...), 
    compensation_type: str = Form('KM Based'), 
    mileage: float = Form(0.0), 
    fixed_salary: float = Form(0.0)
):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO assets (vehicle_number, driver_name, per_km_rate, current_status, compensation_type, mileage, fixed_salary) VALUES (%s, %s, %s, 'Available', %s, %s, %s);", 
        (vehicle_number.upper().strip(), driver_name, per_km_rate, compensation_type, mileage, fixed_salary)
    )
    try:
        cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Asset Created", f"Added truck {vehicle_number.upper().strip()} assigned to {driver_name}", current_user))
    except Exception:
        cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Asset Created", f"Added truck {vehicle_number.upper().strip()} assigned to {driver_name}"))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/assets/{vehicle_no}")
def update_asset(vehicle_no: str, asset: AssetUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute(
        "UPDATE assets SET driver_name = %s, per_km_rate = %s, current_status = %s, compensation_type = %s, mileage = %s, fixed_salary = %s WHERE vehicle_number = %s RETURNING vehicle_number;", 
        (asset.driver_name, asset.per_km_rate, asset.current_status, asset.compensation_type, asset.mileage, asset.fixed_salary, vehicle_no.upper().strip())
    )
    updated = cursor.fetchone()
    if not updated: 
        cursor.close(); conn.close()
        raise HTTPException(status_code=404, detail="Vehicle not found")
        
    try:
        cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Asset Updated", f"Updated truck {vehicle_no} profile", current_user))
    except Exception:
        cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Asset Updated", f"Updated truck {vehicle_no} profile"))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "Updated", "vehicle_number": updated[0]}

@app.delete("/assets/{vehicle_number}")
def delete_asset(vehicle_number: str, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("UPDATE assets SET current_status = 'Archived' WHERE vehicle_number = %s RETURNING vehicle_number;", (vehicle_number.upper().strip(),))
    archived = cursor.fetchone()
    try:
        cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Asset Archived", f"Archived truck {vehicle_number}", current_user))
    except Exception:
        cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Asset Archived", f"Archived truck {vehicle_number}"))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "Archived", "vehicle_number": archived[0]}

# --- TRIPS ---
@app.post("/trips")
def create_trip(trip: TripCreate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT current_status FROM assets WHERE vehicle_number = %s", (trip.vehicle_number.upper().strip(),))
        status_row = cursor.fetchone()
        if status_row and status_row[0] == 'In-Transit':
            raise HTTPException(status_code=400, detail=f"Truck {trip.vehicle_number} is already In-Transit! Please complete its active trip before launching a new one.")

        cursor.execute(
            "INSERT INTO trips (vehicle_number, source_city, destination_city, party_name, owner_name, gta_name, lr_no, eway_bill, eway_bill_expiry, trip_start_date, lw, reported_date, unloading_date) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING trip_id;", 
            (trip.vehicle_number.upper().strip(), trip.source_city, trip.destination_city, trip.party_name, trip.owner_name, trip.gta_name, trip.lr_no, trip.eway_bill, trip.eway_bill_expiry, trip.trip_start_date, trip.lw, trip.reported_date, trip.unloading_date)
        )
        trip_id = cursor.fetchone()[0]
        date_str = (trip.trip_start_date if trip.trip_start_date else datetime.now().date()).strftime('%d%m%y')
        tracking_number = f"{trip.vehicle_number.upper().strip()}-{trip.party_name.replace(' ', '').upper() if trip.party_name else 'NOPARTY'}-{date_str}-{trip_id}"
        cursor.execute("UPDATE trips SET tracking_number = %s WHERE trip_id = %s", (tracking_number, trip_id))
        
        freight = trip.freight_amount or 0.0
        total_km = trip.total_km or 0.0
        fastag_est = total_km * 5.75
        
        cursor.execute("SELECT mileage FROM assets WHERE vehicle_number = %s;", (trip.vehicle_number.upper().strip(),))
        m_row = cursor.fetchone()
        mileage = float(m_row[0]) if m_row and m_row[0] else 5.5
        diesel_liters_needed = round(total_km / mileage, 2) if mileage > 0 else 0.0
        diesel_cost = round(diesel_liters_needed * 90.0, 2)
        
        cursor.execute("""
            INSERT INTO trip_finances (trip_id, freight_amount, gst, balance_payment, total_km, driver_advance, driver_remaining, driver_total, gst_enabled, fastag_estimate, diesel_liters_needed, diesel_cost, unloading_date) 
            VALUES (%s, %s, 0.0, %s, %s, %s, %s, %s, FALSE, %s, %s, %s, %s)
        """, (trip_id, freight, freight, total_km, total_km * 3.5, total_km * 1.0, total_km * 4.5, fastag_est, diesel_liters_needed, diesel_cost, trip.unloading_date))
        
        cursor.execute("UPDATE assets SET current_status = 'In-Transit' WHERE vehicle_number = %s;", (trip.vehicle_number.upper().strip(),))
        
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Trip Launched", f"Launched {tracking_number} ({trip.source_city} -> {trip.destination_city})", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Trip Launched", f"Launched {tracking_number} ({trip.source_city} -> {trip.destination_city})"))
        
        conn.commit()
        return {"message": "Trip launched", "tracking_number": tracking_number}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/trips/{trip_id}")
def update_trip(trip_id: int, trip_data: dict, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        start_date = trip_data.get('trip_start_date') or None
        exp_date = trip_data.get('eway_bill_expiry') or None
        rep_date = trip_data.get('reported_date') or None
        unload_date = trip_data.get('unloading_date') or None
        
        new_km = safe_float(trip_data.get('total_km'))
        new_freight = safe_float(trip_data.get('freight_amount'))
        fastag_est = new_km * 5.75
        
        cursor.execute("""
            UPDATE trips 
            SET vehicle_number=%s, source_city=%s, destination_city=%s, party_name=%s, 
                owner_name=%s, gta_name=%s, lr_no=%s, eway_bill=%s, eway_bill_expiry=%s, 
                trip_start_date=%s, lw=%s, reported_date=%s, unloading_date=%s 
            WHERE trip_id=%s
        """, (
            trip_data.get('vehicle_number'), trip_data.get('source_city'), trip_data.get('destination_city'),
            trip_data.get('party_name'), trip_data.get('owner_name'), trip_data.get('gta_name'),
            trip_data.get('lr_no'), trip_data.get('eway_bill'), exp_date, start_date, trip_data.get('lw'),
            rep_date, unload_date, trip_id
        ))
        
        cursor.execute("SELECT advance_details, loading_charge, holding_charge, gst, tds, extra_deduction, include_loading_in_gst, include_holding_in_gst, gst_enabled FROM trip_finances WHERE trip_id = %s", (trip_id,))
        f_row = cursor.fetchone()
        if f_row:
            adv_details = json.loads(f_row[0]) if isinstance(f_row[0], str) else (f_row[0] or [])
            total_adv = sum(safe_float(a.get('amount')) for a in adv_details if isinstance(a, dict))
            loading = safe_float(f_row[1])
            holding = safe_float(f_row[2])
            gst_en = bool(f_row[8])
            
            taxable_base = new_freight + (loading if bool(f_row[6]) else 0) + (holding if bool(f_row[7]) else 0)
            new_gst = round(taxable_base * 0.18, 2) if gst_en else 0.0
            balance = (new_freight + loading + holding + new_gst) - (total_adv + safe_float(f_row[4]) + safe_float(f_row[5]))
            
            cursor.execute("SELECT a.mileage FROM trips t JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE t.trip_id = %s", (trip_id,))
            m_row = cursor.fetchone()
            mileage = float(m_row[0]) if m_row and m_row[0] else 5.5
            diesel_req = round(new_km / mileage, 2) if mileage > 0 else 0.0
            diesel_cost = round(diesel_req * 90.0, 2)
            
            cursor.execute("""
                UPDATE trip_finances 
                SET freight_amount=%s, total_km=%s, gst=%s, balance_payment=%s, 
                    driver_advance=%s, driver_remaining=%s, driver_total=%s, 
                    diesel_liters_needed=%s, diesel_cost=%s, fastag_estimate=%s,
                    unloading_date=%s 
                WHERE trip_id=%s
            """, (new_freight, new_km, new_gst, balance, new_km*3.5, new_km*1.0, new_km*4.5, diesel_req, diesel_cost, fastag_est, unload_date, trip_id))
            
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Trip Updated", f"Modified parameters for Trip ID {trip_id}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Trip Updated", f"Modified parameters for Trip ID {trip_id}"))
        conn.commit()
        return {"message": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}/complete")
def complete_trip(trip_id: int, data: TripCompleteUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE trips 
            SET actual_delivery_date = %s, reported_date = %s, unloading_date = %s 
            WHERE trip_id = %s RETURNING vehicle_number;
        """, (data.actual_delivery_date, data.reported_date, data.unloading_date, trip_id))
        v_row = cursor.fetchone()
        if v_row: cursor.execute("UPDATE assets SET current_status = 'Available' WHERE vehicle_number = %s;", (v_row[0],))
        
        cursor.execute("SELECT advance_details, freight_amount, loading_charge, holding_charge, gst, tds, extra_deduction FROM trip_finances WHERE trip_id = %s", (trip_id,))
        row = cursor.fetchone()
        if row:
            adv_details = json.loads(row[0]) if isinstance(row[0], str) else (row[0] or [])
            if data.cleared_amount and safe_float(data.cleared_amount) > 0:
                adv_details.append({"date": (data.cleared_date or date.today()).isoformat(), "amount": safe_float(data.cleared_amount)})
            total_adv = sum(safe_float(a.get('amount')) for a in adv_details if isinstance(a, dict))
            balance = (safe_float(row[1]) + safe_float(row[2]) + safe_float(row[3]) + safe_float(row[4])) - (total_adv + safe_float(row[5]) + safe_float(row[6]))
            cursor.execute("""
                UPDATE trip_finances 
                SET pod_image_url=COALESCE(%s, pod_image_url), trip_unloaded=%s, pod_status=%s, 
                    pod_arrived_office_date=%s, pod_forwarded_client_date=%s, pod_received_client_date=%s, 
                    advance_details=%s, adv_amt=%s, balance_payment=%s, amount_cleared=%s,
                    unloading_date=%s 
                WHERE trip_id=%s;
            """, (data.pod_image_path, data.trip_unloaded, data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, json.dumps(adv_details), total_adv, balance, balance<=0, data.unloading_date, trip_id))
        
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Trip Completed", f"Delivered Trip {trip_id} (Unloaded: {data.unloading_date or data.actual_delivery_date})", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Trip Completed", f"Delivered Trip {trip_id}"))
        conn.commit(); return {"status": "Success"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/finances/{trip_id}/checklist")
def update_checklist(trip_id: int, data: ChecklistUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("UPDATE trips SET reported_date = %s, unloading_date = %s WHERE trip_id = %s;", (data.reported_date, data.unloading_date, trip_id))
        cursor.execute("SELECT advance_details, freight_amount, loading_charge, holding_charge, gst, tds, extra_deduction FROM trip_finances WHERE trip_id = %s", (trip_id,))
        row = cursor.fetchone()
        if row:
            adv_details = json.loads(row[0]) if isinstance(row[0], str) else (row[0] or [])
            if data.cleared_amount and safe_float(data.cleared_amount) > 0:
                adv_details.append({"date": (data.cleared_date or date.today()).isoformat(), "amount": safe_float(data.cleared_amount)})
            total_adv = sum(safe_float(a.get('amount')) for a in adv_details if isinstance(a, dict))
            balance = (safe_float(row[1]) + safe_float(row[2]) + safe_float(row[3]) + safe_float(row[4])) - (total_adv + safe_float(row[5]) + safe_float(row[6]))
            cursor.execute("""
                UPDATE trip_finances 
                SET trip_unloaded=%s, pod_status=%s, pod_arrived_office_date=%s, 
                    pod_forwarded_client_date=%s, pod_received_client_date=%s, 
                    advance_details=%s, adv_amt=%s, balance_payment=%s, amount_cleared=%s,
                    unloading_date=%s 
                WHERE trip_id=%s;
            """, (data.trip_unloaded, data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, json.dumps(adv_details), total_adv, balance, balance<=0, data.unloading_date, trip_id))
        
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Checklist Updated", f"Trip {trip_id} updated", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Checklist Updated", f"Trip {trip_id} updated"))
        conn.commit(); return {"status": "Success"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.get("/trips/active")
def get_active_trips():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM (
            SELECT DISTINCT ON (t.trip_id) t.*, a.driver_name, 
                   f.freight_amount, f.adv_amt, f.balance_payment, f.total_km, 
                   f.diesel_liters_needed, f.fastag_estimate, f.driver_advance, 
                   f.driver_remaining, f.driver_total, f.driver_paid, f.driver_payment_date,
                   f.trip_unloaded, f.pod_status, f.pod_arrived_office_date, 
                   f.pod_forwarded_client_date, f.pod_received_client_date, f.amount_cleared,
                   f.advance_details, f.fastag_details, f.driver_hisaab_entries, f.loading_charge, f.holding_charge, 
                   f.gst, f.tds, f.extra_deduction, f.unloading_date AS finance_unloading_date
            FROM trips t 
            LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number 
            LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
            WHERE t.actual_delivery_date IS NULL 
        ) sub
        ORDER BY trip_start_date DESC, trip_id DESC;
    """)
    cols = [d[0] for d in cursor.description]
    active_trips = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()

    try:
        bulk_gps = get_bulk_taabi()
    except Exception:
        bulk_gps = {}

    for trip in active_trips:
        clean_vn = str(trip.get('vehicle_number', '')).replace("-", "").replace(" ", "").upper()
        gps_info = bulk_gps.get(clean_vn)
        if gps_info and gps_info.get("location") and gps_info.get("location") != "Location Unavailable":
            trip['tracking_location'] = gps_info["location"]
        else:
            trip['tracking_location'] = trip.get('tracking_location') or trip.get('source_city')
        trip['tracking_status'] = trip.get('tracking_status') or 'RUNNING'

    return active_trips

@app.get("/trips/history")
def get_trip_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM (
            SELECT DISTINCT ON (t.trip_id) t.*, 
                   f.freight_amount, f.adv_amt, f.balance_payment, f.total_km, 
                   f.diesel_liters_needed, f.fastag_estimate, f.driver_advance, 
                   f.driver_remaining, f.driver_total, f.driver_paid, f.driver_payment_date,
                   f.trip_unloaded, f.pod_status, f.pod_arrived_office_date, 
                   f.pod_forwarded_client_date, f.pod_received_client_date, f.amount_cleared,
                   f.advance_details, f.fastag_details, f.driver_hisaab_entries, f.loading_charge, f.holding_charge, 
                   f.gst, f.tds, f.extra_deduction, f.unloading_date AS finance_unloading_date
            FROM trips t 
            LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
            WHERE t.actual_delivery_date IS NOT NULL 
        ) sub
        ORDER BY actual_delivery_date DESC, trip_id DESC;
    """)
    res = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return res

@app.get("/trips/all")
def get_all_trips():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM (
            SELECT DISTINCT ON (t.trip_id) t.*, f.total_km, f.freight_amount, f.balance_payment, f.pod_status AS finance_pod_status,
                   f.advance_details, f.fastag_details, f.driver_hisaab_entries, f.driver_advance, f.driver_remaining, f.driver_total,
                   f.loading_charge, f.holding_charge, f.gst, f.tds, f.extra_deduction, f.adv_amt, f.diesel_liters_needed, f.fastag_estimate, f.bank_account, f.bill_no,
                   f.unloading_date AS finance_unloading_date
            FROM trips t 
            LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        ) sub
        ORDER BY trip_id DESC;
    """)
    res = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return res

@app.delete("/trips/{trip_id}")
def force_delete_trip(trip_id: int, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM trip_finances WHERE trip_id = %s;", (trip_id,))
        cursor.execute("DELETE FROM trips WHERE trip_id = %s RETURNING vehicle_number;", (trip_id,))
        res = cursor.fetchone()
        if res: cursor.execute("UPDATE assets SET current_status = 'Available' WHERE vehicle_number = %s;", (res[0],))
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Trip Force Deleted", f"Permanently deleted Trip ID {trip_id}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Trip Force Deleted", f"Permanently deleted Trip ID {trip_id}"))
        conn.commit(); return {"status": "Deleted"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}/locked-edit")
def locked_edit_trip(trip_id: int, trip_data: dict, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT is_locked FROM trips WHERE trip_id = %s", (trip_id,))
        if cursor.fetchone()[0]: raise HTTPException(status_code=400, detail="Permanently locked.")
        
        start_date = trip_data.get('trip_start_date') or None
        exp_date = trip_data.get('eway_bill_expiry') or None
        rep_date = trip_data.get('reported_date') or None
        unload_date = trip_data.get('unloading_date') or None

        new_km = safe_float(trip_data.get('total_km'))
        new_freight = safe_float(trip_data.get('freight_amount'))
        fastag_est = new_km * 5.75

        cursor.execute("""
            UPDATE trips 
            SET vehicle_number=%s, source_city=%s, destination_city=%s, party_name=%s, 
                owner_name=%s, gta_name=%s, lr_no=%s, eway_bill=%s, eway_bill_expiry=%s, 
                trip_start_date=%s, lw=%s, reported_date=%s, unloading_date=%s, is_locked=TRUE 
            WHERE trip_id=%s
        """, (
            trip_data.get('vehicle_number'), trip_data.get('source_city'), trip_data.get('destination_city'),
            trip_data.get('party_name'), trip_data.get('owner_name'), trip_data.get('gta_name'),
            trip_data.get('lr_no'), trip_data.get('eway_bill'), exp_date, start_date, trip_data.get('lw'),
            rep_date, unload_date, trip_id
        ))
        
        cursor.execute("SELECT advance_details, loading_charge, holding_charge, gst, tds, extra_deduction, include_loading_in_gst, include_holding_in_gst, gst_enabled FROM trip_finances WHERE trip_id = %s", (trip_id,))
        f_row = cursor.fetchone()
        if f_row:
            adv_details = json.loads(f_row[0]) if isinstance(f_row[0], str) else (f_row[0] or [])
            total_adv = sum(safe_float(a.get('amount')) for a in adv_details if isinstance(a, dict))
            loading = safe_float(f_row[1])
            holding = safe_float(f_row[2])
            
            taxable = new_freight + (loading if bool(f_row[6]) else 0) + (holding if bool(f_row[7]) else 0)
            new_gst = round(taxable * 0.18, 2) if bool(f_row[8]) else 0.0
            balance = (new_freight + loading + holding + new_gst) - (total_adv + safe_float(f_row[4]) + safe_float(f_row[5]))
            
            cursor.execute("SELECT a.mileage FROM trips t JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE t.trip_id = %s", (trip_id,))
            m_row = cursor.fetchone()
            mile = float(m_row[0]) if m_row and m_row[0] else 5.5
            diesel_req = round(new_km / mile, 2) if mile > 0 else 0.0
            diesel_cost = round(diesel_req * 90.0, 2)

            cursor.execute("""
                UPDATE trip_finances 
                SET freight_amount=%s, total_km=%s, gst=%s, balance_payment=%s, 
                    driver_advance=%s, driver_remaining=%s, driver_total=%s, 
                    diesel_liters_needed=%s, diesel_cost=%s, fastag_estimate=%s,
                    unloading_date=%s 
                WHERE trip_id=%s
            """, (new_freight, new_km, new_gst, balance, new_km*3.5, new_km*1.0, new_km*4.5, diesel_req, diesel_cost, fastag_est, unload_date, trip_id))
            
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Trip Locked Edit", f"Final edit locked on Trip {trip_id}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Trip Locked Edit", f"Final edit locked on Trip {trip_id}"))
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}/tracking")
def update_trip_tracking(trip_id: int, data: TrackingUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE trips SET tracking_location = %s, tracking_status = %s WHERE trip_id = %s", (data.tracking_location, data.tracking_status, trip_id))
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Tracking Updated", f"Trip {trip_id}: Status '{data.tracking_status}'", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Tracking Updated", f"Trip {trip_id}: Status '{data.tracking_status}'"))
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.get("/track/{trip_id:path}")
def get_track_data(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, a.mileage, f.* 
        FROM trips t 
        LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.tracking_number = %s;
    """, (trip_id,))
    row = cursor.fetchone()
    if not row: raise HTTPException(status_code=404, detail="Trip not found")
    res = dict(zip([d[0] for d in cursor.description], row))
    cursor.close(); conn.close()
    
    telemetry_data = get_taabi_live_data(res['vehicle_number'])
    internal_id = telemetry_data.get('internal_id', res['vehicle_number'])
    res['telemetry'] = telemetry_data
    
    fuel_data = get_taabi_fuel_analytics(internal_id, res['trip_start_date'], res.get('actual_delivery_date'))
    if not isinstance(fuel_data, dict):
        fuel_data = {}
    fuel_data['yesterday_distance'] = get_taabi_yesterday_distance(internal_id)
    res['fuel_analytics'] = fuel_data
    return res

@app.get("/trips/details/{trip_id}")
def get_trip_details(trip_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, 
               f.freight_amount, f.adv_amt, f.balance_payment, f.total_km, 
               f.diesel_liters_needed, f.fastag_estimate, f.driver_advance, 
               f.driver_remaining, f.driver_total, f.driver_paid, f.driver_payment_date,
               f.advance_details, f.fastag_details, f.driver_hisaab_entries, f.finance_remarks,
               f.loading_charge, f.holding_charge, f.gst, f.tds, f.extra_deduction,
               f.gst_enabled, f.bill_no, f.bank_account, f.unloading_date AS finance_unloading_date
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.trip_id = %s;
    """, (trip_id,))
    row = cursor.fetchone()
    if not row: 
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Trip not found")
    res = dict(zip([d[0] for d in cursor.description], row))
    cursor.close()
    conn.close()
    
    telemetry_data = get_taabi_live_data(res['vehicle_number'])
    internal_id = telemetry_data.get('internal_id', res['vehicle_number'])
    res['telemetry'] = telemetry_data
    
    fuel_data = get_taabi_fuel_analytics(internal_id, res['trip_start_date'], res.get('actual_delivery_date'))
    if not isinstance(fuel_data, dict):
        fuel_data = {}
    fuel_data['yesterday_distance'] = get_taabi_yesterday_distance(internal_id)
    res['fuel_analytics'] = fuel_data
    return res

@app.post("/finances/calculate")
def calculate_finance(data: dict, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        trip_id = data.get('trip_id')
        freight = safe_float(data.get('freight_amount'))
        tds = safe_float(data.get('tds'))
        loading = safe_float(data.get('loading_charge'))
        holding = safe_float(data.get('holding_charge'))
        extra = safe_float(data.get('extra_deduction'))
        gst_en = bool(data.get('gst_enabled', False))
        
        taxable_base = freight + (loading if bool(data.get('include_loading_in_gst', False)) else 0) + (holding if bool(data.get('include_holding_in_gst', False)) else 0)
        gst = round(taxable_base * 0.18, 2) if gst_en else 0.0
        
        advances = data.get('advance_details', [])
        total_adv = sum(safe_float(a.get('amount')) for a in advances if isinstance(a, dict))
        fastag_det = data.get('fastag_details', [])
        balance = (freight + loading + holding + gst) - (total_adv + tds + extra)
        total_km = safe_float(data.get('total_km'))
        
        cursor.execute("SELECT a.mileage, t.vehicle_number FROM trips t LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE t.trip_id = %s;", (trip_id,))
        m_row = cursor.fetchone()
        mile = float(m_row[0]) if m_row and m_row[0] else 5.5
        vehicle_no = str(m_row[1]).strip() if m_row and m_row[1] else "0000"
        
        passed_diesel = data.get('diesel_liters_needed')
        diesel_needed = safe_float(passed_diesel) if passed_diesel not in [None, ''] else (round(total_km / mile, 2) if mile > 0 else 0)
        passed_fastag = data.get('fastag_estimate')
        fastag_est = safe_float(passed_fastag) if passed_fastag not in [None, ''] else (total_km * 5.75)
        
        cursor.execute("""
            UPDATE trip_finances 
            SET freight_amount=%s, adv_amt=%s, tds=%s, balance_payment=%s, finance_remarks=%s, 
                loading_charge=%s, gst=%s, holding_charge=%s, extra_deduction=%s, total_km=%s, 
                driver_advance=%s, driver_remaining=%s, driver_total=%s, advance_details=%s, 
                fastag_details=%s, fastag_estimate=%s, bill_no=%s, diesel_liters_needed=%s, 
                bank_account=%s, gst_enabled=%s, include_loading_in_gst=%s, include_holding_in_gst=%s 
            WHERE trip_id=%s
        """, (
            freight, total_adv, tds, balance, data.get('finance_remarks', ''), 
            loading, gst, holding, extra, total_km, 
            total_km * 3.5, total_km * 1.0, total_km * 4.5, 
            json.dumps(advances), json.dumps(fastag_det), fastag_est, 
            data.get('bill_no', ''), diesel_needed, data.get('bank_account', ''), 
            gst_en, bool(data.get('include_loading_in_gst', False)), bool(data.get('include_holding_in_gst', False)), 
            trip_id
        ))
        
        last_4 = vehicle_no[-4:] if len(vehicle_no) >= 4 else vehicle_no
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Finance Edited", f"Ledger updated for Truck {last_4}. Balance: ₹{balance}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Finance Edited", f"Ledger updated for Truck {last_4}"))
        
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/finances/{trip_id}/pod")
def update_pod(trip_id: int, data: PODUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("UPDATE trip_finances SET pod_status=%s, pod_arrived_office_date=%s, pod_forwarded_client_date=%s, pod_received_client_date=%s WHERE trip_id=%s;", (data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, trip_id))
    try:
        cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("POD Status Updated", f"Trip {trip_id} POD set to {data.pod_status}", current_user))
    except Exception:
        cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("POD Status Updated", f"Trip {trip_id} POD set to {data.pod_status}"))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "Success"}

@app.post("/upload-pod")
async def upload_pod(file: UploadFile = File(...)):
    path = f"uploads/{file.filename}"
    with open(path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
    return {"path": path}

@app.get("/owners")
def get_owner_list():
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT owner_name FROM trips WHERE owner_name IS NOT NULL AND owner_name != '';")
    res = [row[0] for row in cursor.fetchall()]; cursor.close(); conn.close(); return res

@app.get("/parties")
def get_party_list():
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("SELECT name FROM parties UNION SELECT DISTINCT party_name FROM trips WHERE party_name IS NOT NULL;")
    res = [row[0] for row in cursor.fetchall()]; cursor.close(); conn.close(); return res

@app.get("/drivers")
def get_all_drivers():
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("SELECT * FROM drivers;")
    res = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.post("/drivers")
def add_driver(driver: DriverCreate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO drivers (name, dl_number, aadhaar_number, mobile_number, dl_expiry_date) VALUES (%s, %s, %s, %s, %s);", (driver.name, driver.dl_number, driver.aadhaar_number, driver.mobile_number, driver.dl_expiry_date))
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Driver Registered", f"Added driver {driver.name}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Driver Registered", f"Added driver {driver.name}"))
        conn.commit(); return {"status": "Success"}
    except errors.UniqueViolation:
        conn.rollback(); raise HTTPException(status_code=400, detail="Driver with this identifier already registered.")
    finally: cursor.close(); conn.close()

@app.put("/drivers/{driver_id}")
def update_driver(driver_id: int, driver: DriverUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE drivers 
            SET name = %s, dl_number = %s, aadhaar_number = %s, mobile_number = %s, dl_expiry_date = %s 
            WHERE driver_id = %s RETURNING driver_id;
        """, (driver.name, driver.dl_number, driver.aadhaar_number, driver.mobile_number, driver.dl_expiry_date, driver_id))
        updated = cursor.fetchone()
        if not updated: raise HTTPException(status_code=404, detail="Driver not found")
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Driver Updated", f"Modified driver {driver.name}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Driver Updated", f"Modified driver {driver.name}"))
        conn.commit(); return {"status": "Success"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.get("/drivers/expiring-licenses")
def get_expiring_licenses():
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("SELECT * FROM drivers;")
    drivers = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    expiring = []
    thresh = date.today() + timedelta(days=30)
    for drv in drivers:
        if drv.get("dl_expiry_date"):
            exp_d = date.fromisoformat(str(drv["dl_expiry_date"])[:10])
            if exp_d <= thresh:
                expiring.append({"name": drv["name"], "dl_number": drv["dl_number"], "status": "Expired" if exp_d < date.today() else "Expiring Soon"})
    return expiring

@app.get("/trips/truck/{vehicle_no}")
def get_trips_by_truck(vehicle_no: str):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.freight_amount, f.adv_amt, f.balance_payment, f.total_km 
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE t.vehicle_number = %s
        ORDER BY t.trip_start_date DESC, t.trip_id DESC;
    """, (vehicle_no.upper().strip(),))
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.get("/trips/by-party/{party_name}")
def get_trips_by_party(party_name: str):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.freight_amount, f.adv_amt, f.balance_payment, f.total_km
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE t.party_name = %s 
        ORDER BY t.trip_start_date DESC;
    """, (party_name,))
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.get("/trips/by-driver/{driver_name}")
def get_trips_by_driver(driver_name: str):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.total_km, f.driver_advance, f.driver_remaining, f.driver_total, f.driver_paid, f.driver_payment_date, f.diesel_liters_needed, f.diesel_cost, a.mileage
        FROM trips t 
        JOIN assets a ON t.vehicle_number = a.vehicle_number 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE a.driver_name = %s 
        ORDER BY t.trip_start_date DESC;
    """, (driver_name,))
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.post("/finances/settle-driver")
def settle_driver_payment(data: DriverSettleUpdate, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("UPDATE trip_finances SET driver_paid = TRUE, driver_payment_date = %s WHERE trip_id = %s;", (data.payment_date, data.trip_id))
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Driver Settled", f"Marked driver payment settled for Trip {data.trip_id}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Driver Settled", f"Marked driver payment settled for Trip {data.trip_id}"))
        conn.commit(); return {"status": "Success"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

# 🌟 IST (+5:30) TIMESTAMPS
@app.get("/logs")
def get_system_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT id, action, details, username, 
                   TO_CHAR((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI:SS AM') AS formatted_time
            FROM activity_logs 
            ORDER BY created_at DESC 
            LIMIT 50;
        """)
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]
    except Exception:
        try:
            cursor.execute("""
                SELECT id, action, details, 
                       TO_CHAR((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY, HH12:MI:SS AM') AS formatted_time
                FROM activity_logs 
                ORDER BY created_at DESC 
                LIMIT 50;
            """)
            cols = [d[0] for d in cursor.description]
            return [dict(zip(cols, row)) for row in cursor.fetchall()]
        except Exception:
            return []
    finally:
        cursor.close(); conn.close()

@app.get("/trips/{trip_id}/driver-hisaab")
def get_driver_hisaab(trip_id: int):
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("SELECT driver_hisaab_entries FROM trip_finances WHERE trip_id = %s;", (trip_id,))
        row = cursor.fetchone()
        if not row: return []
        entries = row[0]
        if isinstance(entries, str): entries = json.loads(entries)
        return entries or []
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.post("/trips/{trip_id}/driver-hisaab")
def add_driver_hisaab(trip_id: int, item: DriverHisaabItem, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("SELECT driver_hisaab_entries FROM trip_finances WHERE trip_id = %s;", (trip_id,))
        row = cursor.fetchone()
        if not row: raise HTTPException(status_code=404, detail="Trip finances not found")
        
        entries = row[0]
        if isinstance(entries, str): entries = json.loads(entries)
        if not isinstance(entries, list): entries = []
            
        new_entry = {
            "amount": item.amount, "date": item.date, "category": item.category,
            "liters": item.liters if item.category == "Diesel" else 0.0,
            "place": item.place, "reason": item.reason, "employee": item.employee or ""
        }
        entries.append(new_entry)
        cursor.execute("UPDATE trip_finances SET driver_hisaab_entries = %s WHERE trip_id = %s;", (json.dumps(entries), trip_id))
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Hisaab Added", f"Trip {trip_id}: Logged {item.category} of ₹{item.amount}", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Hisaab Added", f"Trip {trip_id}: Logged {item.category} of ₹{item.amount}"))
        conn.commit(); return {"status": "Success", "entries": entries}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.delete("/trips/{trip_id}/driver-hisaab/{index}")
def delete_driver_hisaab(trip_id: int, index: int, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("SELECT driver_hisaab_entries FROM trip_finances WHERE trip_id = %s;", (trip_id,))
        row = cursor.fetchone()
        if not row: raise HTTPException(status_code=404, detail="Trip finances not found")
        
        entries = row[0]
        if isinstance(entries, str): entries = json.loads(entries)
        if not isinstance(entries, list): entries = []
            
        if 0 <= index < len(entries):
            removed = entries.pop(index)
            cursor.execute("UPDATE trip_finances SET driver_hisaab_entries = %s WHERE trip_id = %s;", (json.dumps(entries), trip_id))
            try:
                cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Hisaab Removed", f"Trip {trip_id}: Deleted entry of ₹{removed.get('amount', 0)}", current_user))
            except Exception:
                cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Hisaab Removed", f"Trip {trip_id}: Deleted entry"))
            conn.commit(); return {"status": "Success", "entries": entries}
        else:
            raise HTTPException(status_code=400, detail="Invalid entry index")
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

# --- EMPLOYEE DIRECTORY & LEDGER ENDPOINTS ---
@app.get("/employees")
def get_employees():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, name, role, phone, is_active FROM employees ORDER BY id ASC;")
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.post("/employees")
def add_employee(data: dict, request: Request):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO employees (name, role, phone) VALUES (%s, %s, %s) RETURNING id;",
            (data.get("name"), data.get("role", "Employee"), data.get("phone", ""))
        )
        new_id = cursor.fetchone()[0]
        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", ("Employee Added", f"Added staff {data.get('name')}", current_user))
        except Exception:
            pass
        conn.commit()
        return {"status": "Success", "id": new_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/employees/ledger-summary")
def get_employee_ledger_summary(month: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        month_filter = "AND TO_CHAR(transaction_date, 'YYYY-MM') = %s" if month else ""
        params = [month] if month else []

        query = f"""
            SELECT 
                employee_name,
                COALESCE(SUM(CASE WHEN transaction_type = 'LOADED' THEN amount ELSE 0 END), 0) AS total_loaded,
                COALESCE(SUM(CASE WHEN transaction_type = 'DISBURSED' THEN amount ELSE 0 END), 0) AS total_disbursed,
                COALESCE(SUM(CASE WHEN transaction_type = 'RETURNED' THEN amount ELSE 0 END), 0) AS total_returned
            FROM employee_ledger
            WHERE 1=1 {month_filter}
            GROUP BY employee_name
            ORDER BY total_disbursed DESC;
        """
        cursor.execute(query, tuple(params))
        summary = []
        for row in cursor.fetchall():
            emp, loaded, disbursed, returned = row
            net_given = float(loaded) - float(returned)
            remaining_float = net_given - float(disbursed)
            summary.append({
                "employee_name": emp,
                "total_loaded": float(loaded),
                "total_returned": float(returned),
                "net_given": net_given,
                "total_disbursed": float(disbursed),
                "remaining_float": remaining_float
            })
        return summary
    except Exception:
        return []
    finally:
        cursor.close()
        conn.close()

@app.get("/employees/ledger-entries")
def get_employee_ledger_entries(employee: Optional[str] = None, month: Optional[str] = None, date_str: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = "SELECT * FROM employee_ledger WHERE 1=1"
        params = []
        if employee and employee != 'All':
            query += " AND employee_name = %s"
            params.append(employee)
        if date_str:
            query += " AND transaction_date = %s"
            params.append(date_str)
        elif month:
            query += " AND TO_CHAR(transaction_date, 'YYYY-MM') = %s"
            params.append(month)

        query += " ORDER BY transaction_date DESC, id DESC;"
        cursor.execute(query, tuple(params))
        cols = [d[0] for d in cursor.description]
        return [dict(zip(cols, row)) for row in cursor.fetchall()]
    except Exception:
        return []
    finally:
        cursor.close()
        conn.close()

# 🌟 UNIFIED RECONCILER WITH NEXT-TRIP PRIORITY & PREVIOUS-TRIP FALLBACK
@app.post("/reconcile/upload-statements")
async def reconcile_statements(
    request: Request,
    statement_type: str = Form(...),
    files: List[UploadFile] = File(...)
):
    current_user = get_current_user(request)
    conn = get_db_connection()
    cursor = conn.cursor()

    summary = {
        "statement_type": statement_type,
        "files_processed": len(files),
        "entries_added": 0,
        "duplicates_skipped": 0,
        "unmatched_records": 0
    }

    try:
        # Load all trips (both active and completed) so refuels on edge dates are never dropped
        cursor.execute("""
            SELECT t.trip_id, t.vehicle_number, t.trip_start_date, t.actual_delivery_date,
                   tf.fastag_details, tf.driver_hisaab_entries, tf.advance_details
            FROM trips t
            LEFT JOIN trip_finances tf ON t.trip_id = tf.trip_id
            ORDER BY t.trip_id ASC;
        """)
        trip_rows = cursor.fetchall()

        all_records = []
        for file in files:
            file_bytes = await file.read()
            parsed = parse_vendor_file(file_bytes, file.filename)
            all_records.extend(parsed)

        trip_cache = {}
        vehicle_trips = {}
        for t in trip_rows:
            t_trip_id, t_veh, t_start, t_deliv, f_tag, d_hisaab, d_adv = t
            fastag_list = json.loads(f_tag) if isinstance(f_tag, str) else (f_tag or [])
            hisaab_list = json.loads(d_hisaab) if isinstance(d_hisaab, str) else (d_hisaab or [])
            adv_list = json.loads(d_adv) if isinstance(d_adv, str) else (d_adv or [])
            
            t_data = {
                "trip_id": t_trip_id,
                "vehicle": t_veh,
                "start": str(t_start)[:10] if t_start else "1970-01-01",
                "deliv": str(t_deliv)[:10] if t_deliv else None,
                "fastag_list": fastag_list,
                "hisaab_list": hisaab_list,
                "adv_list": adv_list,
                "dirty_fastag": False,
                "dirty_hisaab": False,
                "dirty_adv": False
            }
            trip_cache[t_trip_id] = t_data

            veh_clean = clean_vehicle(t_veh)
            if veh_clean:
                if veh_clean not in vehicle_trips:
                    vehicle_trips[veh_clean] = []
                vehicle_trips[veh_clean].append(t_data)

        # Sort each vehicle's trips by start date ascending
        for veh_clean in vehicle_trips:
            vehicle_trips[veh_clean].sort(key=lambda x: x["start"])

        # Match each parsed record to its trip
        for rec in all_records:
            veh = rec.get("vehicle")
            rec_date = rec.get("date")
            fp = rec.get("fingerprint")

            trips_for_v = []
            if veh:
                v_clean = clean_vehicle(veh)
                for db_veh, t_list in vehicle_trips.items():
                    if is_vehicle_match(v_clean, db_veh):
                        trips_for_v = t_list
                        break

            target_trip = None
            if trips_for_v:
                # 1. Exact match: Check if transaction falls within an active/completed trip window
                for t_data in trips_for_v:
                    t_start = t_data["start"]
                    t_deliv = t_data.get("deliv")
                    if t_deliv:
                        if t_start <= rec_date <= t_deliv:
                            target_trip = t_data
                            break
                    else:
                        if t_start <= rec_date:
                            target_trip = t_data
                            break

                # 🌟 2. Priority 1: Next Trip (the upcoming trip scheduled on or after transaction date)
                if not target_trip:
                    future_trips = [t for t in trips_for_v if t["start"] >= rec_date]
                    if future_trips:
                        future_trips.sort(key=lambda t: t["start"])
                        target_trip = future_trips[0]

                # 🌟 3. Priority 2: Previous Trip (if no next trip exists, attach to the most recent trip before the date)
                if not target_trip:
                    past_trips = [t for t in trips_for_v if t["start"] <= rec_date]
                    if past_trips:
                        past_trips.sort(key=lambda t: t["start"], reverse=True)
                        target_trip = past_trips[0]

                # 4. Final safety fallback: attach to latest trip in system for this vehicle
                if not target_trip:
                    target_trip = trips_for_v[-1]

            # 1. FASTAG TOLLS ALLOCATION
            if rec.get("type") == "FASTAG" and target_trip:
                fl = target_trip["fastag_list"]
                is_duplicate = any(
                    x.get("fingerprint") == fp or (
                        x.get("date") == rec["date"] and 
                        abs(float(x.get("amount", 0)) - rec["amount"]) < 0.01 and 
                        x.get("place") == rec["place"]
                    )
                    for x in fl
                )
                if is_duplicate:
                    summary["duplicates_skipped"] += 1
                else:
                    fl.append({
                        "date": rec["date"], 
                        "txn_time": rec.get("txn_time"),
                        "acct_time": rec.get("acct_time"),
                        "place": rec["place"], 
                        "amount": rec["amount"],
                        "balance": rec.get("balance"),
                        "fingerprint": fp
                    })
                    fl.sort(key=lambda x: x.get("txn_time") or x.get("date", ""))
                    target_trip["dirty_fastag"] = True
                    summary["entries_added"] += 1

            # 2. DIESEL LOGS ALLOCATION
            elif rec.get("type") == "DIESEL" and target_trip:
                hl = target_trip["hisaab_list"]
                is_duplicate = any(
                    x.get("fingerprint") == fp or (
                        x.get("date") == rec["date"] and 
                        x.get("category") == "Diesel" and 
                        abs(float(x.get("amount", 0)) - rec["amount"]) < 0.01 and 
                        abs(float(x.get("liters", 0)) - rec.get("liters", 0)) < 0.1
                    )
                    for x in hl
                )
                if is_duplicate:
                    summary["duplicates_skipped"] += 1
                else:
                    hl.append({
                        "date": rec["date"], 
                        "txn_time": rec.get("txn_time"),
                        "category": "Diesel", 
                        "amount": rec["amount"],
                        "liters": rec.get("liters", 0.0), 
                        "place": rec["place"],
                        "reason": f"Fuel: {rec.get('liters', 0)} Ltrs at {rec['place']}",
                        "fingerprint": fp
                    })
                    hl.sort(key=lambda x: x.get("txn_time") or x.get("date", ""))
                    target_trip["dirty_hisaab"] = True
                    summary["entries_added"] += 1

            # 3. EMPLOYEE / CARD EXPENSES (OMNI & I-FLEET)
            elif rec.get("type") == "EMPLOYEE_EXPENSE":
                emp_name = rec.get("employee") or "Office Staff"
                cat = rec.get("category") or "Miscellaneous"
                act_type = rec.get("action_type") or "DISBURSED"

                try:
                    cursor.execute("""
                        INSERT INTO employee_ledger (transaction_date, employee_name, transaction_type, amount, vehicle_number, trip_id, expense_category, recipient_name, raw_notes, source_file)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                    """, (
                        rec["date"], emp_name, act_type, rec["amount"],
                        target_trip["vehicle"] if target_trip else rec.get("vehicle"),
                        target_trip["trip_id"] if target_trip else None,
                        cat, rec.get("place"), rec.get("raw_notes"), rec.get("source_file")
                    ))
                    summary["entries_added"] += 1
                except Exception as ex:
                    print("Ledger insert error:", ex)

                if target_trip and act_type == "DISBURSED":
                    if cat == "Advance":
                        al = target_trip["adv_list"]
                        al.append({
                            "date": rec["date"], 
                            "amount": rec["amount"], 
                            "source": f"Paid by {emp_name} ({rec.get('place', '')})"
                        })
                        al.sort(key=lambda x: x.get("date", ""))
                        target_trip["dirty_adv"] = True
                    else:
                        hl = target_trip["hisaab_list"]
                        hl.append({
                            "date": rec["date"], 
                            "category": cat, 
                            "amount": rec["amount"],
                            "liters": 0.0, 
                            "place": rec.get("place", ""),
                            "reason": f"{rec.get('remarks', '')} (Card by {emp_name})"
                        })
                        hl.sort(key=lambda x: x.get("date", ""))
                        target_trip["dirty_hisaab"] = True
            else:
                summary["unmatched_records"] += 1

        # Commit updates back to database
        for t_id, t_data in trip_cache.items():
            if t_data["dirty_fastag"]:
                cursor.execute("UPDATE trip_finances SET fastag_details = %s WHERE trip_id = %s;", (json.dumps(t_data["fastag_list"]), t_id))
            if t_data["dirty_hisaab"]:
                cursor.execute("UPDATE trip_finances SET driver_hisaab_entries = %s WHERE trip_id = %s;", (json.dumps(t_data["hisaab_list"]), t_id))
            if t_data["dirty_adv"]:
                total_adv = sum(safe_float(a.get("amount", 0)) for a in t_data["adv_list"])
                cursor.execute("UPDATE trip_finances SET advance_details = %s, adv_amt = %s WHERE trip_id = %s;", (json.dumps(t_data["adv_list"]), total_adv, t_id))

        try:
            cursor.execute("INSERT INTO activity_logs (action, details, username) VALUES (%s, %s, %s)", (f"{statement_type} Reconcile", f"Imported {summary['entries_added']} entries into ledger", current_user))
        except Exception:
            cursor.execute("INSERT INTO activity_logs (action, details) VALUES (%s, %s)", ("Reconcile Sync", f"Imported {summary['entries_added']} entries"))

        conn.commit()
        return {"status": "Success", "summary": summary}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()