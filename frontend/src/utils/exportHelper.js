import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export const exportAllDataToExcel = async () => {
  try {
    const res = await axios.get(`${API_BASE}/trips/all`).catch(() => ({ data: [] }));
    const trips = Array.isArray(res.data) ? res.data : [];

    let csvContent = "data:text/csv;charset=utf-8,";
    
    // HEADERS (EWAY BILL NUMBER REMOVED, ONLY EXPIRY DATE KEPT)
    csvContent += "DATE,FROM,TO,VEHICLE NO,PARTY,OWNER NAME,FREIGHT,UNLOADING,HOLDING,GST,TOTAL FREIGHT,ADVANCE,ADVANCE DATE,TDS,EXTRA DEDUCTION,BALANCE,POD RECEIVED DATE,GTA,L R NO.,EWAY BILL EXPIRY\n";
    
    for (const t of trips) {
      let fin = {};
      try {
        const finRes = await axios.get(`${API_BASE}/trips/details/${t.trip_id}`);
        fin = finRes.data || {};
      } catch (e) {
        // fallback
      }

      const advances = fin.advance_details 
        ? (typeof fin.advance_details === 'string' ? JSON.parse(fin.advance_details) : fin.advance_details) 
        : [];
      
      const advDates = advances.map(a => a.date).filter(Boolean).join(" | ");
      
      const freight = parseFloat(fin.freight_amount || t.freight_amount || 0);
      const unloading = parseFloat(fin.loading_charge || 0);
      const holding = parseFloat(fin.holding_charge || 0);
      const gst = parseFloat(fin.gst || 0);
      const totalFreight = freight + unloading + holding + gst;
      
      const totalAdv = advances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      const tds = parseFloat(fin.tds || 0);
      const extraDed = parseFloat(fin.extra_deduction || 0);
      const balance = totalFreight - (totalAdv + tds + extraDed);

      const row = [
        t.trip_start_date || '',
        `"${t.source_city || ''}"`,
        `"${t.destination_city || ''}"`,
        `"${t.vehicle_number || ''}"`,
        `"${t.party_name || ''}"`,
        `"${t.owner_name || ''}"`,
        freight,
        unloading || '',
        holding || '',
        gst || '',
        totalFreight,
        totalAdv || '',
        `"${advDates}"`,
        tds || '',
        extraDed || '',
        balance,
        fin.pod_arrived_office_date || '',
        `"${t.gta_name || ''}"`,
        `"${t.lr_no || ''}"`,
        t.eway_bill_expiry || ''
      ];
      csvContent += row.join(",") + "\n";
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Jain_Freight_Master_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error("Export failed:", err);
    alert("Failed to export data to Excel.");
  }
};