import io
import re
import json
import hashlib
import pandas as pd
from datetime import datetime

EMPLOYEE_MAP = {
    'rohit': 'Rohit Jain',
    'vinod': 'Vinod Kumar',
    'subhash': 'Subhash Verma',
    'vishnu': 'Vishnu Singh',
    'deepak': 'Deepak'
}

def clean_vehicle(v):
    if not v or pd.isna(v):
        return None
    if isinstance(v, float):
        v = str(int(v))
    cleaned = re.sub(r'[^A-Za-z0-9]', '', str(v)).upper()
    return cleaned if len(cleaned) >= 4 else None

def parse_date_str(d_val):
    if pd.isna(d_val) or not d_val:
        return datetime.now().strftime("%Y-%m-%d")
    d_str = str(d_val).strip()
    for fmt in (
        "%d %b %Y %H:%M", "%d %b %Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f",
        "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d",
        "%d %b %Y", "%d-%b-%Y"
    ):
        try:
            return datetime.strptime(d_str.split(".")[0], fmt).strftime("%Y-%m-%d")
        except Exception:
            continue
    try:
        dt = pd.to_datetime(d_val)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")

def parse_datetime_full(d_val):
    if pd.isna(d_val) or not d_val:
        return "-"
    d_str = str(d_val).strip()
    for fmt in (
        "%d %b %Y %H:%M", "%d %b %Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f",
        "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d"
    ):
        try:
            dt = datetime.strptime(d_str.split(".")[0], fmt)
            return dt.strftime("%d-%m-%Y %H:%M")
        except Exception:
            continue
    try:
        dt = pd.to_datetime(d_val)
        return dt.strftime("%d-%m-%Y %H:%M")
    except Exception:
        return d_str

def make_fingerprint(*args):
    raw = "_".join(str(a or '').strip().upper() for a in args)
    return hashlib.md5(raw.encode('utf-8')).hexdigest()

def detect_employee(maker_name, description, remarks):
    combined = f"{maker_name or ''} {description or ''} {remarks or ''}".lower()
    for key, full_name in EMPLOYEE_MAP.items():
        if key in combined:
            return full_name
    return str(maker_name or description or 'Office Staff').strip()

def extract_truck_and_reason(raw_text):
    if not raw_text or pd.isna(raw_text):
        return None, "General Expense", "Miscellaneous"

    text = str(raw_text).strip()

    match_full = re.search(r'\b(RJ\s*14\s*[A-Z]{1,2}\s*\d{4})\b', text, re.IGNORECASE)
    if match_full:
        truck = re.sub(r'\s+', '', match_full.group(1)).upper()
        rem_text = text.replace(match_full.group(0), '').strip(" -:|/")
    else:
        match_4 = re.search(r'\b(\d{4})\b', text)
        if match_4:
            truck = match_4.group(1)
            rem_text = text.replace(truck, '').strip(" -:|/")
        else:
            truck = None
            rem_text = text

    clean_reason = rem_text or "Trip Expense"
    lower_r = clean_reason.lower()

    if 'adv' in lower_r or 'advance' in lower_r:
        category = 'Advance'
    elif 'salary' in lower_r or 'वेतन' in lower_r:
        category = 'Driver Salary'
    elif any(k in lower_r for k in ['repair', 'maint', 'tyre', 'tire', 'kamani', 'grease', 'bill', 'glass', 'tirpal', 'त्रिपाल']):
        category = 'Repair'
    elif 'uria' in lower_r or 'urea' in lower_r:
        category = 'Urea'
    elif any(k in lower_r for k in ['food', 'bhatta', 'kharcha']):
        category = 'Fooding'
    elif 'toll' in lower_r or 'fastag' in lower_r:
        category = 'Toll Cash'
    elif any(k in lower_r for k in ['tea', 'kachori', 'welfare']):
        category = 'Staff Welfare'
    elif 'unload' in lower_r or 'loading' in lower_r:
        category = 'Loading/Unloading'
    elif any(k in lower_r for k in ['diesel', 'fuel', 'hsd']):
        category = 'Diesel'
    else:
        category = 'Miscellaneous'

    return truck, clean_reason, category

def parse_vendor_file(file_bytes: bytes, filename: str):
    records = []
    fname = filename.lower()

    # 1. FASTAG TOLL SUMMARY
    if "financial_toll_summary" in fname or (fname.endswith('.csv') and "toll" in fname) or "onlinestatement" in fname:
        if "onlinestatement" in fname or fname.endswith('.xls'):
            try:
                dfs = pd.read_html(io.BytesIO(file_bytes))
                df = dfs[0]
                df.columns = df.iloc[0]
                df = df[1:]
                for _, row in df.iterrows():
                    veh = clean_vehicle(row.get('Licence Plate No'))
                    raw_amt = row.get('Amount(DR)')
                    amt = pd.to_numeric(raw_amt, errors='coerce') if pd.notna(raw_amt) else 0.0
                    bal = pd.to_numeric(row.get('Balance'), errors='coerce')
                    raw_time = row.get('Transaction Date Time') or row.get('Accounting Date Time')
                    t_id = str(row.get('Transaction ID') or row.get('Transaction Id') or '').strip()

                    if veh:
                        fp = t_id if t_id else make_fingerprint(veh, raw_time, row.get('Transaction Description'), amt)
                        records.append({
                            "vehicle": veh, 
                            "date": parse_date_str(raw_time),
                            "txn_time": parse_datetime_full(raw_time),
                            "acct_time": parse_datetime_full(row.get('Accounting Date Time') or raw_time),
                            "type": "FASTAG", 
                            "amount": float(amt) if pd.notna(amt) else 0.0,
                            "liters": 0.0,
                            "balance": float(bal) if pd.notna(bal) else None,
                            "place": str(row.get('Transaction Description', 'FASTag Plaza')).replace('Plaza Name:', '').strip(),
                            "remarks": "FASTag Toll", 
                            "fingerprint": fp,
                            "source_file": filename
                        })
                return records
            except Exception:
                pass

        content = file_bytes.decode('utf-8', errors='ignore')
        lines = content.splitlines()
        header_idx = 0
        for idx, line in enumerate(lines[:15]):
            if "vehicle" in line.lower() and "toll plaza" in line.lower():
                header_idx = idx
                break
        df = pd.read_csv(io.StringIO("\n".join(lines[header_idx:])))
        for _, row in df.iterrows():
            veh = clean_vehicle(row.get('Vehicle'))
            raw_amt = row.get('Amount(DR)')
            amt = pd.to_numeric(raw_amt, errors='coerce') if pd.notna(raw_amt) else 0.0
            bal = pd.to_numeric(row.get('Balance'), errors='coerce')
            txn_t = row.get('Transaction Time')
            acct_t = row.get('Accounting Time')
            plaza = str(row.get('Toll Plaza', 'Toll Plaza')).strip()
            t_id = str(row.get('Transaction Id') or row.get('Transaction ID') or '').strip()

            if veh and plaza.lower() != 'opening balance':
                fp = t_id if t_id else make_fingerprint(veh, txn_t or acct_t, plaza, amt)
                records.append({
                    "vehicle": veh, 
                    "date": parse_date_str(txn_t or acct_t),
                    "txn_time": parse_datetime_full(txn_t),
                    "acct_time": parse_datetime_full(acct_t),
                    "type": "FASTAG", 
                    "amount": float(amt) if pd.notna(amt) else 0.0,
                    "liters": 0.0,
                    "balance": float(bal) if pd.notna(bal) else None,
                    "place": plaza, 
                    "remarks": "FASTag Toll", 
                    "fingerprint": fp,
                    "source_file": filename
                })

    # 2. DIESEL PORTAL (BPCL / HPCL)
    elif any(k in fname for k in ["sales transaction", "sale trans", "customertransaction", "hpcl", "bpcl"]):
        skip = 14 if "customertransaction" in fname else 11
        df_raw = pd.read_excel(io.BytesIO(file_bytes), skiprows=skip)
        df = df_raw.copy()
        if "customertransaction" in fname:
            df.columns = df_raw.iloc[0]
            df = df[1:]

        for _, row in df.iterrows():
            raw_veh = row.get('veh.no.') or row.get('veh. No.') or row.get('Vehicle Number') or row.get('Vehicle No./Card Identifier') or row.get('Custom Card Name')
            veh = clean_vehicle(raw_veh)
            amt = pd.to_numeric(row.get('Total Transaction Amount (Rs.)') or row.get('Fuel Amount(Rs.)') or row.get('Amount'), errors='coerce')
            vol = pd.to_numeric(row.get('Product Volume /  Quantity (Litres)') or row.get('Volume(Ltr.)'), errors='coerce') or 0.0
            d_val = row.get('Transaction Date') or row.get('Txn Date')
            t_id = str(row.get('Txn Id') or row.get('Transaction ID') or row.get('Invoice No') or '').strip()

            if veh and pd.notna(amt) and amt >= 0:
                station = str(row.get('Fuel Station Name (Retail Outlet Name)') or row.get('Retail Outlet Name') or 'Fuel Pump').strip()
                fp = t_id if t_id else make_fingerprint(veh, d_val, station, round(float(vol), 2), round(float(amt), 2))
                records.append({
                    "vehicle": veh, 
                    "date": parse_date_str(d_val),
                    "txn_time": parse_datetime_full(d_val),
                    "acct_time": parse_datetime_full(d_val),
                    "type": "DIESEL", 
                    "amount": float(amt), 
                    "liters": float(vol),
                    "place": station, 
                    "remarks": f"Fuel ({vol} Ltrs)", 
                    "fingerprint": fp,
                    "source_file": filename
                })

    # 3. OMNI CARD STATEMENTS
    elif "omni" in fname:
        df = pd.read_excel(io.BytesIO(file_bytes))
        for _, row in df.iterrows():
            notes = str(row.get('TrxnNotes') or '')
            truck_code, reason, category = extract_truck_and_reason(notes)
            amt = pd.to_numeric(row.get('Amount'), errors='coerce')
            txn_type = str(row.get('TransactionType') or '').upper()

            if pd.notna(amt) and amt >= 0 and txn_type == 'DEBIT':
                employee = detect_employee(row.get('MakerName'), '', '')
                recipient = str(row.get('RecipientName') or '').strip()
                d_val = row.get('TransactionDate')
                fp = make_fingerprint(employee, d_val, amt, recipient, notes)

                records.append({
                    "vehicle": clean_vehicle(truck_code),
                    "date": parse_date_str(d_val),
                    "txn_time": parse_datetime_full(d_val),
                    "acct_time": parse_datetime_full(d_val),
                    "type": "EMPLOYEE_EXPENSE",
                    "action_type": "DISBURSED",
                    "category": category,
                    "amount": float(amt),
                    "liters": 0.0,
                    "place": recipient or employee,
                    "employee": employee,
                    "remarks": reason,
                    "raw_notes": notes if notes != 'nan' else (recipient or reason),
                    "fingerprint": fp,
                    "source_file": "OMNI"
                })

    # 4. I-FLEET PREPAID WALLET
    elif "fleet" in fname:
        df = pd.read_excel(io.BytesIO(file_bytes))
        for _, row in df.iterrows():
            desc = str(row.get('Description') or '')
            rem = str(row.get('Remarks') or '')
            combined = f"{desc} {rem}".strip()
            truck_code, reason, category = extract_truck_and_reason(combined)

            debit = pd.to_numeric(row.get('Debit'), errors='coerce')
            credit = pd.to_numeric(row.get('Credit'), errors='coerce')
            d_val = row.get('TransactionDate')
            t_id = str(row.get('Transaction ID') or '').strip()
            employee = detect_employee(row.get('User Name'), desc, rem)

            if pd.notna(debit) and debit >= 0:
                fp = t_id if t_id else make_fingerprint(employee, d_val, debit, "LOADED")
                records.append({
                    "vehicle": clean_vehicle(truck_code),
                    "date": parse_date_str(d_val),
                    "txn_time": parse_datetime_full(d_val),
                    "acct_time": parse_datetime_full(d_val),
                    "type": "EMPLOYEE_EXPENSE",
                    "action_type": "LOADED",
                    "category": category,
                    "amount": float(debit),
                    "liters": 0.0,
                    "place": "Float Loaded",
                    "employee": employee,
                    "remarks": reason or "Card Money Added",
                    "raw_notes": combined,
                    "fingerprint": fp,
                    "source_file": "I_FLEET"
                })
            elif pd.notna(credit) and credit >= 0:
                fp = t_id if t_id else make_fingerprint(employee, d_val, credit, "RETURNED")
                records.append({
                    "vehicle": clean_vehicle(truck_code),
                    "date": parse_date_str(d_val),
                    "txn_time": parse_datetime_full(d_val),
                    "acct_time": parse_datetime_full(d_val),
                    "type": "EMPLOYEE_EXPENSE",
                    "action_type": "RETURNED",
                    "category": "Refund/Return",
                    "amount": float(credit),
                    "liters": 0.0,
                    "place": "Float Returned",
                    "employee": employee,
                    "remarks": reason or "Advance Returned",
                    "raw_notes": combined,
                    "fingerprint": fp,
                    "source_file": "I_FLEET"
                })

    return records