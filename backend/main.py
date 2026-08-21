from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db_connection
from datetime import date, datetime, timedelta
import os
import psycopg2
from psycopg2 import errors
import requests
import shutil
import json
import time
import concurrent.futures
from dotenv import load_dotenv
from typing import Optional

load_dotenv()
TAABI_API_KEY = os.getenv("TAABI_API_KEY")

app = FastAPI(title="Jain Freight Carrier")

# 🌟 STRICT CORS FIX: Explicitly allowing your Vite frontend to prevent blocking
app.add_middleware(
    CORSMiddleware, 
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://logistic-hub-ten.vercel.app"
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
    lw: Optional[str] = ""
    freight_amount: Optional[float] = 0.0 
    total_km: Optional[float] = 0.0

class TripCompleteUpdate(BaseModel):
    actual_delivery_date: date
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

# --- TAABI TELEMETRY & V3 FUEL API ---
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
                return {
                    "internal_id": dev.get('vehicleNumber', vehicle_number),
                    "speed": dev['speed'], "lat": dev['latitude'], "lng": dev['longitude'],
                    "fuel_level": dev.get('fuelValueLtrs', 'N/A'), "urea_level": dev.get('adblue_level', 'N/A'),
                    "status": "Halted" if dev['haltStatus'] else "Moving"
                }
        return {"internal_id": vehicle_number, "speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Not Found"}
    except Exception:
        return {"internal_id": vehicle_number, "speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Offline"}

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
    except Exception as e:
        return {}

@app.get("/taabi/bulk")
def get_bulk_taabi():
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    query = "query getAllDeviceLocations($configs: Configs) { devices: getAllDeviceLocations(configs: $configs) { vehicleNumber, fuelValueLtrs, speed, haltStatus, latitude, longitude } }"
    payload = {"query": query, "variables": {"configs": {}}}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
    try:
        devices = requests.post(url, json=payload, headers=headers, timeout=10).json().get("data", {}).get("devices", [])
        fuel_map = {}
        for dev in devices:
            clean_vn = str(dev['vehicleNumber']).replace("-", "").replace(" ", "").upper()
            fuel_map[clean_vn] = {
                "internal_id": dev.get('vehicleNumber', clean_vn),
                "fuel": dev.get('fuelValueLtrs', 'N/A'), "speed": dev.get('speed', 0),
                "status": "Halted" if dev.get('haltStatus') else "Moving",
                "lat": dev.get('latitude', ''), "lng": dev.get('longitude', '')
            }
        return fuel_map
    except Exception:
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
        return vn, get_taabi_fuel_analytics(internal_id, s_date, None)

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(fetch_for_vehicle, row[0], row[1]) for row in active_trips]
        for future in concurrent.futures.as_completed(futures):
            vn, data = future.result()
            clean_vn = vn.replace("-", "").replace(" ", "").upper()
            results[clean_vn] = data
    return results

# --- CORE ENDPOINTS ---

@app.get("/assets")
def get_all_assets():
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets;")
    assets = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return assets

@app.post("/assets")
async def create_asset(vehicle_number: str = Form(...), driver_name: str = Form(...), per_km_rate: float = Form(...), compensation_type: str = Form('KM Based'), mileage: float = Form(0.0), fixed_salary: float = Form(0.0)):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("INSERT INTO assets (vehicle_number, driver_name, per_km_rate, current_status, compensation_type, mileage, fixed_salary) VALUES (%s, %s, %s, 'Available', %s, %s, %s);", (vehicle_number.upper().strip(), driver_name, per_km_rate, compensation_type, mileage, fixed_salary))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/assets/{vehicle_no}")
def update_asset(vehicle_no: str, asset: AssetUpdate):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("UPDATE assets SET driver_name = %s, per_km_rate = %s, current_status = %s, compensation_type = %s, mileage = %s, fixed_salary = %s WHERE vehicle_number = %s RETURNING vehicle_number;", (asset.driver_name, asset.per_km_rate, asset.current_status, asset.compensation_type, asset.mileage, asset.fixed_salary, vehicle_no.upper().strip()))
    updated = cursor.fetchone()
    conn.commit(); cursor.close(); conn.close()
    if not updated: raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"status": "Updated", "vehicle_number": updated[0]}

@app.delete("/assets/{vehicle_number}")
def delete_asset(vehicle_number: str):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("UPDATE assets SET current_status = 'Archived' WHERE vehicle_number = %s RETURNING vehicle_number;", (vehicle_number.upper().strip(),))
    archived = cursor.fetchone()
    conn.commit(); cursor.close(); conn.close()
    return {"status": "Archived", "vehicle_number": archived[0]}

@app.post("/trips")
def create_trip(trip: TripCreate):
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO trips (vehicle_number, source_city, destination_city, party_name, owner_name, gta_name, lr_no, eway_bill, eway_bill_expiry, trip_start_date, lw) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING trip_id;", (trip.vehicle_number.upper().strip(), trip.source_city, trip.destination_city, trip.party_name, trip.owner_name, trip.gta_name, trip.lr_no, trip.eway_bill, trip.eway_bill_expiry, trip.trip_start_date, trip.lw))
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
            INSERT INTO trip_finances (trip_id, freight_amount, gst, balance_payment, total_km, driver_advance, driver_remaining, driver_total, gst_enabled, fastag_estimate, diesel_liters_needed, diesel_cost) 
            VALUES (%s, %s, 0.0, %s, %s, %s, %s, %s, FALSE, %s, %s, %s)
        """, (trip_id, freight, freight, total_km, total_km * 3.5, total_km * 1.0, total_km * 4.5, fastag_est, diesel_liters_needed, diesel_cost))
        
        cursor.execute("UPDATE assets SET current_status = 'In-Transit' WHERE vehicle_number = %s;", (trip.vehicle_number.upper().strip(),))
        conn.commit()
        return {"message": "Trip launched", "tracking_number": tracking_number}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}")
def update_trip(trip_id: int, trip_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        start_date = trip_data.get('trip_start_date')
        start_date = None if start_date == '' else start_date
        
        exp_date = trip_data.get('eway_bill_expiry')
        exp_date = None if exp_date == '' else exp_date
        
        new_km = safe_float(trip_data.get('total_km'))
        new_freight = safe_float(trip_data.get('freight_amount'))

        fastag_est = new_km * 5.75
        
        cursor.execute("""
            UPDATE trips 
            SET vehicle_number=%s, source_city=%s, destination_city=%s, party_name=%s, 
                owner_name=%s, gta_name=%s, lr_no=%s, eway_bill=%s, eway_bill_expiry=%s, 
                trip_start_date=%s, lw=%s 
            WHERE trip_id=%s
        """, (
            trip_data.get('vehicle_number'), trip_data.get('source_city'), trip_data.get('destination_city'),
            trip_data.get('party_name'), trip_data.get('owner_name'), trip_data.get('gta_name'),
            trip_data.get('lr_no'), trip_data.get('eway_bill'), exp_date, start_date, trip_data.get('lw'), trip_id
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
                    diesel_liters_needed=%s, diesel_cost=%s, fastag_estimate=%s 
                WHERE trip_id=%s
            """, (new_freight, new_km, new_gst, balance, new_km*3.5, new_km*1.0, new_km*4.5, diesel_req, diesel_cost, fastag_est, trip_id))
            
        conn.commit()
        return {"message": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}/locked-edit")
def locked_edit_trip(trip_id: int, trip_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT is_locked FROM trips WHERE trip_id = %s", (trip_id,))
        if cursor.fetchone()[0]: raise HTTPException(status_code=400, detail="Permanently locked.")
        
        start_date = trip_data.get('trip_start_date')
        start_date = None if start_date == '' else start_date
        
        exp_date = trip_data.get('eway_bill_expiry')
        exp_date = None if exp_date == '' else exp_date
        
        new_km = safe_float(trip_data.get('total_km'))
        new_freight = safe_float(trip_data.get('freight_amount'))

        fastag_est = new_km * 5.75

        cursor.execute("""
            UPDATE trips 
            SET vehicle_number=%s, source_city=%s, destination_city=%s, party_name=%s, 
                owner_name=%s, gta_name=%s, lr_no=%s, eway_bill=%s, eway_bill_expiry=%s, 
                trip_start_date=%s, lw=%s, is_locked=TRUE 
            WHERE trip_id=%s
        """, (
            trip_data.get('vehicle_number'), trip_data.get('source_city'), trip_data.get('destination_city'),
            trip_data.get('party_name'), trip_data.get('owner_name'), trip_data.get('gta_name'),
            trip_data.get('lr_no'), trip_data.get('eway_bill'), exp_date, start_date, trip_data.get('lw'), trip_id
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
                    diesel_liters_needed=%s, diesel_cost=%s, fastag_estimate=%s 
                WHERE trip_id=%s
            """, (new_freight, new_km, new_gst, balance, new_km*3.5, new_km*1.0, new_km*4.5, diesel_req, diesel_cost, fastag_est, trip_id))
            
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()
@app.get("/trips/history")
def get_trip_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, 
               f.freight_amount, f.adv_amt, f.balance_payment, f.total_km, 
               f.diesel_liters_needed, f.fastag_estimate, f.driver_advance, 
               f.driver_remaining, f.driver_total, f.driver_paid, f.driver_payment_date,
               f.trip_unloaded, f.pod_status, f.pod_arrived_office_date, 
               f.pod_forwarded_client_date, f.pod_received_client_date, f.amount_cleared
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.actual_delivery_date IS NOT NULL 
        ORDER BY t.actual_delivery_date DESC, t.trip_id DESC;
    """)
    res = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return res


@app.get("/trips/active")
def get_active_trips():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, a.driver_name, 
               f.freight_amount, f.adv_amt, f.balance_payment, f.total_km, 
               f.diesel_liters_needed, f.fastag_estimate, f.driver_advance, 
               f.driver_remaining, f.driver_total, f.driver_paid, f.driver_payment_date,
               f.trip_unloaded, f.pod_status, f.pod_arrived_office_date, 
               f.pod_forwarded_client_date, f.pod_received_client_date, f.amount_cleared
        FROM trips t 
        LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.actual_delivery_date IS NULL 
        ORDER BY t.trip_start_date DESC;
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
        SELECT t.*, f.total_km, f.freight_amount, f.balance_payment, f.pod_status AS finance_pod_status 
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        ORDER BY t.trip_id DESC;
    """)
    res = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return res


@app.delete("/trips/{trip_id}")
def force_delete_trip(trip_id: int):
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM trip_finances WHERE trip_id = %s;", (trip_id,))
        cursor.execute("DELETE FROM trips WHERE trip_id = %s RETURNING vehicle_number;", (trip_id,))
        res = cursor.fetchone()
        if res: cursor.execute("UPDATE assets SET current_status = 'Available' WHERE vehicle_number = %s;", (res[0],))
        conn.commit(); return {"status": "Deleted"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}/complete")
def complete_trip(trip_id: int, data: TripCompleteUpdate):
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("UPDATE trips SET actual_delivery_date = %s WHERE trip_id = %s RETURNING vehicle_number;", (data.actual_delivery_date, trip_id))
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
            cursor.execute("UPDATE trip_finances SET pod_image_url=COALESCE(%s, pod_image_url), trip_unloaded=%s, pod_status=%s, pod_arrived_office_date=%s, pod_forwarded_client_date=%s, pod_received_client_date=%s, advance_details=%s, adv_amt=%s, balance_payment=%s, amount_cleared=%s WHERE trip_id=%s;", (data.pod_image_path, data.trip_unloaded, data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, json.dumps(adv_details), total_adv, balance, balance<=0, trip_id))
        conn.commit(); return {"status": "Success"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/finances/{trip_id}/checklist")
def update_checklist(trip_id: int, data: ChecklistUpdate):
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("SELECT advance_details, freight_amount, loading_charge, holding_charge, gst, tds, extra_deduction FROM trip_finances WHERE trip_id = %s", (trip_id,))
        row = cursor.fetchone()
        if row:
            adv_details = json.loads(row[0]) if isinstance(row[0], str) else (row[0] or [])
            if data.cleared_amount and safe_float(data.cleared_amount) > 0:
                adv_details.append({"date": (data.cleared_date or date.today()).isoformat(), "amount": safe_float(data.cleared_amount)})
            total_adv = sum(safe_float(a.get('amount')) for a in adv_details if isinstance(a, dict))
            balance = (safe_float(row[1]) + safe_float(row[2]) + safe_float(row[3]) + safe_float(row[4])) - (total_adv + safe_float(row[5]) + safe_float(row[6]))
            cursor.execute("UPDATE trip_finances SET trip_unloaded=%s, pod_status=%s, pod_arrived_office_date=%s, pod_forwarded_client_date=%s, pod_received_client_date=%s, advance_details=%s, adv_amt=%s, balance_payment=%s, amount_cleared=%s WHERE trip_id=%s;", (data.trip_unloaded, data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, json.dumps(adv_details), total_adv, balance, balance<=0, trip_id))
        conn.commit(); return {"status": "Success"}
    except Exception as e:
        conn.rollback(); raise HTTPException(status_code=400, detail=str(e))
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
    res['fuel_analytics'] = get_taabi_fuel_analytics(internal_id, res['trip_start_date'], res.get('actual_delivery_date'))
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
               f.advance_details, f.fastag_details, f.finance_remarks,
               f.loading_charge, f.holding_charge, f.gst, f.tds, f.extra_deduction,
               f.gst_enabled, f.bill_no, f.bank_account
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.trip_id = %s;
    """, (trip_id,))
    row = cursor.fetchone()
    if not row: raise HTTPException(status_code=404, detail="Trip not found")
    res = dict(zip([d[0] for d in cursor.description], row))
    cursor.close()
    conn.close()
    return res

@app.post("/finances/calculate")
def calculate_finance(data: dict):
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
        
        # 🌟 UPDATED: Fetching vehicle_number along with mileage
        cursor.execute("SELECT a.mileage, t.vehicle_number FROM trips t LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE t.trip_id = %s;", (trip_id,))
        m_row = cursor.fetchone()
        mile = float(m_row[0]) if m_row and m_row[0] else 5.5
        vehicle_no = str(m_row[1]).strip() if m_row and m_row[1] else "0000"
        
        diesel_needed = round(total_km / mile, 2) if mile > 0 else 0
        
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
            json.dumps(advances), json.dumps(fastag_det), total_km * 5.75, 
            data.get('bill_no', ''), diesel_needed, data.get('bank_account', ''), 
            gst_en, bool(data.get('include_loading_in_gst', False)), bool(data.get('include_holding_in_gst', False)), 
            trip_id
        ))
        
        # 🌟 UPDATED: Log only the last 4 digits of the truck
        last_4 = vehicle_no[-4:] if len(vehicle_no) >= 4 else vehicle_no
        log_details = f"Financial ledger updated for Truck ending in {last_4}. Freight: ₹{freight}, New Balance: ₹{balance}"
        cursor.execute("""
            INSERT INTO activity_logs (action, details) 
            VALUES (%s, %s)
        """, ("Finance Edited", log_details))
        
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/finances/{trip_id}/pod")
def update_pod(trip_id: int, data: PODUpdate):
    conn = get_db_connection(); cursor = conn.cursor()
    cursor.execute("UPDATE trip_finances SET pod_status=%s, pod_arrived_office_date=%s, pod_forwarded_client_date=%s, pod_received_client_date=%s WHERE trip_id=%s;", (data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, trip_id))
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
def add_driver(driver: DriverCreate):
    conn = get_db_connection(); cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO drivers (name, dl_number, aadhaar_number, mobile_number, dl_expiry_date) VALUES (%s, %s, %s, %s, %s);", (driver.name, driver.dl_number, driver.aadhaar_number, driver.mobile_number, driver.dl_expiry_date))
        conn.commit(); return {"status": "Success"}
    except errors.UniqueViolation:
        conn.rollback(); raise HTTPException(status_code=400, detail="Driver with this DL Number or Aadhaar already registered.")
    finally: cursor.close(); conn.close()

@app.put("/drivers/{driver_id}")
def update_driver(driver_id: int, driver: DriverUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE drivers 
            SET name = %s, dl_number = %s, aadhaar_number = %s, mobile_number = %s, dl_expiry_date = %s 
            WHERE driver_id = %s RETURNING driver_id;
        """, (driver.name, driver.dl_number, driver.aadhaar_number, driver.mobile_number, driver.dl_expiry_date, driver_id))
        updated = cursor.fetchone()
        conn.commit()
        if not updated:
            raise HTTPException(status_code=404, detail="Driver not found")
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

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
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.freight_amount, f.adv_amt, f.balance_payment, f.total_km 
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE t.vehicle_number = %s
        ORDER BY t.trip_start_date DESC, t.trip_id DESC;
    """, (vehicle_no.upper().strip(),))
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return res

@app.get("/trips/by-party/{party_name}")
def get_trips_by_party(party_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.freight_amount, f.adv_amt, f.balance_payment, f.total_km
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE t.party_name = %s 
        ORDER BY t.trip_start_date DESC;
    """, (party_name,))
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return res

@app.get("/trips/by-driver/{driver_name}")
def get_trips_by_driver(driver_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
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
    cursor.close()
    conn.close()
    return res

@app.post("/finances/settle-driver")
def settle_driver_payment(data: DriverSettleUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE trip_finances 
            SET driver_paid = TRUE, driver_payment_date = %s 
            WHERE trip_id = %s;
        """, (data.payment_date, data.trip_id))
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/logs")
def get_system_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, action, details, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 50;")
        res = [dict(zip([d[0] for d in cursor.description], row)) for row in cursor.fetchall()]
        return res
    except Exception as e:
        return []
    finally:
        cursor.close()
        conn.close()