from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_db_connection
from datetime import date, datetime
import os
import psycopg2
import requests
import shutil
from dotenv import load_dotenv
from typing import Optional
from datetime import date, timedelta

# --- CONFIGURATION ---
load_dotenv()
TAABI_API_KEY = os.getenv("TAABI_API_KEY")

app = FastAPI(title="Jain Freight Carrier")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)

# --- MODELS ---
class TripCreate(BaseModel):
    vehicle_number: str
    source_city: str
    destination_city: str
    party_name: str
    gta_name: str
    lr_no: str
    eway_bill: str = ""  # <--- FIXED: Now optional, defaults to empty string!
    eway_bill_expiry: date
    trip_start_date: date = date.today()
    lw: str

class TripCompleteUpdate(BaseModel):
    actual_delivery_date: date
    pod_image_path: Optional[str] = None
    api_fuel_consumed_liters: float = 0.0
    fuel_expenses_cost: float = 0.0

class PODUpdate(BaseModel):
    pod_status: str
    pod_arrived_office_date: Optional[date] = None
    pod_forwarded_client_date: Optional[date] = None

class DriverCreate(BaseModel):
    name: str
    dl_number: str
    aadhaar_number: str
    mobile_number: Optional[str] = None
    dl_expiry_date: Optional[date] = None

class DriverUpdate(DriverCreate):
    pass

class AssetUpdate(BaseModel):
    driver_name: str
    per_km_rate: float
    current_status: str

# --- TELEMETRY ENGINE (PRESERVED) ---
def get_taabi_live_data(vehicle_number):
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    query = """
    query getAllDeviceLocations($configs: Configs) {
        devices: getAllDeviceLocations(configs: $configs) {
            vehicleNumber, speed, haltStatus, latitude, longitude, fuelValueLtrs, ureaLevel
        }
    }
    """
    payload = {"query": query, "variables": {"configs": {}}}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        data = response.json()
        devices = data.get("data", {}).get("devices", [])
        db_clean = str(vehicle_number).replace("-", "").upper()
        for dev in devices:
            api_clean = str(dev['vehicleNumber']).replace("-", "").upper()
            if db_clean in api_clean or api_clean in db_clean:
                return {
                    "speed": dev['speed'], "lat": dev['latitude'], "lng": dev['longitude'],
                    "fuel_level": dev.get('fuelValueLtrs', 'N/A'), "urea_level": dev.get('ureaLevel', 'N/A'),
                    "status": "Halted" if dev['haltStatus'] else "Moving"
                }
        return {"speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Not Found"}
    except Exception:
        return {"speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Offline"}

# --- ASSET ENDPOINTS ---
@app.get("/assets")
def get_all_assets():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM assets;")
    cols = [d[0] for d in cursor.description]
    assets = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return assets

@app.post("/assets")
async def create_asset(
    vehicle_number: str = Form(...),
    driver_name: str = Form(...),
    per_km_rate: float = Form(...)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO assets (vehicle_number, driver_name, per_km_rate, current_status)
        VALUES (%s, %s, %s, 'Available');
    """, (vehicle_number.upper().strip(), driver_name, per_km_rate))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/assets/{vehicle_no}")
def update_asset(vehicle_no: str, asset: AssetUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE assets
        SET driver_name = %s, per_km_rate = %s, current_status = %s
        WHERE vehicle_number = %s
        RETURNING vehicle_number;
    """, (asset.driver_name, asset.per_km_rate, asset.current_status,
          vehicle_no.upper().strip()))
    updated_vehicle = cursor.fetchone()
    conn.commit()
    cursor.close(); conn.close()

    if not updated_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"status": "Updated", "vehicle_number": updated_vehicle[0]}

@app.delete("/assets/{vehicle_number}")
def delete_asset(vehicle_number: str):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE assets SET current_status = 'Archived' WHERE vehicle_number = %s RETURNING vehicle_number;",
            (vehicle_number.upper().strip(),)
        )
        archived_vehicle = cursor.fetchone()
        conn.commit()
    except Exception as exc:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail="Unable to archive vehicle.")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

    if not archived_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"status": "Archived", "vehicle_number": archived_vehicle[0]}

# --- TRIP ENDPOINTS ---
@app.post("/trips")
def create_trip(trip: TripCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    vehicle_number = trip.vehicle_number.upper().strip()
    now = datetime.now()

    cursor.execute("""
        SELECT COUNT(*)
        FROM trips
        WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP)
          AND created_at < date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month';
    """)
    sequence = cursor.fetchone()[0] + 1
    tracking_id = f"{vehicle_number[-4:]}_{now.strftime('%d%m%y')}_{sequence}"
    cursor.execute("""
        INSERT INTO trips (vehicle_number, tracking_number, source_city, destination_city, 
                           party_name, gta_name, lr_no, eway_bill, eway_bill_expiry, trip_start_date, lw) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
    """, (vehicle_number, tracking_id, trip.source_city, trip.destination_city,
          trip.party_name, trip.gta_name, trip.lr_no, trip.eway_bill, 
          trip.eway_bill_expiry, trip.trip_start_date, trip.lw))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success", "tracking_id": tracking_id}

@app.get("/trips/active")
def get_active_trips():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT t.*, a.driver_name FROM trips t LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE t.actual_delivery_date IS NULL;")
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.get("/trips/all")
def get_all_trips():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips ORDER BY trip_id DESC;")
    res = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.get("/trips/history")
def get_trip_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM trips
        WHERE actual_delivery_date IS NOT NULL
        ORDER BY actual_delivery_date DESC, trip_id DESC;
    """)
    res = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.get("/trips/truck/{vehicle_no}")
def get_trips_by_truck(vehicle_no: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM trips
        WHERE vehicle_number = %s
        ORDER BY trip_start_date DESC, trip_id DESC;
    """, (vehicle_no.upper().strip(),))
    res = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.put("/trips/{trip_id}/complete")
def complete_trip(trip_id: int, data: TripCompleteUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE trips SET actual_delivery_date = %s WHERE trip_id = %s RETURNING vehicle_number;", (data.actual_delivery_date, trip_id))
    v_num = cursor.fetchone()[0]
    cursor.execute("UPDATE assets SET current_status = 'Available' WHERE vehicle_number = %s;", (v_num,))
    cursor.execute("INSERT INTO trip_finances (trip_id, pod_image_url) VALUES (%s, %s) ON CONFLICT (trip_id) DO UPDATE SET pod_image_url = EXCLUDED.pod_image_url;", (trip_id, data.pod_image_path))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.get("/track/{trip_id}")
def get_track_data(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE tracking_number = %s;", (trip_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")
    cols = [d[0] for d in cursor.description]
    res = dict(zip(cols, row))
    cursor.close(); conn.close()
    return res

@app.post("/finances/calculate")
def calculate_finance(data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    trip_id = data.get('trip_id')
    freight = float(data.get('freight_amount', 0))
    adv = float(data.get('adv_amt', 0))
    expenses = float(data.get('expenses', 0))
    tds = float(data.get('tds', 0))
    balance = float(data.get('balance_payment', (freight - adv - expenses - tds)))
    bill_no = data.get('bill_no', 'N/A')

    cursor.execute("""
        INSERT INTO trip_finances (trip_id, freight_amount, adv_amt, expenses, tds, balance_payment, bill_no) 
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (trip_id) DO UPDATE SET 
        freight_amount = EXCLUDED.freight_amount, adv_amt = EXCLUDED.adv_amt, 
        expenses = EXCLUDED.expenses, tds = EXCLUDED.tds, balance_payment = EXCLUDED.balance_payment, bill_no = EXCLUDED.bill_no;
    """, (trip_id, freight, adv, expenses, tds, balance, bill_no))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/finances/{trip_id}/pod")
def update_pod(trip_id: int, data: PODUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE trip_finances SET pod_status = %s, pod_arrived_office_date = %s, pod_forwarded_client_date = %s WHERE trip_id = %s;", 
                   (data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, trip_id))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.post("/upload-pod")
async def upload_pod(file: UploadFile = File(...)):
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"path": file_path}

# --- PARTIES & DRIVERS ---
@app.get("/drivers")
def get_all_drivers():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drivers;")
    res = [dict(zip([c[0] for c in cursor.description], row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.post("/drivers")
def add_driver(driver: DriverCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO drivers (name, dl_number, aadhaar_number, mobile_number, dl_expiry_date)
        VALUES (%s, %s, %s, %s, %s);
    """, (driver.name, driver.dl_number, driver.aadhaar_number,
          driver.mobile_number, driver.dl_expiry_date))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/drivers/{driver_id}")
def update_driver(driver_id: int, driver: DriverUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE drivers
        SET name = %s, dl_number = %s, aadhaar_number = %s,
            mobile_number = %s, dl_expiry_date = %s
        WHERE driver_id = %s
        RETURNING driver_id;
    """, (driver.name, driver.dl_number, driver.aadhaar_number,
          driver.mobile_number, driver.dl_expiry_date, driver_id))
    updated_driver = cursor.fetchone()
    conn.commit()
    cursor.close(); conn.close()
    if not updated_driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"status": "Updated", "driver_id": updated_driver[0]}

@app.delete("/drivers/{driver_id}")
def delete_driver(driver_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM drivers WHERE driver_id = %s;", (driver_id,))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Deleted"}

@app.get("/trips/by-party/{party_name}")
def get_trips_by_party(party_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trips WHERE party_name = %s ORDER BY trip_start_date DESC;", (party_name,))
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

@app.get("/trips/by-driver/{driver_name}")
def get_trips_by_driver(driver_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT t.* FROM trips t JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE a.driver_name = %s ORDER BY t.trip_start_date DESC;", (driver_name,))
    cols = [d[0] for d in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

@app.get("/parties")
def get_party_list():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM parties UNION SELECT DISTINCT party_name FROM trips WHERE party_name IS NOT NULL;")
    res = [row[0] for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.post("/parties")
def add_new_party(name: str = Form(...)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO parties (name) VALUES (%s) ON CONFLICT DO NOTHING;", (name,))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.delete("/parties/{party_name}")
def delete_party_data(party_name: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM trips WHERE party_name = %s;", (party_name,))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Deleted"}

@app.get("/trips/details/{trip_id}")
def get_trip_details(trip_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.freight_amount, f.adv_amt, f.expenses, f.tds, f.balance_payment, f.bill_no, f.pod_status
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.trip_id = %s;
    """, (trip_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")
    cols = [d[0] for d in cursor.description]
    res = dict(zip(cols, row))
    cursor.close(); conn.close()
    return res

@app.get("/drivers/expiring-licenses")
def get_expiring_licenses():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM drivers;")
    cols = [d[0] for d in cursor.description]
    drivers = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    
    today = date.today()
    threshold = today + timedelta(days=30)
    
    expiring_soon = []
    for driver in drivers:
        expiry_date = driver.get("dl_expiry_date")
        if expiry_date:
            if isinstance(expiry_date, str):
                expiry_date = date.fromisoformat(expiry_date[:10])
                
            if expiry_date <= threshold:
                status = "Expired" if expiry_date < today else "Expiring Soon"
                expiring_soon.append({
                    "name": driver["name"],
                    "dl_number": driver["dl_number"],
                    "mobile_number": driver.get("mobile_number"),
                    "dl_expiry_date": str(expiry_date),
                    "status": status
                })
                
    return expiring_soon