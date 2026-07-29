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
from dotenv import load_dotenv
from typing import Optional

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
    aadhaar_number: str
    mobile_number: Optional[str] = None
    dl_expiry_date: Optional[date] = None

class DriverUpdate(DriverCreate):
    pass

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


def get_taabi_live_data(vehicle_number):
    url = "https://dev-api-dtwin.taabi.ai/graphql"
    query = """
    query getAllDeviceLocations($configs: Configs) {
        devices: getAllDeviceLocations(configs: $configs) {
            vehicleNumber, speed, haltStatus, latitude, longitude, fuelValueLtrs, adblue_level
        }
    }
    """
    payload = {"query": query, "variables": {"configs": {}}}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {TAABI_API_KEY}"}
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=15)
        data = response.json()
        devices = data.get("data", {}).get("devices", [])
        db_clean = str(vehicle_number).replace("-", "").replace(" ", "").upper()
        
        for dev in devices:
            api_clean = str(dev['vehicleNumber']).replace("-", "").replace(" ", "").upper()
            if db_clean in api_clean or api_clean in db_clean:
                return {
                    "speed": dev['speed'], 
                    "lat": dev['latitude'], 
                    "lng": dev['longitude'],
                    "fuel_level": dev.get('fuelValueLtrs', 'N/A'), 
                    "urea_level": dev.get('adblue_level', 'N/A'),
                    "status": "Halted" if dev['haltStatus'] else "Moving"
                }
                
        return {"speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Not Found"}
        
    except Exception as e:
        print(f"Taabi API Error: {e}")
        return {"speed": 0, "fuel_level": "N/A", "urea_level": "N/A", "status": "Offline"}

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
    per_km_rate: float = Form(...),
    compensation_type: str = Form('KM Based'),
    mileage: float = Form(0.0),
    fixed_salary: float = Form(0.0)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO assets (vehicle_number, driver_name, per_km_rate, current_status, compensation_type, mileage, fixed_salary)
        VALUES (%s, %s, %s, 'Available', %s, %s, %s);
    """, (vehicle_number.upper().strip(), driver_name, per_km_rate, compensation_type, mileage, fixed_salary))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/assets/{vehicle_no}")
def update_asset(vehicle_no: str, asset: AssetUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE assets
        SET driver_name = %s, per_km_rate = %s, current_status = %s, compensation_type = %s, mileage = %s, fixed_salary = %s
        WHERE vehicle_number = %s
        RETURNING vehicle_number;
    """, (asset.driver_name, asset.per_km_rate, asset.current_status, asset.compensation_type, asset.mileage, asset.fixed_salary,
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
        if conn: conn.rollback()
        raise HTTPException(status_code=500, detail="Unable to archive vehicle.")
    finally:
        if cursor: cursor.close()
        if conn: conn.close()
    if not archived_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"status": "Archived", "vehicle_number": archived_vehicle[0]}

@app.post("/trips")
def create_trip(trip: TripCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO trips (vehicle_number, source_city, destination_city, party_name, owner_name, gta_name, lr_no, eway_bill, eway_bill_expiry, trip_start_date, lw)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING trip_id;
        """, (trip.vehicle_number.upper().strip(), trip.source_city, trip.destination_city, trip.party_name, trip.owner_name, trip.gta_name, trip.lr_no, trip.eway_bill, trip.eway_bill_expiry, trip.trip_start_date, trip.lw))
        
        trip_id = cursor.fetchone()[0]
        start_date_obj = trip.trip_start_date if trip.trip_start_date else datetime.now().date()
        date_str = start_date_obj.strftime('%d%m%y')
        party_clean = trip.party_name.replace(' ', '').upper() if trip.party_name else "NOPARTY"
        vehicle_clean = trip.vehicle_number.upper().strip()
        tracking_number = f"{vehicle_clean}-{party_clean}-{date_str}-{trip_id}"
        
        cursor.execute("UPDATE trips SET tracking_number = %s WHERE trip_id = %s", (tracking_number, trip_id))
        
        freight = trip.freight_amount or 0.0
        initial_balance = freight
        total_km = trip.total_km or 0.0
        driver_advance = total_km * 3.5
        driver_remaining = total_km * 1.0
        driver_total = total_km * 4.5
        
        cursor.execute("""
            INSERT INTO trip_finances (
                trip_id, freight_amount, gst, balance_payment,
                total_km, driver_advance, driver_remaining, driver_total, gst_enabled
            ) VALUES (%s, %s, 0.0, %s, %s, %s, %s, %s, FALSE)
        """, (trip_id, freight, initial_balance, total_km, driver_advance, driver_remaining, driver_total))
        
        cursor.execute("UPDATE assets SET current_status = 'In-Transit' WHERE vehicle_number = %s;", (trip.vehicle_number.upper().strip(),))
        conn.commit()
        return {"message": "Trip launched", "tracking_number": tracking_number}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.put("/trips/{trip_id}")
def update_trip(trip_id: int, trip_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE trips 
            SET vehicle_number = %s, source_city = %s, destination_city = %s, 
                party_name = %s, owner_name = %s, gta_name = %s, lr_no = %s, eway_bill = %s, 
                eway_bill_expiry = %s, trip_start_date = %s, lw = %s
            WHERE trip_id = %s
        """, (
            trip_data.get('vehicle_number'), trip_data.get('source_city'), trip_data.get('destination_city'),
            trip_data.get('party_name'), trip_data.get('owner_name'), trip_data.get('gta_name'), trip_data.get('lr_no'), 
            trip_data.get('eway_bill'), trip_data.get('eway_bill_expiry'), 
            trip_data.get('trip_start_date'), trip_data.get('lw'), trip_id
        ))
        conn.commit()
        return {"message": "Trip updated successfully"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

@app.get("/trips/active")
def get_active_trips():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, a.driver_name, f.freight_amount, f.adv_amt, f.balance_payment, f.total_km, f.trip_unloaded, f.amount_cleared, f.pod_status 
        FROM trips t 
        LEFT JOIN assets a ON t.vehicle_number = a.vehicle_number 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE t.actual_delivery_date IS NULL
        ORDER BY t.trip_start_date DESC;
    """)
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

@app.delete("/trips/{trip_id}")
def force_delete_trip(trip_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM trip_finances WHERE trip_id = %s;", (trip_id,))
        cursor.execute("DELETE FROM trips WHERE trip_id = %s RETURNING vehicle_number;", (trip_id,))
        res = cursor.fetchone()
        if res:
            cursor.execute("UPDATE assets SET current_status = 'Available' WHERE vehicle_number = %s;", (res[0],))
        conn.commit()
        return {"status": "Deleted"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()

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
        SELECT t.*, f.trip_unloaded, f.amount_cleared, f.cleared_amount, f.cleared_date, 
               f.pod_status, f.pod_arrived_office_date, f.pod_forwarded_client_date, 
               f.pod_received_client_date, f.balance_payment, f.freight_amount, f.adv_amt
        FROM trips t
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id
        WHERE t.actual_delivery_date IS NOT NULL
        ORDER BY t.actual_delivery_date DESC, t.trip_id DESC;
    """)
    cols = [d[0] for d in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
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
    try:
        cursor.execute("UPDATE trips SET actual_delivery_date = %s WHERE trip_id = %s RETURNING vehicle_number;", (data.actual_delivery_date, trip_id))
        v_row = cursor.fetchone()
        if v_row:
            cursor.execute("UPDATE assets SET current_status = 'Available' WHERE vehicle_number = %s;", (v_row[0],))
        
        # Pull ledger to append new payment
        cursor.execute("SELECT advance_details, freight_amount, loading_charge, holding_charge, gst, tds, extra_deduction FROM trip_finances WHERE trip_id = %s", (trip_id,))
        row = cursor.fetchone()
        
        if row:
            adv_details = row[0] if row[0] else []
            if isinstance(adv_details, str):
                try: adv_details = json.loads(adv_details)
                except: adv_details = []
                
            freight = float(row[1] or 0)
            loading = float(row[2] or 0)
            holding = float(row[3] or 0)
            gst = float(row[4] or 0)
            tds = float(row[5] or 0)
            extra = float(row[6] or 0)

            # Append the payment logged in the modal to the ledger arrays
            if data.cleared_amount and data.cleared_amount > 0:
                payment_date_str = data.cleared_date.isoformat() if data.cleared_date else date.today().isoformat()
                adv_details.append({"date": payment_date_str, "amount": data.cleared_amount})
            
            total_adv = sum(float(adv.get('amount', 0) or 0) for adv in adv_details)
            balance = (freight + loading + holding + gst) - (total_adv + tds + extra)
            is_cleared = balance <= 0

            cursor.execute("""
                UPDATE trip_finances 
                SET pod_image_url = COALESCE(%s, pod_image_url),
                    trip_unloaded = %s, pod_status = %s,
                    pod_arrived_office_date = %s, pod_forwarded_client_date = %s, pod_received_client_date = %s,
                    advance_details = %s, adv_amt = %s, balance_payment = %s, amount_cleared = %s
                WHERE trip_id = %s;
            """, (
                data.pod_image_path, data.trip_unloaded, data.pod_status,
                data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date,
                json.dumps(adv_details), total_adv, balance, is_cleared, trip_id
            ))
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.put("/finances/{trip_id}/checklist")
def update_checklist(trip_id: int, data: ChecklistUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Pull ledger to append new payment
        cursor.execute("SELECT advance_details, freight_amount, loading_charge, holding_charge, gst, tds, extra_deduction FROM trip_finances WHERE trip_id = %s", (trip_id,))
        row = cursor.fetchone()
        
        if row:
            adv_details = row[0] if row[0] else []
            if isinstance(adv_details, str):
                try: adv_details = json.loads(adv_details)
                except: adv_details = []
                
            freight = float(row[1] or 0)
            loading = float(row[2] or 0)
            holding = float(row[3] or 0)
            gst = float(row[4] or 0)
            tds = float(row[5] or 0)
            extra = float(row[6] or 0)

            # Append the payment logged in the modal to the ledger arrays
            if data.cleared_amount and data.cleared_amount > 0:
                payment_date_str = data.cleared_date.isoformat() if data.cleared_date else date.today().isoformat()
                adv_details.append({"date": payment_date_str, "amount": data.cleared_amount})
            
            total_adv = sum(float(adv.get('amount', 0) or 0) for adv in adv_details)
            balance = (freight + loading + holding + gst) - (total_adv + tds + extra)
            is_cleared = balance <= 0

            cursor.execute("""
                UPDATE trip_finances 
                SET trip_unloaded = %s, pod_status = %s,
                    pod_arrived_office_date = %s, pod_forwarded_client_date = %s, pod_received_client_date = %s,
                    advance_details = %s, adv_amt = %s, balance_payment = %s, amount_cleared = %s
                WHERE trip_id = %s;
            """, (
                data.trip_unloaded, data.pod_status,
                data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date,
                json.dumps(adv_details), total_adv, balance, is_cleared,
                trip_id
            ))
        conn.commit()
        return {"status": "Success"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/track/{trip_id:path}")
def get_track_data(trip_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.*, f.freight_amount, f.adv_amt, f.tds, f.balance_payment, f.loading_charge, f.gst, f.holding_charge, f.extra_deduction, f.total_km, f.driver_advance, f.driver_remaining, f.driver_total, f.advance_details, f.bill_no, f.pod_status, f.pod_arrived_office_date, f.pod_forwarded_client_date, f.pod_received_client_date, f.trip_unloaded, f.amount_cleared, f.cleared_amount, f.cleared_date, f.bank_account, f.gst_enabled, f.include_loading_in_gst, f.include_holding_in_gst
        FROM trips t 
        LEFT JOIN trip_finances f ON t.trip_id = f.trip_id 
        WHERE t.tracking_number = %s;
    """, (trip_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Trip not found")
    cols = [d[0] for d in cursor.description]
    res = dict(zip(cols, row))
    cursor.close(); conn.close()
    res['telemetry'] = get_taabi_live_data(res['vehicle_number'])
    return res

@app.post("/finances/calculate")
def calculate_finance(data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    trip_id = data.get('trip_id')
    
    freight = float(data.get('freight_amount', 0) or 0)
    tds = float(data.get('tds', 0) or 0)
    loading = float(data.get('loading_charge', 0) or 0)
    holding = float(data.get('holding_charge', 0) or 0)
    extra_deduction = float(data.get('extra_deduction', 0) or 0)
    
    gst_enabled = bool(data.get('gst_enabled', False))
    include_loading_in_gst = bool(data.get('include_loading_in_gst', False))
    include_holding_in_gst = bool(data.get('include_holding_in_gst', False))
    
    # INDEPENDENT GST MATH
    taxable_base = freight + (loading if include_loading_in_gst else 0) + (holding if include_holding_in_gst else 0)
    gst = round(taxable_base * 0.18, 2) if gst_enabled else 0.0
    
    advances = data.get('advance_details', [])
    advance_details_json = json.dumps(advances)
    total_adv = sum(float(adv.get('amount', 0) or 0) for adv in advances)
    
    bill_no = data.get('bill_no', '')
    bank_account = data.get('bank_account', '')
    balance = (freight + loading + holding + gst) - (total_adv + tds + extra_deduction)

    total_km = float(data.get('total_km', 0) or 0)
    driver_advance = float(data.get('driver_advance', 0) or 0)
    driver_remaining = float(data.get('driver_remaining', 0) or 0)
    driver_total = float(data.get('driver_total', 0) or 0)
    finance_remarks = data.get('finance_remarks', '')

    cursor.execute("""
        SELECT a.mileage FROM trips t 
        JOIN assets a ON t.vehicle_number = a.vehicle_number 
        WHERE t.trip_id = %s;
    """, (trip_id,))
    m_row = cursor.fetchone()
    mileage = float(m_row[0]) if m_row and m_row[0] else 5.5
    diesel_liters_needed = round(total_km / mileage, 2) if mileage > 0 else 0.0
    diesel_cost = round(diesel_liters_needed * 90.0, 2)

    cursor.execute("""
        INSERT INTO trip_finances (
            trip_id, freight_amount, adv_amt, tds, balance_payment, finance_remarks,
            loading_charge, gst, holding_charge, extra_deduction,
            total_km, driver_advance, driver_remaining, driver_total,
            advance_details, bill_no, diesel_liters_needed, diesel_cost,
            bank_account, gst_enabled, include_loading_in_gst, include_holding_in_gst
        ) 
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (trip_id) DO UPDATE SET 
        freight_amount = EXCLUDED.freight_amount, adv_amt = EXCLUDED.adv_amt, 
        tds = EXCLUDED.tds, balance_payment = EXCLUDED.balance_payment, finance_remarks = EXCLUDED.finance_remarks,
        loading_charge = EXCLUDED.loading_charge, gst = EXCLUDED.gst,
        holding_charge = EXCLUDED.holding_charge, extra_deduction = EXCLUDED.extra_deduction,
        total_km = EXCLUDED.total_km, driver_advance = EXCLUDED.driver_advance, 
        driver_remaining = EXCLUDED.driver_remaining, driver_total = EXCLUDED.driver_total,
        advance_details = EXCLUDED.advance_details, bill_no = EXCLUDED.bill_no,
        diesel_liters_needed = EXCLUDED.diesel_liters_needed, diesel_cost = EXCLUDED.diesel_cost,
        bank_account = EXCLUDED.bank_account, gst_enabled = EXCLUDED.gst_enabled, 
        include_loading_in_gst = EXCLUDED.include_loading_in_gst, include_holding_in_gst = EXCLUDED.include_holding_in_gst;
    """, (trip_id, freight, total_adv, tds, balance, finance_remarks, loading, gst, holding, extra_deduction, total_km, driver_advance, driver_remaining, driver_total, advance_details_json, bill_no, diesel_liters_needed, diesel_cost, bank_account, gst_enabled, include_loading_in_gst, include_holding_in_gst))
    
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.put("/finances/{trip_id}/pod")
def update_pod(trip_id: int, data: PODUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE trip_finances SET pod_status = %s, pod_arrived_office_date = %s, pod_forwarded_client_date = %s, pod_received_client_date = %s WHERE trip_id = %s;
    """, (data.pod_status, data.pod_arrived_office_date, data.pod_forwarded_client_date, data.pod_received_client_date, trip_id))
    conn.commit()
    cursor.close(); conn.close()
    return {"status": "Success"}

@app.post("/upload-pod")
async def upload_pod(file: UploadFile = File(...)):
    file_path = f"uploads/{file.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"path": file_path}

@app.get("/owners")
def get_owner_list():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT owner_name FROM trips WHERE owner_name IS NOT NULL AND owner_name != '';")
    res = [row[0] for row in cursor.fetchall()]
    cursor.close(); conn.close()
    return res

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
    try:
        cursor.execute("""
            INSERT INTO drivers (name, dl_number, aadhaar_number, mobile_number, dl_expiry_date)
            VALUES (%s, %s, %s, %s, %s);
        """, (driver.name, driver.dl_number, driver.aadhaar_number,
              driver.mobile_number, driver.dl_expiry_date))
        conn.commit()
        return {"status": "Success"}
    except errors.UniqueViolation:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Error: Already registered.")
    finally:
        cursor.close(); conn.close()

@app.put("/drivers/{driver_id}")
def update_driver(driver_id: int, driver: DriverUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE drivers
            SET name = %s, dl_number = %s, aadhaar_number = %s,
                mobile_number = %s, dl_expiry_date = %s
            WHERE driver_id = %s
            RETURNING driver_id;
        """, (driver.name, driver.dl_number, driver.aadhaar_number,
              driver.mobile_number, driver.dl_expiry_date, driver_id))
        conn.commit()
        return {"status": "Updated"}
    finally:
        cursor.close(); conn.close()

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
    cursor.close(); conn.close()
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
        SELECT t.*, f.freight_amount, f.adv_amt, f.tds, f.balance_payment, f.bill_no, f.pod_status, f.loading_charge, f.gst, f.holding_charge, f.extra_deduction, f.total_km, f.driver_advance, f.driver_remaining, f.driver_total, f.advance_details, f.pod_arrived_office_date, f.pod_forwarded_client_date, f.pod_received_client_date, f.trip_unloaded, f.amount_cleared, f.cleared_amount, f.cleared_date, f.bank_account, f.gst_enabled, f.include_loading_in_gst, f.include_holding_in_gst
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
                    "name": driver["name"], "dl_number": driver["dl_number"],
                    "mobile_number": driver.get("mobile_number"), "dl_expiry_date": str(expiry_date), "status": status
                })
    return expiring_soon

@app.put("/trips/{trip_id}/locked-edit")
def locked_edit_trip(trip_id: int, trip_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # 1. Check if the trip is already locked
        cursor.execute("SELECT is_locked FROM trips WHERE trip_id = %s", (trip_id,))
        row = cursor.fetchone()
        if row and row[0]:
            raise HTTPException(status_code=400, detail="This trip has already been edited once and is now permanently locked.")

        # 2. Update all launch details and lock the trip
        cursor.execute("""
            UPDATE trips 
            SET vehicle_number = %s, source_city = %s, destination_city = %s, 
                party_name = %s, owner_name = %s, gta_name = %s, lr_no = %s, eway_bill = %s, 
                eway_bill_expiry = %s, trip_start_date = %s, lw = %s, is_locked = TRUE
            WHERE trip_id = %s
        """, (
            trip_data.get('vehicle_number'), trip_data.get('source_city'), trip_data.get('destination_city'),
            trip_data.get('party_name'), trip_data.get('owner_name'), trip_data.get('gta_name'), trip_data.get('lr_no'), 
            trip_data.get('eway_bill'), trip_data.get('eway_bill_expiry'), 
            trip_data.get('trip_start_date'), trip_data.get('lw'), trip_id
        ))
        
        # 3. Recalculate Finances (Freight, KM, Driver Pay, GST, Net Balance)
        new_km = float(trip_data.get('total_km', 0) or 0)
        new_freight = float(trip_data.get('freight_amount', 0) or 0)
        
        driver_adv = new_km * 3.5
        driver_rem = new_km * 1.0
        driver_tot = new_km * 4.5
        
        cursor.execute("SELECT advance_details, loading_charge, holding_charge, gst, tds, extra_deduction, include_loading_in_gst, include_holding_in_gst, gst_enabled FROM trip_finances WHERE trip_id = %s", (trip_id,))
        f_row = cursor.fetchone()
        
        if f_row:
            adv_details = f_row[0] if f_row[0] else []
            if isinstance(adv_details, str):
                try: adv_details = json.loads(adv_details)
                except: adv_details = []
            total_adv = sum(float(adv.get('amount', 0) or 0) for adv in adv_details)
            loading = float(f_row[1] or 0)
            holding = float(f_row[2] or 0)
            tds = float(f_row[4] or 0)
            extra = float(f_row[5] or 0)
            inc_load = bool(f_row[6])
            inc_hold = bool(f_row[7])
            gst_en = bool(f_row[8])
            
            # Recalculate GST & Balance
            taxable_base = new_freight + (loading if inc_load else 0) + (holding if inc_hold else 0)
            new_gst = round(taxable_base * 0.18, 2) if gst_en else 0.0
            balance = (new_freight + loading + holding + new_gst) - (total_adv + tds + extra)
            
            # Recalculate Diesel
            cursor.execute("SELECT a.mileage FROM trips t JOIN assets a ON t.vehicle_number = a.vehicle_number WHERE t.trip_id = %s", (trip_id,))
            m_row = cursor.fetchone()
            mileage = float(m_row[0]) if m_row and m_row[0] else 5.5
            diesel_liters_needed = round(new_km / mileage, 2) if mileage > 0 else 0.0
            diesel_cost = round(diesel_liters_needed * 90.0, 2)
            
            cursor.execute("""
                UPDATE trip_finances 
                SET freight_amount = %s, total_km = %s, gst = %s, balance_payment = %s, amount_cleared = %s,
                    driver_advance = %s, driver_remaining = %s, driver_total = %s,
                    diesel_liters_needed = %s, diesel_cost = %s
                WHERE trip_id = %s
            """, (new_freight, new_km, new_gst, balance, balance <= 0, driver_adv, driver_rem, driver_tot, diesel_liters_needed, diesel_cost, trip_id))

        conn.commit()
        return {"status": "Success"}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        cursor.close(); conn.close()